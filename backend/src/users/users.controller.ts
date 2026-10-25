import { BadRequestException, Body, Controller, Get, NotFoundException, Param, ParseIntPipe, Patch } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsIn } from 'class-validator';
import { Repository } from 'typeorm';
import { CurrentUser, JwtPayload, Roles } from '../auth/auth.decorators';
import { toPublicUser } from '../auth/auth.service';
import { Role, User } from '../entities';

class UpdateRoleDto {
  @IsIn(['admin', 'teacher'])
  role: Role;
}

@Controller('users')
@Roles('admin')
export class UsersController {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  @Get()
  async list() {
    const users = await this.users.find({ order: { fullName: 'ASC' } });
    return users.map(toPublicUser);
  }

  @Patch(':id/role')
  async updateRole(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRoleDto, @CurrentUser() me: JwtPayload) {
    if (id === me.sub && dto.role !== 'admin') {
      throw new BadRequestException('You cannot remove your own admin role');
    }
    const user = await this.users.findOneBy({ id });
    if (!user) throw new NotFoundException('User not found');
    user.role = dto.role;
    return toPublicUser(await this.users.save(user));
  }
}
