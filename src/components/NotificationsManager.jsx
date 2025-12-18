// src/components/NotificationsManager.jsx
'use client';

import { useEffect, useState, useMemo } from 'react';
import { db } from '../firebaseConfig';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';

// 🔔 NUEVO: helpers de FCM web
import {
  getFcmToken,
  listenForegroundMessages,
} from '../firebaseMessaging';

function formatDateTime(date) {
  if (!date) return '';
  try {
    return date.toLocaleString('es-CO', {
      timeZone: 'America/Bogota',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export default function NotificationsManager({ role = 'admin' }) {
  const [notifications, setNotifications] = useState([]);
  const [readIds, setReadIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [browserPermission, setBrowserPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  const storageKey = useMemo(
    () => `ct_notifications_read_${role}`,
    [role]
  );

  // 👉 Cargar IDs leídos desde localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setReadIds(new Set(parsed));
    } catch (e) {
      console.error('Error leyendo notificaciones leídas:', e);
    }
  }, [storageKey]);

  // 👉 Escuchar en tiempo real las solicitudes nuevas/pending
  useEffect(() => {
    const q = query(
      collection(db, 'assignmentRequests'),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((docSnap) => {
          const data = docSnap.data();
          const created =
            data.createdAt?.toDate ? data.createdAt.toDate() : null;

          const requester = data.requesterName || 'Solicitante desconocido';
          const activity = data.activity || 'una actividad';
          const location = data.location || 'sin lugar especificado';

          return {
            id: docSnap.id,
            requester,
            activity,
            location,
            createdAt: created,
          };
        });

        setNotifications((prev) => {
          // Detectar si hay docs nuevos para mostrar notificación del navegador
          const prevIds = new Set(prev.map((n) => n.id));
          const newOnes = items.filter((n) => !prevIds.has(n.id));

          if (
            newOnes.length > 0 &&
            typeof window !== 'undefined' &&
            typeof Notification !== 'undefined' &&
            Notification.permission === 'granted'
          ) {
            newOnes.forEach((n) => {
              new Notification('Nueva solicitud de asignación', {
                body: `${n.requester} solicitó equipo para ${n.activity}`,
              });
            });
          }

          return items;
        });

        setLoading(false);
      },
      (error) => {
        console.error('Error escuchando assignmentRequests:', error);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  // 👉 Guardar leídos en localStorage cuando cambien
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify(Array.from(readIds))
      );
    } catch (e) {
      console.error('Error guardando notificaciones leídas:', e);
    }
  }, [readIds, storageKey]);

  // 🔔 NUEVO: registrar SW de FCM y, si ya hay permiso, obtener token + escuchas
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    let unsubscribeOnMessage = null;

    const initFcmWeb = async () => {
      try {
        // 1️⃣ Registrar service worker de FCM
        const registration = await navigator.serviceWorker.register(
          '/firebase-messaging-sw.js'
        );
        console.log('[FCM] SW registrado:', registration);

        // 2️⃣ Si ya hay permiso concedido, obtener token y guardarlo
        if (
          typeof Notification !== 'undefined' &&
          Notification.permission === 'granted'
        ) {
          const token = await getFcmToken();
          if (token) {
            const tokenRef = doc(db, 'adminPushTokens', token);
            await setDoc(
              tokenRef,
              {
                token,
                role: role || 'admin',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                userAgent:
                  typeof navigator !== 'undefined'
                    ? navigator.userAgent
                    : '',
              },
              { merge: true }
            );
          }

          // 3️⃣ Escuchar mensajes en foreground (de momento sólo log)
          unsubscribeOnMessage = await listenForegroundMessages((payload) => {
            console.log('[FCM] Mensaje en foreground:', payload);
          });
        }
      } catch (err) {
        console.error('[FCM] Error inicializando FCM web:', err);
      }
    };

    initFcmWeb();

    return () => {
      if (typeof unsubscribeOnMessage === 'function') {
        unsubscribeOnMessage();
      }
    };
  }, [role]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !readIds.has(n.id)).length,
    [notifications, readIds]
  );

  const handleMarkAllRead = () => {
    setReadIds(new Set(notifications.map((n) => n.id)));
  };

  // 🔔 Actualizado: ahora también registra el token FCM
  const handleEnableBrowserNotifications = async () => {
    if (typeof Notification === 'undefined') return;

    try {
      const token = await getFcmToken(); // dentro pide permiso si hace falta
      const finalPermission =
        typeof Notification !== 'undefined'
          ? Notification.permission
          : 'default';

      setBrowserPermission(finalPermission);

      if (finalPermission === 'granted' && token) {
        const tokenRef = doc(db, 'adminPushTokens', token);
        await setDoc(
          tokenRef,
          {
            token,
            role: role || 'admin',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            userAgent:
              typeof navigator !== 'undefined' ? navigator.userAgent : '',
          },
          { merge: true }
        );

        new Notification('Notificaciones activadas', {
          body: 'Te avisaremos cuando llegue una nueva solicitud.',
        });
      }
    } catch (e) {
      console.error('Error activando notificaciones de navegador/FCM:', e);
    }
  };

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.95)',
        borderRadius: '16px',
        padding: '12px 16px',
        boxShadow: '0 4px 16px rgba(15,23,42,0.18)',
        border: '1px solid rgba(148,163,184,0.6)',
        fontFamily: "'Inter', system-ui, sans-serif",
        maxWidth: 420,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 6,
          gap: 8,
        }}
      >
        <div>
          <div
            style={{
              fontSize: '0.8rem',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              color: '#6b7280',
            }}
          >
            Notificaciones
          </div>
          <div
            style={{
              fontSize: '0.9rem',
              fontWeight: 600,
              color: '#111827',
            }}
          >
            Rol: {role}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span
            style={{
              minWidth: 26,
              textAlign: 'center',
              padding: '3px 6px',
              borderRadius: 999,
              fontSize: '0.75rem',
              fontWeight: 700,
              backgroundColor:
                unreadCount > 0 ? 'rgba(239,68,68,0.12)' : '#e5e7eb',
              color: unreadCount > 0 ? '#b91c1c' : '#4b5563',
            }}
          >
            {unreadCount}
          </span>
          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={notifications.length === 0 || unreadCount === 0}
            style={{
              border: 'none',
              padding: '4px 8px',
              borderRadius: 999,
              fontSize: '0.7rem',
              fontWeight: 600,
              cursor:
                notifications.length === 0 || unreadCount === 0
                  ? 'default'
                  : 'pointer',
              backgroundColor:
                notifications.length === 0 || unreadCount === 0
                  ? '#e5e7eb'
                  : '#3b82f6',
              color:
                notifications.length === 0 || unreadCount === 0
                  ? '#6b7280'
                  : 'white',
              opacity:
                notifications.length === 0 || unreadCount === 0 ? 0.7 : 1,
            }}
          >
            Marcar todas como leídas
          </button>
        </div>
      </div>

      {/* Activar notificaciones del navegador + FCM */}
      {typeof Notification !== 'undefined' && browserPermission !== 'granted' && (
        <button
          type="button"
          onClick={handleEnableBrowserNotifications}
          style={{
            width: '100%',
            borderRadius: 10,
            border: '1px dashed #3b82f6',
            padding: '6px 8px',
            marginBottom: 8,
            fontSize: '0.75rem',
            backgroundColor: 'rgba(239,246,255,0.9)',
            color: '#1d4ed8',
            cursor: 'pointer',
          }}
        >
          🔔 Activar notificaciones del navegador
        </button>
      )}

      {loading ? (
        <p
          style={{
            fontSize: '0.8rem',
            color: '#6b7280',
            margin: 0,
          }}
        >
          Cargando notificaciones...
        </p>
      ) : notifications.length === 0 ? (
        <p
          style={{
            fontSize: '0.8rem',
            color: '#6b7280',
            margin: 0,
          }}
        >
          No tienes solicitudes en espera.
        </p>
      ) : (
        <div
          style={{
            marginTop: 6,
            maxHeight: 220,
            overflowY: 'auto',
            paddingRight: 4,
          }}
        >
          {notifications.map((n) => {
            const isUnread = !readIds.has(n.id);
            return (
              <div
                key={n.id}
                style={{
                  padding: '6px 6px 8px 6px',
                  borderRadius: 10,
                  marginBottom: 4,
                  backgroundColor: isUnread
                    ? 'rgba(219,234,254,0.9)'
                    : '#f9fafb',
                  border: isUnread
                    ? '1px solid rgba(59,130,246,0.45)'
                    : '1px solid #e5e7eb',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 6,
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: '#111827',
                    }}
                  >
                    {n.requester} envió una solicitud
                  </div>
                </div>
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: '#4b5563',
                    marginTop: 2,
                  }}
                >
                  {n.activity} – {n.location}
                </div>
                <div
                  style={{
                    fontSize: '0.7rem',
                    color: '#6b7280',
                    marginTop: 2,
                  }}
                >
                  {formatDateTime(n.createdAt)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
