import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { ERROR_CODES } from '../../common/constants/error-codes';
import { AppException } from '../../common/exceptions/app.exception';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async login(payload: LoginDto) {
    const user = await this.usersService.findByUsernameWithPassword(
      payload.username,
    );

    if (!user?.password) {
      throw new AppException(
        '用户名或密码错误',
        ERROR_CODES.INVALID_CREDENTIALS,
        401,
      );
    }

    const isMatched = await bcrypt.compare(payload.password, user.password);
    if (!isMatched) {
      throw new AppException(
        '用户名或密码错误',
        ERROR_CODES.INVALID_CREDENTIALS,
        401,
      );
    }

    const authUser: AuthUser = {
      userId: user._id.toString(),
      username: user.username,
      role: user.role,
    };

    return {
      token: await this.jwtService.signAsync(authUser),
    };
  }

  async getCurrentUser(userId: string) {
    return this.usersService.getProfile(userId);
  }

  logout() {
    return null;
  }
}
