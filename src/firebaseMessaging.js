// src/firebaseMessaging.js
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import app from './firebaseConfig';

const VAPID_KEY = process.env.NEXT_PUBLIC_FCM_VAPID_KEY;

let messagingPromise = null;

// ✅ Inicializamos messaging sólo si el navegador lo soporta
async function getMessagingInstance() {
  if (typeof window === 'undefined') return null;

  if (!messagingPromise) {
    messagingPromise = (async () => {
      try {
        const supported = await isSupported().catch(() => false);
        if (!supported) {
          console.warn('[FCM] Not supported in this browser');
          return null;
        }

        const messaging = getMessaging(app);
        return messaging;
      } catch (e) {
        console.error('[FCM] Error inicializando messaging:', e);
        return null;
      }
    })();
  }

  return messagingPromise;
}

// 🔑 Pedir permiso y obtener token FCM (versión más defensiva)
export async function getFcmToken() {
  if (typeof window === 'undefined') return null;
  if (!('Notification' in window)) {
    console.warn('[FCM] Notification API no disponible en este entorno');
    return null;
  }

  if (!VAPID_KEY) {
    console.warn('[FCM] Falta NEXT_PUBLIC_FCM_VAPID_KEY');
    return null;
  }

  try {
    // Si no está concedido, pedimos permiso
    if (Notification.permission !== 'granted') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.log('[FCM] Permiso de notificaciones no concedido');
        return null;
      }
    }

    const messaging = await getMessagingInstance();
    if (!messaging) return null;

    // Intentamos usar un service worker ya listo si existe
    let registration = null;
    if ('serviceWorker' in navigator) {
      try {
        registration = await navigator.serviceWorker.ready;
      } catch (e) {
        console.warn('[FCM] SW no ready, intentando registrar firebase-messaging-sw.js...');
        try {
          registration = await navigator.serviceWorker.register(
            '/firebase-messaging-sw.js'
          );
        } catch (e2) {
          console.error('[FCM] Error registrando SW de FCM:', e2);
        }
      }
    }

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      ...(registration ? { serviceWorkerRegistration: registration } : {}),
    });

    console.log('[FCM] Token web:', token);
    return token;
  } catch (err) {
    console.error('[FCM] Error al obtener token FCM:', err);
    return null;
  }
}

// 🔔 Escuchar mensajes cuando la pestaña está en primer plano
export async function listenForegroundMessages(callback) {
  const messaging = await getMessagingInstance();
  if (!messaging) return () => {};

  const unsubscribe = onMessage(messaging, (payload) => {
    console.log('[FCM] Mensaje en foreground:', payload);
    if (typeof callback === 'function') {
      callback(payload);
    }
  });

  return unsubscribe;
}
