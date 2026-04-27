'use client';

export function useBrowserNotifications() {
  return {
    supported: false,
    permission: 'default',
    token: null,
    loading: false,
    error: '',
    requestPermission: async () => false,
  };
}

export function showBrowserNotification(title, options = {}) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission === 'granted') new Notification(title, options);
}
