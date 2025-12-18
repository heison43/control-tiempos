/* public/firebase-messaging-sw.js */
/* eslint-disable no-undef */

// Importamos Firebase en modo compat para el service worker
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// ⚠️ Usa aquí la misma config que en tu firebaseConfig.js.
// Son datos públicos del proyecto, no son secretos.
firebase.initializeApp({
  apiKey: 'TU_API_KEY',
  authDomain: 'control-tiempos-517a0.firebaseapp.com',
  projectId: 'control-tiempos-517a0',
  storageBucket: 'control-tiempos-517a0.appspot.com',
  messagingSenderId: '696672229185',
  appId: '1:696672229185:WEB:TU_APP_ID',
});

// Instancia de messaging
const messaging = firebase.messaging();

// Notificaciones cuando la página está cerrada / en segundo plano
messaging.onBackgroundMessage((payload) => {
  console.log(
    '[firebase-messaging-sw.js] Mensaje en background recibido:',
    payload
  );

  const notificationTitle =
    payload.notification?.title || 'Nueva notificación';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/icon-192x192.png', // si no tienes icono, puedes quitar esta línea
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
