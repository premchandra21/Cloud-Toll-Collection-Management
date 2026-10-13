import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../api/notifications.api'

export function useNotifications(page: number, pageSize = 10) {
  return useQuery({
    queryKey: ['notifications', 'list', page, pageSize],
    queryFn: () => listNotifications({ page, pageSize }),
    placeholderData: keepPreviousData,
  })
}

// Drives the bell badge. Polled, because toll events arrive from another session (the operator).
export function useUnreadCount() {
  return useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () => listNotifications({ page: 1, pageSize: 1, unreadOnly: true }),
    select: (d) => d.unreadCount,
    refetchInterval: 20000,
  })
}

export function useMarkNotificationRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
}