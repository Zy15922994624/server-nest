export interface CourseSummaryDto {
  id: string;
  title: string;
  description: string;
  courseCode?: string;
  coverImage?: string;
  semester?: string;
  credits?: number;
  maxStudents?: number | null;
  teacherId: string;
  teacherName: string;
  studentCount: number;
  taskCount: number;
  isArchived: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CourseDetailDto = CourseSummaryDto;

export interface CoursesPageDto {
  items: CourseSummaryDto[];
  total: number;
}

export interface CourseMemberUserDto {
  id: string;
  username: string;
  email: string;
  role: string;
  fullName?: string;
  avatar?: string;
}

export interface CourseMemberDto {
  id: string;
  courseId: string;
  userId: string;
  joinDate: string;
  createdAt: string;
  updatedAt: string;
  user?: CourseMemberUserDto;
}

export interface CourseMembersPageDto {
  items: CourseMemberDto[];
  total: number;
}
