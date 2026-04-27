export function normalizeEmail(email) {
  return email ? String(email).trim().toLowerCase() : null;
}

export async function ensureAuthorizedUser({ email, name }) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return { ok: false, reason: 'NO_EMAIL' };

  const response = await fetch('/api/auth/resolve-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: normalizedEmail, name: name || '' }),
  });

  const result = await response.json().catch(() => ({ ok: false, reason: 'BAD_JSON' }));

  if (!response.ok || !result?.ok) {
    return result?.ok === false ? result : { ok: false, reason: 'REQUEST_FAILED' };
  }

  return result;
}

export async function getUserMetaByEmail(email) {
  const result = await ensureAuthorizedUser({ email, name: '' });
  return result?.ok ? result.meta || null : null;
}
