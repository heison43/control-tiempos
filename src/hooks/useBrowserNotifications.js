'use client';

import { useEffect, useState } from 'react';
import { getToken, isSupported, onMessage } from 'firebase/messaging';
import { messaging } from '../firebaseMessaging'; // 👈 el mismo que ya usas
import { db } from '../firebaseConfig';
import {
  collection,
  doc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

const VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_KEY_ADMIN;

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
          return;
        }

        if (!('serviceWorker' in navigator)) {
          console.warn('[NOTIF] Service workers no soportados en este entorno');
          return;
        }

        const supported = await isSupported().catch(() => false);
        if (!supported || !messaging) {
          console.warn('[NOTIF] Firebase Messaging no soportado aquí');
          return;
        }

        setPermission(Notification.permission);

        // Si aún no tiene permiso, no seguimos. El clic del botón
        // será el que llame a Notification.requestPermission().
        if (Notification.permission !== 'granted') {
          return;
        }

        if (!VAPID_KEY) {
          console.error('[NOTIF] Falta NEXT_PUBLIC_VAPID_KEY_ADMIN en entorno');
          return;
        }

        // 2) Esperar a que el service worker esté listo
        const swReg = await navigator.serviceWorker.ready;

        // 3) Obtener token de FCM
        const token = await getToken(messaging, {
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: swReg,
        });

        if (!token) {
          console.warn('[NOTIF] No se obtuvo token FCM');
          return;
        }

        if (cancelled) return;

        setEnabled(true);
        setInitialized(true);

        // 4) Guardar/actualizar token en Firestore (adminPushTokens)
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
          // Importante: NO relanzamos el error
        }

        // 5) Escuchar mensajes en primer plano
        unsubscribeOnMessage = onMessage(messaging, (payload) => {
          console.log('[NOTIF] Mensaje en primer plano:', payload);
          setLastMessage(payload);
        });
      } catch (err) {
        // ⚠️ Cualquier cosa rara (como APIs no disponibles en PWA)
        // la registramos, pero NO dejamos que rompa la app.
        console.error('[NOTIF] Error inicializando notificaciones:', err);
      }
    }

    init();

    return () => {
      cancelled = true;
      if (unsubscribeOnMessage) {
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
// ✅ Añade esto al final del archivo useBrowserNotifications.js
export function showBrowserNotification(title, options = {}) {
  try {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;

    if (Notification.permission !== "granted") return;

    // Algunos navegadores requieren que sea por interacción del usuario,
    // pero esto al menos no rompe la app.
    new Notification(title, options);
  } catch (e) {
    console.warn("[NOTIF] No se pudo mostrar notificación:", e);
  }
}
