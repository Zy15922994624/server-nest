import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppException } from '../exceptions/app.exception';
import { ERROR_CODES } from '../constants/error-codes';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthUser, UserRole } from '../interfaces/auth-user.interface';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = request.user;

    if (!user) {
      throw new AppException('用户未认证', ERROR_CODES.UNAUTHORIZED, 401);
    }

    if (!requiredRoles.includes(user.role)) {
      throw new AppException('权限不足', ERROR_CODES.FORBIDDEN, 403);
    }

    return true;
  }
}
