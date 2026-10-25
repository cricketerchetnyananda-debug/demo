import { BadRequestException } from '@nestjs/common';

/** Today's date as YYYY-MM-DD in the server's local timezone. */
export function todayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function assertNotFuture(date: string) {
  if (date > todayIso()) throw new BadRequestException('Attendance cannot be recorded for a future date');
}

export function assertRange(from: string, to: string) {
  if (from > to) throw new BadRequestException('"From" date must be on or before "To" date');
  const days = (Date.parse(to) - Date.parse(from)) / 86_400_000;
  if (days > 366) throw new BadRequestException('Date range can be at most one year');
}
