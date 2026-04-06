export interface CourseResourceUploaderDto {
  id: string;
  username: string;
  fullName?: string;
}

export interface CourseResourceDto {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  type: 'document' | 'video' | 'image' | 'other';
  fileKey: string;
  fileUrl: string;
  originalFileName: string;
  mimeType: string;
  size: number;
  uploaderId: string;
  uploader?: CourseResourceUploaderDto;
  createdAt: string;
  updatedAt: string;
}

export interface CourseResourcesPageDto {
  items: CourseResourceDto[];
  total: number;
}
