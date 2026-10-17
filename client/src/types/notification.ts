export type NotificationType =
  | 'LOW_BALANCE'
  | 'TOLL_SUCCESS'
  | 'TOLL_FAILED'
  | 'CREDIT_USED'
  | 'CREDIT_DUE_SOON'
  | 'CREDIT_OVERDUE'
  | 'CREDIT_SETTLED'

export interface AppNotification {
  id: string
  type: NotificationType
  title: string
  message: string
  isRead: boolean
  createdAt: string
}