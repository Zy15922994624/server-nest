import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { AppException } from '../../common/exceptions/app.exception';

describe('AuthService', () => {
  const findByUsernameWithPassword = jest.fn();
  const getProfile = jest.fn();
  const signAsync = jest.fn();

  const usersService = {
    findByUsernameWithPassword,
    getProfile,
  } as unknown as jest.Mocked<UsersService>;

  const jwtService = {
    signAsync,
  } as unknown as jest.Mocked<JwtService>;

  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(usersService, jwtService);
  });

  it('登录成功时应返回 token', async () => {
    findByUsernameWithPassword.mockResolvedValue({
      _id: { toString: () => 'user-id-1' },
      username: 'student001',
      role: 'student',
      password: await bcrypt.hash('Student@123456', 12),
    });
    signAsync.mockResolvedValue('token-123');

    const result = await service.login({
      username: 'student001',
      password: 'Student@123456',
    });

    expect(result).toEqual({ token: 'token-123' });
    expect(signAsync).toHaveBeenCalled();
  });

  it('用户名不存在时应抛出异常', async () => {
    findByUsernameWithPassword.mockResolvedValue(null);

    await expect(
      service.login({
        username: 'not-exists',
        password: '123456',
      }),
    ).rejects.toBeInstanceOf(AppException);
  });
});
