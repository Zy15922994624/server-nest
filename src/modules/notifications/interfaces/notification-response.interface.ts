export type NotificationType = 'task_due_soon' | 'task_overdue' | 'task_graded';

export type NotificationRelatedType = 'task' | 'course' | 'submission';

export interface NotificationItemDto {
  id: string;
  recipientId: string;
  type: NotificationType;
  title: string;
  content: string;
  relatedId: string | null;
  relatedType: NotificationRelatedType | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationsPageDto {
  items: NotificationItemDto[];
  total: number;
}

export interface NotificationUnreadCountDto {
  unreadCount: number;
}

export interface NotificationScanResultDto {
  dueSoonCreated: number;
  overdueCreated: number;
}
