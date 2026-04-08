export type TaskType = 'homework' | 'quiz' | 'project' | 'reading';
export type TaskAssignmentMode = 'all' | 'selected';
export type TaskSubmissionStatus = 'submitted' | 'graded';

export interface TaskFileResponseDto {
  key: string;
  url: string;
  originalName: string;
  size: number;
  mimeType: string;
  name?: string;
}

export interface TaskUserBriefDto {
  id: string;
  username: string;
  fullName?: string;
}

export interface TaskCourseBriefDto {
  id: string;
  title: string;
  courseCode?: string;
}

export interface TaskResourceBriefDto {
  id: string;
  title: string;
  type: 'document' | 'video' | 'image' | 'other';
  fileUrl: string;
  originalFileName: string;
}

export interface TaskItemDto {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  type: TaskType;
  dueDate: string;
  totalScore: number;
  passingScore: number;
  attachments: TaskFileResponseDto[];
  relatedResourceIds: string[];
  isPublished: boolean;
  publishedAt: string | null;
  assignmentMode: TaskAssignmentMode;
  creatorId: string;
  assignedStudentCount: number;
  submittedCount: number;
  gradedCount: number;
  course?: TaskCourseBriefDto;
  creator?: TaskUserBriefDto;
  currentUserSubmissionStatus?: TaskSubmissionStatus | 'not_submitted';
  currentUserScore?: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaskDetailDto extends TaskItemDto {
  relatedResources: TaskResourceBriefDto[];
}

export interface TaskSubmissionDto {
  id: string;
  taskId: string;
  userId: string;
  content?: string;
  attachments: TaskFileResponseDto[];
  submittedAt: string;
  status: TaskSubmissionStatus;
  score?: number;
  maxScore: number;
  feedback?: string;
  gradedBy?: string;
  gradedAt?: string | null;
  user?: TaskUserBriefDto;
  createdAt: string;
  updatedAt: string;
}

export interface TasksPageDto {
  items: TaskItemDto[];
  total: number;
}

export interface TaskSubmissionsPageDto {
  items: TaskSubmissionDto[];
  total: number;
}
