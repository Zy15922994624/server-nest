export type UserRole = 'student' | 'teacher' | 'admin';

export interface AuthUser {
  userId: string;
  username: string;
  role: UserRole;
}
