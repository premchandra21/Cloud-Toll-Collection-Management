export type NotificationType = 'LOW_BALANCE' | 'TOLL_SUCCESS' | 'TOLL_FAILED'

export interface AppNotification {
  id: string
  type: NotificationType
  title: string
  message: string
  isRead: boolean
  createdAt: string
}