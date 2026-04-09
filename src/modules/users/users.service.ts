import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcryptjs';
import { Model } from 'mongoose';
import { ERROR_CODES } from '../../common/constants/error-codes';
import { AppException } from '../../common/exceptions/app.exception';
import { CreateManagedUserDto } from './dto/create-managed-user.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { UpdateManagedUserDto } from './dto/update-managed-user.dto';
import { UserProfileDto } from './dto/user-profile.dto';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async findByUsernameWithPassword(username: string) {
    return this.userModel
      .findOne({ username: username.trim() })
      .select('+password');
  }

  async findByUsernameOrEmail(username: string, email: string) {
    return this.userModel.findOne({
      $or: [
        { username: username.trim() },
        { email: email.trim().toLowerCase() },
      ],
    });
  }

  async findById(userId: string) {
    return this.userModel.findById(userId);
  }

  async getProfile(userId: string): Promise<UserProfileDto> {
    const user = await this.findById(userId);

    if (!user) {
      throw new AppException('用户不存在', ERROR_CODES.USER_NOT_FOUND, 404);
    }

    return this.toProfile(user);
  }

  async getManagementList(query: QueryUsersDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const searchKeyword = query.search?.trim();
    const filter: Record<string, unknown> = {};

    if (query.role) {
      filter.role = query.role;
    }

    if (searchKeyword) {
      filter.$or = [
        { username: { $regex: searchKeyword, $options: 'i' } },
        { email: { $regex: searchKeyword, $options: 'i' } },
        { fullName: { $regex: searchKeyword, $options: 'i' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.userModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize),
      this.userModel.countDocuments(filter),
    ]);

    return {
      items: items.map((user) => this.toProfile(user)),
      total,
    };
  }

  async getManagementStats() {
    const [total, adminCount, teacherCount, studentCount] = await Promise.all([
      this.userModel.countDocuments(),
      this.userModel.countDocuments({ role: 'admin' }),
      this.userModel.countDocuments({ role: 'teacher' }),
      this.userModel.countDocuments({ role: 'student' }),
    ]);

    return {
      total,
      adminCount,
      teacherCount,
      studentCount,
    };
  }

  async createManagedUser(
    payload: CreateManagedUserDto,
  ): Promise<UserProfileDto> {
    await this.assertUsernameAndEmailAvailable(payload.username, payload.email);

    const hashedPassword = await bcrypt.hash(payload.password, 12);
    const user = await this.userModel.create({
      username: payload.username.trim(),
      password: hashedPassword,
      email: payload.email.trim().toLowerCase(),
      role: payload.role,
      fullName: payload.fullName?.trim() ?? '',
      avatar: payload.avatar?.trim() ?? '',
    });

    return this.toProfile(user);
  }

  async updateManagedUser(
    userId: string,
    payload: UpdateManagedUserDto,
    currentUserId: string,
  ): Promise<UserProfileDto> {
    const user = await this.findById(userId);

    if (!user) {
      throw new AppException('用户不存在', ERROR_CODES.USER_NOT_FOUND, 404);
    }

    if (userId === currentUserId && payload.role && payload.role !== 'admin') {
      throw new AppException(
        '不能修改自己的管理员角色',
        ERROR_CODES.FORBIDDEN,
        403,
      );
    }

    if (user.role === 'admin' && payload.role && payload.role !== 'admin') {
      throw new AppException('不能修改管理员角色', ERROR_CODES.FORBIDDEN, 403);
    }

    const nextUsername = payload.username?.trim();
    const nextEmail = payload.email?.trim().toLowerCase();

    if (nextUsername || nextEmail) {
      await this.assertUsernameAndEmailAvailable(
        nextUsername ?? user.username,
        nextEmail ?? user.email,
        userId,
      );
    }

    if (nextUsername) {
      user.username = nextUsername;
    }

    if (nextEmail) {
      user.email = nextEmail;
    }

    if (payload.fullName !== undefined) {
      user.fullName = payload.fullName.trim();
    }

    if (payload.role) {
      user.role = payload.role;
    }

    if (payload.avatar !== undefined) {
      user.avatar = payload.avatar.trim();
    }

    if (payload.password?.trim()) {
      user.password = await bcrypt.hash(payload.password.trim(), 12);
    }

    await user.save();
    return this.toProfile(user);
  }

  async deleteManagedUser(
    userId: string,
    currentUserId: string,
  ): Promise<void> {
    const user = await this.findById(userId);

    if (!user) {
      throw new AppException('用户不存在', ERROR_CODES.USER_NOT_FOUND, 404);
    }

    if (userId === currentUserId) {
      throw new AppException(
        '不能删除当前登录账号',
        ERROR_CODES.FORBIDDEN,
        403,
      );
    }

    if (user.role === 'admin') {
      throw new AppException('不能删除管理员账号', ERROR_CODES.FORBIDDEN, 403);
    }

    await user.deleteOne();
  }

  toProfile(user: UserDocument): UserProfileDto {
    return {
      id: user._id.toString(),
      username: user.username,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
      avatar: user.avatar,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  private async assertUsernameAndEmailAvailable(
    username: string,
    email: string,
    excludeUserId?: string,
  ) {
    const existingUser = await this.userModel.findOne({
      $or: [
        { username: username.trim() },
        { email: email.trim().toLowerCase() },
      ],
      ...(excludeUserId ? { _id: { $ne: excludeUserId } } : {}),
    });

    if (!existingUser) {
      return;
    }

    throw new AppException(
      '用户名或邮箱已存在',
      ERROR_CODES.USER_ALREADY_EXISTS,
      409,
    );
  }
}
