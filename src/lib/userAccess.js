import { signInWithCustomToken, signOut as firebaseSignOut } from 'firebase/auth';
import { auth } from '../firebaseConfig';

export function normalizeEmail(email) {
  return email ? String(email).trim().toLowerCase() : null;
}

export async function ensureAuthorizedUser({ email, name }) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return { ok: false, reason: 'NO_EMAIL' };
  }

  const response = await fetch('/api/auth/resolve-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: normalizedEmail, name: name || '' }),
  });

const result = await response.json().catch(() => ({ ok: false, reason: 'BAD_JSON' }));

console.log('[ensureAuthorizedUser] status:', response.status);
console.log('[ensureAuthorizedUser] result:', result);

if (!response.ok || !result?.ok) {
    try {
      if (auth.currentUser) {
        await firebaseSignOut(auth);
      }
    } catch (error) {
      console.warn('[userAccess] No fue posible cerrar Firebase Auth local:', error);
    }

    return result?.ok === false ? result : { ok: false, reason: 'REQUEST_FAILED' };
  }

  if (result.firebaseCustomToken) {
    try {
      const alreadySigned =
        auth.currentUser &&
        auth.currentUser.uid === normalizedEmail;

      if (!alreadySigned) {
        await signInWithCustomToken(auth, result.firebaseCustomToken);
      }
    } catch (error) {
      console.error('[userAccess] Error haciendo bridge a Firebase Auth:', error);
      return {
        ok: false,
        reason: 'FIREBASE_BRIDGE_FAILED',
        message: error?.message || 'No se pudo abrir sesión interna con Firebase',
      };
    }
  }

  return result;
}

export async function getUserMetaByEmail(email) {
  const result = await ensureAuthorizedUser({ email, name: '' });
  return result?.ok ? result.meta || null : null;
}
