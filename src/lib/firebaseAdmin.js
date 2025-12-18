// src/lib/firebaseAdmin.js
import admin from 'firebase-admin';
import path from 'path';
import { readFileSync } from 'fs';

let adminApp = null;

function initAdmin() {
  // Si ya hay una app inicializada (hot reload, etc.) la reutilizamos
  if (admin.apps.length) {
    adminApp = admin.app();
    return;
  }

  try {
    let credentialConfig = null;

    // 1️⃣ Primero intentamos con VARIABLES DE ENTORNO (ideal para Vercel)
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const rawPrivateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

    if (projectId && clientEmail && rawPrivateKey) {
      const privateKey = rawPrivateKey.replace(/\\n/g, '\n');
      credentialConfig = { projectId, clientEmail, privateKey };
      console.log('[firebaseAdmin] Usando credenciales desde variables de entorno');
    } else {
      // 2️⃣ Si no hay env vars, probamos con el archivo local (solo para desarrollo)
      const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');

      try {
        const file = readFileSync(serviceAccountPath, 'utf8');
        credentialConfig = JSON.parse(file);
        console.log('[firebaseAdmin] Usando serviceAccountKey.json local');
      } catch (err) {
        // ⚠️ IMPORTANTE: NO LANZAR ERROR → solo aviso
        console.warn(
          '[firebaseAdmin] No se encontraron credenciales (env ni serviceAccountKey.json). ' +
            'Las funciones que usan Firebase Admin quedarán deshabilitadas.'
        );
      }
    }

    // Si logramos obtener credenciales, inicializamos Firebase Admin
    if (credentialConfig) {
      adminApp = admin.initializeApp({
        credential: admin.credential.cert(credentialConfig),
      });
    }
  } catch (err) {
    console.error('[firebaseAdmin] Error inicializando Firebase Admin:', err);
  }
}

initAdmin();

// Si no hay adminApp, exportamos null para que la API lo maneje sin romper
export const adminDb = adminApp ? admin.firestore() : null;
export const adminMessaging = adminApp ? admin.messaging() : null;

