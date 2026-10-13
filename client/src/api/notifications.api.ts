import { api } from './axios'
import type { ApiSuccess } from './axios'
import type { AppNotification } from '../types/notification'
import type { PageMeta } from '../types/wallet'

export interface NotificationPage {
  items: AppNotification[]
  unreadCount: number
  meta: PageMeta
}

export async function listNotifications(params: {
  page: number
  pageSize: number
  unreadOnly?: boolean
}): Promise<NotificationPage> {
  const res = await api.get<
    ApiSuccess<{ notifications: AppNotification[]; unreadCount: number }>
  >('/notifications', { params })
  return {
    items: res.data.data.notifications,
    unreadCount: res.data.data.unreadCount,
    meta: res.data.meta as unknown as PageMeta,
  }
}

export async function markNotificationRead(id: string): Promise<AppNotification> {
  const res = await api.patch<ApiSuccess<{ notification: AppNotification }>>(
    `/notifications/${id}/read`,
  )
  return res.data.data.notification
}

export async function markAllNotificationsRead(): Promise<{ updated: number }> {
  const res = await api.patch<ApiSuccess<{ updated: number }>>('/notifications/read-all')
  return res.data.data
}