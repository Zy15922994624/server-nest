const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/chat_system';
const SALT_ROUNDS = 12;

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true, select: false },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    role: {
      type: String,
      enum: ['student', 'teacher', 'admin'],
      default: 'student',
      required: true,
    },
    fullName: { type: String, default: '', trim: true },
    avatar: { type: String, default: '', trim: true },
  },
  { timestamps: true, versionKey: false },
);

const User = mongoose.models.User || mongoose.model('User', userSchema);

const seedUsers = [
  {
    username: 'admin001',
    password: 'Admin@123456',
    email: 'admin001@example.com',
    role: 'admin',
    fullName: '系统管理员',
  },
  {
    username: 'teacher001',
    password: 'Teacher@123456',
    email: 'teacher001@example.com',
    role: 'teacher',
    fullName: '示例教师',
  },
  {
    username: 'student001',
    password: 'Student@123456',
    email: 'student001@example.com',
    role: 'student',
    fullName: '示例学生',
  },
];

async function upsertUser(user) {
  const hashedPassword = await bcrypt.hash(user.password, SALT_ROUNDS);
  await User.updateOne(
    { username: user.username },
    {
      $set: {
        email: user.email,
        role: user.role,
        fullName: user.fullName,
        avatar: '',
        password: hashedPassword,
      },
    },
    { upsert: true },
  );
}

async function main() {
  await mongoose.connect(MONGO_URL);

  try {
    for (const user of seedUsers) {
      await upsertUser(user);
    }

    console.log('默认测试用户已初始化');
    console.log('admin001 / Admin@123456');
    console.log('teacher001 / Teacher@123456');
    console.log('student001 / Student@123456');
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error('初始化测试用户失败:', error);
  process.exit(1);
});
