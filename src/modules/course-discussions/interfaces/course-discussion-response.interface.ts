export interface CourseDiscussionAuthorDto {
  id: string;
  username: string;
  fullName?: string;
}

export interface CourseDiscussionReplyDto {
  id: string;
  content: string;
  authorId: string;
  author?: CourseDiscussionAuthorDto;
  createdAt: string;
  updatedAt: string;
}

export interface CourseDiscussionListItemDto {
  id: string;
  courseId: string;
  title: string;
  content: string;
  authorId: string;
  author?: CourseDiscussionAuthorDto;
  replyCount: number;
  lastReplyAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CourseDiscussionDetailDto extends CourseDiscussionListItemDto {
  content: string;
}

export interface CourseDiscussionsPageDto {
  items: CourseDiscussionListItemDto[];
  total: number;
}

export interface CourseDiscussionRepliesPageDto {
  items: CourseDiscussionReplyDto[];
  total: number;
}
