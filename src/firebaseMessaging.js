
// admin/src/firebaseMessaging.js
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
// 👇 IMPORT CORRECTO: en firebaseConfig tienes "export default app;"
import app from './firebaseConfig';

const VAPID_KEY = process.env.NEXT_PUBLIC_FCM_VAPID_KEY;

let messagingPromise = null;

// Inicializamos messaging sólo si el navegador lo soporta
async function getMessagingInstance() {
  if (typeof window === 'undefined') return null;

  if (!messagingPromise) {
    messagingPromise = (async () => {
      const supported = await isSupported().catch(() => false);
      if (!supported) {
        console.warn('[FCM] Not supported in this browser');
        return null;
      }
      return getMessaging(app);
    })();
  }

  return messagingPromise;
}

// 🔑 Pedir permiso y obtener token FCM
export async function getFcmToken() {
  if (typeof window === 'undefined') return null;
  if (!('Notification' in window)) return null;

  if (!VAPID_KEY) {
    console.warn('[FCM] Falta NEXT_PUBLIC_FCM_VAPID_KEY');
    return null;
  }

  // Pedimos permiso sólo si aún está en "default"
  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }

  if (permission !== 'granted') {
    console.log('[FCM] Permiso de notificaciones no concedido');
    return null;
  }

  const messaging = await getMessagingInstance();
  if (!messaging) return null;

  try {
    // Nos aseguramos de tener un service worker listo
    let registration = null;
    if ('serviceWorker' in navigator) {
      try {
        // Si ya está registrado, esperamos a que esté "ready"
        registration = await navigator.serviceWorker.ready;
      } catch (e) {
        console.warn('[FCM] No hay SW listo, intentando registrar...');
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
    console.error('[FCM] Error al obtener token:', err);
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
