// src/lib/firebaseAdmin.js
import admin from 'firebase-admin';
import path from 'path';
import { readFileSync } from 'fs';

let app;

// Evitamos reinicializar admin en dev
if (!admin.apps.length) {
  // 👇 Ruta al serviceAccount que guardaste (ajusta si está en otro sitio)
  const serviceAccountPath = path.join(
    process.cwd(),
    'admin',
    'serviceAccountKey.json'
  );

  const serviceAccount = JSON.parse(
    readFileSync(serviceAccountPath, 'utf8')
  );

  app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
} else {
  app = admin.app();
}

// Exportamos helpers
export const adminApp = app;
export const adminDb = admin.firestore();
export const adminMessaging = admin.messaging();
