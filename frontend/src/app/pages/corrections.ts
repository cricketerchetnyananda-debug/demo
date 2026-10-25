import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { classLabel, Correction, CorrectionState, errorMessage } from '../core/models';

@Component({
  selector: 'app-corrections',
  imports: [FormsModule, DatePipe],
  template: `
    <h1>Absent Corrections</h1>
    <p class="subtitle">
      @if (auth.isAdmin()) {
        Review requests from teachers to change a wrongly marked absence. Approving updates the attendance record.
      } @else {
        Track the correction requests you have made. Request a new one from the Absent Tracking page.
      }
    </p>

    <div class="toolbar">
      <div class="field">
        <label for="status">Show</label>
        <select id="status" [(ngModel)]="status" (ngModelChange)="load()">
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="">All</option>
        </select>
      </div>
    </div>

    @if (error()) {
      <div class="alert error">{{ error() }}</div>
    }
    @if (message()) {
      <div class="alert success">{{ message() }}</div>
    }

    <div class="card">
      @if (!items().length) {
        <div class="empty">No {{ status || '' }} correction requests.</div>
      } @else {
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th><th>Class</th><th>Student</th><th>Change</th><th>Reason</th>
                <th>Requested by</th><th>Status</th>
                @if (auth.isAdmin() && status === 'pending') {
                  <th>Review</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (c of items(); track c.id) {
                <tr>
                  <td>{{ c.date }}</td>
                  <td>{{ label(c.class) }}</td>
                  <td>{{ c.student.rollNumber }}. {{ c.student.fullName }}</td>
                  <td>
                    <span class="badge absent">{{ c.originalStatus }}</span> →
                    <span class="badge" [class]="c.requestedStatus">{{ c.requestedStatus }}</span>
                    @if (c.requestedCheckInTime) {
                      <span class="muted"> at {{ c.requestedCheckInTime }}</span>
                    }
                  </td>
                  <td>{{ c.reason }}</td>
                  <td>
                    {{ c.requestedBy }}<br />
                    <span class="muted">{{ c.createdAt | date: 'short' }}</span>
                  </td>
                  <td>
                    <span class="badge" [class]="c.status">{{ c.status }}</span>
                    @if (c.reviewedBy) {
                      <div class="muted small-text">by {{ c.reviewedBy }}</div>
                    }
                    @if (c.reviewNote) {
                      <div class="muted small-text">“{{ c.reviewNote }}”</div>
                    }
                  </td>
                  @if (auth.isAdmin() && status === 'pending') {
                    <td>
                      <div class="review">
                        <input [(ngModel)]="notes[c.id]" placeholder="Note (optional)" maxlength="500" />
                        <div class="row-actions">
                          <button class="small success" [disabled]="busyId() === c.id" (click)="review(c, 'approved')">Approve</button>
                          <button class="small danger" [disabled]="busyId() === c.id" (click)="review(c, 'rejected')">Reject</button>
                        </div>
                      </div>
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
  styles: `
    .review { display: flex; flex-direction: column; gap: 6px; min-width: 180px; }
    .small-text { font-size: 0.8rem; margin-top: 3px; }
  `,
})
export class CorrectionsPage implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);

  protected readonly label = classLabel;
  protected status: CorrectionState | '' = 'pending';
  protected readonly items = signal<Correction[]>([]);
  protected readonly error = signal('');
  protected readonly message = signal('');
  protected readonly busyId = signal<number | null>(null);
  protected notes: Record<number, string> = {};

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.error.set('');
    this.api.corrections(this.status).subscribe({
      next: (items) => this.items.set(items),
      error: (err) => this.error.set(errorMessage(err)),
    });
  }

  review(c: Correction, decision: 'approved' | 'rejected'): void {
    this.busyId.set(c.id);
    this.error.set('');
    this.message.set('');
    this.api.reviewCorrection(c.id, decision, this.notes[c.id]).subscribe({
      next: () => {
        this.busyId.set(null);
        this.message.set(
          decision === 'approved'
            ? `Approved: ${c.student.fullName} is now marked ${c.requestedStatus} on ${c.date}.`
            : `Rejected the request for ${c.student.fullName}.`,
        );
        this.load();
      },
      error: (err) => {
        this.busyId.set(null);
        this.error.set(errorMessage(err));
      },
    });
  }
}
