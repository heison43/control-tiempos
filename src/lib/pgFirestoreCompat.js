// src/lib/pgFirestoreCompat.js
// Capa de compatibilidad para reemplazar Firestore por PostgreSQL + API Routes.
// Permite mantener gran parte de la lógica existente mientras se migra a Prisma.

export const db = { provider: 'postgresql' };

function encode(value) {
  return encodeURIComponent(JSON.stringify(value));
}

function isDateLikeKey(key = '') {
  return /(At|Time|From|To|Date|fecha|desde|hasta|created|updated|inicio|fin)$/i.test(key);
}

export class PgTimestamp {
  constructor(value) {
    this.value = value instanceof Date ? value.toISOString() : value;
  }

  toDate() {
    return this.value ? new Date(this.value) : null;
  }

  toJSON() {
    return this.value;
  }

  toString() {
    return this.value ? new Date(this.value).toISOString() : '';
  }

  static fromDate(date) {
    return { __pgTimestamp: date instanceof Date ? date.toISOString() : new Date(date).toISOString() };
  }
}

export const Timestamp = PgTimestamp;

function reviveDates(value, key = '') {
  if (Array.isArray(value)) return value.map((item) => reviveDates(item));
  if (value && typeof value === 'object') {
    const result = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = reviveDates(v, k);
    }
    return result;
  }
  if (typeof value === 'string' && isDateLikeKey(key)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return new PgTimestamp(value);
  }
  return value;
}

function collectionNameFromRef(ref) {
  return ref?.collectionName || ref?.path?.[0] || ref?.name || ref;
}

function idFromRef(ref) {
  return ref?.id || ref?.path?.[1] || null;
}

export function collection(_db, name) {
  return { type: 'collection', collectionName: name };
}

export function doc(...args) {
  // Soporta doc(db, 'collection', 'id') y doc(collectionRef, 'id')
  if (args.length === 3) {
    return { type: 'doc', collectionName: args[1], id: args[2] };
  }

  if (args.length === 2) {
    const base = args[0];
    return { type: 'doc', collectionName: collectionNameFromRef(base), id: args[1] };
  }

  throw new Error('doc() requiere colección e id');
}

export function where(field, op, value) {
  return { type: 'where', field, op, value };
}

export function orderBy(field, direction = 'asc') {
  return { type: 'orderBy', field, direction };
}

export function limit(count) {
  return { type: 'limit', count };
}

export function query(baseRef, ...constraints) {
  return {
    type: 'query',
    collectionName: collectionNameFromRef(baseRef),
    constraints,
  };
}

export function serverTimestamp() {
  return { __pgServerTimestamp: true };
}

export function arrayUnion(...values) {
  return { __pgArrayUnion: values };
}

function docSnapshotFromRow(collectionName, row) {
  const revived = reviveDates(row || {});
  return {
    id: row?.id,
    ref: { type: 'doc', collectionName, id: row?.id },
    exists: () => Boolean(row),
    data: () => revived,
  };
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = data?.message || data?.error || `Error HTTP ${response.status}`;
    throw new Error(message);
  }

  return data;
}

function buildQueryUrl(ref) {
  const collectionName = collectionNameFromRef(ref);
  const constraints = ref?.constraints || [];
  return `/api/pg-firestore?collection=${encodeURIComponent(collectionName)}&constraints=${encode(constraints)}`;
}

export async function getDocs(ref) {
  const collectionName = collectionNameFromRef(ref);
  const data = await requestJson(buildQueryUrl(ref));
  const rows = data?.rows || [];
  const docs = rows.map((row) => docSnapshotFromRow(collectionName, row));

  return {
    docs,
    empty: docs.length === 0,
    size: docs.length,
    forEach(callback) {
      docs.forEach(callback);
    },
  };
}

export async function getDoc(ref) {
  const collectionName = collectionNameFromRef(ref);
  const id = idFromRef(ref);
  const data = await requestJson(
    `/api/pg-firestore?collection=${encodeURIComponent(collectionName)}&id=${encodeURIComponent(id)}`
  );

  return docSnapshotFromRow(collectionName, data?.row || null);
}

export function onSnapshot(ref, onNext, onError) {
  let cancelled = false;

  async function load() {
    try {
      const snap = await getDocs(ref);
      if (!cancelled) onNext(snap);
    } catch (error) {
      if (!cancelled && onError) onError(error);
    }
  }

  load();
  const interval = setInterval(load, 15000);

  return () => {
    cancelled = true;
    clearInterval(interval);
  };
}

export async function addDoc(collectionRef, payload) {
  const collectionName = collectionNameFromRef(collectionRef);
  const data = await requestJson('/api/pg-firestore', {
    method: 'POST',
    body: JSON.stringify({ collection: collectionName, data: payload }),
  });
  return { id: data.id, path: `${collectionName}/${data.id}` };
}

export async function setDoc(docRef, payload, options = {}) {
  const collectionName = collectionNameFromRef(docRef);
  const id = idFromRef(docRef);
  await requestJson('/api/pg-firestore', {
    method: 'PUT',
    body: JSON.stringify({ collection: collectionName, id, data: payload, merge: options?.merge !== false }),
  });
  return { id };
}

export async function updateDoc(docRef, payload) {
  const collectionName = collectionNameFromRef(docRef);
  const id = idFromRef(docRef);
  await requestJson('/api/pg-firestore', {
    method: 'PATCH',
    body: JSON.stringify({ collection: collectionName, id, data: payload }),
  });
  return { id };
}

export async function deleteDoc(docRef) {
  const collectionName = collectionNameFromRef(docRef);
  const id = idFromRef(docRef);
  await requestJson('/api/pg-firestore', {
    method: 'DELETE',
    body: JSON.stringify({ collection: collectionName, id }),
  });
}
