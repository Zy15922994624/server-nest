import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppException } from '../../common/exceptions/app.exception';
import { ERROR_CODES } from '../../common/constants/error-codes';
import { User, UserDocument } from './schemas/user.schema';
import { UserProfileDto } from './dto/user-profile.dto';

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
}
