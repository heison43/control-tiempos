'use client';

import { useEffect } from 'react';

export default function RegisterSW() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!('serviceWorker' in navigator)) {
      console.warn('[SW] Service workers no soportados en este navegador');
      return;
    }

    navigator.serviceWorker
      .register('/firebase-messaging-sw.js')
      .then((registration) => {
        console.log('[SW] Registrado correctamente:', registration.scope);
      })
      .catch((err) => {
        console.error('[SW] Error registrando service worker:', err);
        // NO relanzar error
      });
  }, []);

  return null;
}
