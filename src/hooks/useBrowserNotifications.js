'use client';

import { useEffect, useState } from 'react';
import { db } from '../firebaseConfig';
import { getFcmToken, listenForegroundMessages } from '../firebaseMessaging';
import { collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';

export function useBrowserNotifications({ role } = {}) {
  const [permission, setPermission] = useState('default'); // 'default' | 'granted' | 'denied'
  const [enabled, setEnabled] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    let unsubscribeOnMessage = null;
    let cancelled = false;

    async function init() {
      try {
        if (typeof window === 'undefined') return;

        // 1) Verificar APIs del navegador sin romper la app
        if (!('Notification' in window)) {
          console.warn('[NOTIF] Notification API no soportada en este entorno');
          setInitialized(true);
          return;
        }

        if (!('serviceWorker' in navigator)) {
          console.warn('[NOTIF] Service workers no soportados en este entorno');
          setInitialized(true);
          return;
        }

        setPermission(Notification.permission);

        // Si aún no tiene permiso, no seguimos. El clic del botón
        // será el que llame a Notification.requestPermission().
        if (Notification.permission !== 'granted') {
          setInitialized(true);
          return;
        }

        // 2) Obtener token FCM (usa tu inicialización defensiva de firebaseMessaging.js)
        const token = await getFcmToken();
        if (!token) {
          console.warn('[NOTIF] No se obtuvo token FCM');
          setInitialized(true);
          return;
        }

        if (cancelled) return;

        setEnabled(true);
        setInitialized(true);

        // 3) Guardar/actualizar token en Firestore (adminPushTokens)
        try {
          const userAgent = window.navigator.userAgent || 'unknown';
          const docRef = doc(collection(db, 'adminPushTokens'), token);

          await setDoc(
            docRef,
            {
              token,
              role: role || 'admin',
              userAgent,
              updatedAt: serverTimestamp(),
              createdAt: serverTimestamp(),
            },
            { merge: true }
          );

          console.log('[NOTIF] Token de admin registrado / actualizado');
        } catch (e) {
          console.error('[NOTIF] Error guardando token en Firestore:', e);
        }

        // 4) Escuchar mensajes en primer plano (foreground)
        unsubscribeOnMessage = await listenForegroundMessages((payload) => {
          console.log('[NOTIF] Mensaje en primer plano:', payload);
          setLastMessage(payload);
        });
      } catch (err) {
        console.error('[NOTIF] Error inicializando notificaciones:', err);
        setInitialized(true);
      }
    }

    init();

    return () => {
      cancelled = true;
      if (typeof unsubscribeOnMessage === 'function') {
        unsubscribeOnMessage();
      }
    };
  }, [role]);

  return {
    permission,
    enabled,
    lastMessage,
    initialized,
  };
}

// ✅ Utilidad para notificaciones locales (no rompe si falla)
export function showBrowserNotification(title, options = {}) {
  try {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    new Notification(title, options);
  } catch (e) {
    console.warn('[NOTIF] No se pudo mostrar notificación:', e);
  }
}
