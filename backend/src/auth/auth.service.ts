import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { compare, hash } from 'bcryptjs';
import { Repository } from 'typeorm';
import { User } from '../entities';
import { JwtPayload } from './auth.decorators';
import { LoginDto, RegisterDto } from './auth.dto';

export function toPublicUser(user: User) {
  return { id: user.id, email: user.email, fullName: user.fullName, role: user.role };
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    if (await this.users.existsBy({ email })) {
      throw new ConflictException('An account with this email already exists');
    }
    // The very first account becomes the school admin; everyone after that registers as a teacher.
    const isFirstUser = (await this.users.count()) === 0;
    const user = await this.users.save(
      this.users.create({
        email,
        fullName: dto.fullName.trim(),
        passwordHash: await hash(dto.password, 10),
        role: isFirstUser ? 'admin' : 'teacher',
      }),
    );
    return this.issueToken(user);
  }

  async login(dto: LoginDto) {
    const user = await this.users
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.email = :email', { email: dto.email.trim().toLowerCase() })
      .getOne();
    if (!user || !(await compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.issueToken(user);
  }

  async me(userId: number) {
    const user = await this.users.findOneByOrFail({ id: userId });
    return toPublicUser(user);
  }

  private issueToken(user: User) {
    const payload: JwtPayload = { sub: user.id, email: user.email, name: user.fullName, role: user.role };
    return { accessToken: this.jwt.sign(payload), user: toPublicUser(user) };
  }
}
