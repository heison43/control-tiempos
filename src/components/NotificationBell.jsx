'use client';

import { useEffect, useRef, useState } from 'react';

function formatDate(value) {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleString('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export default function NotificationBell({ embedded = false }) {
  const buttonRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [panelPosition, setPanelPosition] = useState({
    top: 80,
    left: 20,
  });

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  function updatePanelPosition() {
    if (!buttonRef.current) return;

    const rect = buttonRef.current.getBoundingClientRect();
    const panelWidth = 390;
    const margin = 16;

    let left = rect.left;
    let top = rect.bottom + 10;

    if (left + panelWidth > window.innerWidth - margin) {
      left = window.innerWidth - panelWidth - margin;
    }

    if (left < margin) {
      left = margin;
    }

    setPanelPosition({
      top,
      left,
    });
  }

  async function loadNotifications() {
    try {
      setLoading(true);

      const response = await fetch('/api/notifications', {
        cache: 'no-store',
      });

      const data = await response.json();

      if (data.ok) {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error('Error cargando notificaciones:', error);
    } finally {
      setLoading(false);
    }
  }

  async function markAsRead(id) {
    try {
      await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      await loadNotifications();
    } catch (error) {
      console.error('Error marcando notificación:', error);
    }
  }

  async function markAllAsRead() {
    try {
      await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      await loadNotifications();
    } catch (error) {
      console.error('Error marcando todas:', error);
    }
  }

  function handleToggle() {
    updatePanelPosition();
    setOpen((prev) => !prev);
  }

  useEffect(() => {
    loadNotifications();

    const interval = setInterval(() => {
      loadNotifications();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!open) return;

    updatePanelPosition();

    const handleResize = () => updatePanelPosition();
    const handleScroll = () => updatePanelPosition();

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [open]);

  return (
    <div style={embedded ? styles.inlineWrapper : styles.floatingWrapper}>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        style={embedded ? styles.inlineButton : styles.floatingButton}
        title="Notificaciones"
      >
        <span style={styles.icon}>🔔</span>

        <span style={embedded ? styles.inlineText : styles.hiddenText}>
          Ver notificaciones
        </span>

        {unreadCount > 0 && (
          <span style={styles.badge}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
  <div style={embedded ? styles.embeddedPanel : styles.panel}>
    <div style={styles.header}>
      <div>
        <h3 style={styles.title}>Notificaciones</h3>
        <p style={styles.subtitle}>
          {unreadCount > 0
            ? `${unreadCount} pendiente${unreadCount !== 1 ? 's' : ''}`
            : 'Sin pendientes'}
        </p>
      </div>

      {unreadCount > 0 && (
        <button type="button" onClick={markAllAsRead} style={styles.markAll}>
          Marcar leídas
        </button>
      )}
    </div>

    <div style={styles.body}>
      {loading ? (
        <p style={styles.empty}>Cargando...</p>
      ) : notifications.length === 0 ? (
        <p style={styles.empty}>No tienes notificaciones.</p>
      ) : (
        notifications.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => markAsRead(item.id)}
            style={{
              ...styles.item,
              ...(item.is_read ? styles.itemRead : styles.itemUnread),
            }}
          >
            <div style={styles.itemTop}>
              <strong style={styles.itemTitle}>{item.title}</strong>
              {!item.is_read && <span style={styles.dot} />}
            </div>

            <p style={styles.message}>{item.message}</p>

            <span style={styles.date}>{formatDate(item.created_at)}</span>
          </button>
        ))
      )}
    </div>
  </div>
)}
    </div>
  );
}

const styles = {
  floatingWrapper: {
    position: 'fixed',
    top: 18,
    right: 18,
    zIndex: 99999,
  },

  inlineWrapper: {
  position: 'relative',
  display: 'block',
  width: '100%',
  maxWidth: 520,
  zIndex: 1,
},

embeddedPanel: {
  position: 'relative',
  width: '100%',
  marginTop: 12,
  background: 'rgba(255,255,255,0.99)',
  borderRadius: 18,
  boxShadow: '0 18px 45px rgba(15,23,42,0.18)',
  border: '1px solid rgba(15,23,42,0.08)',
  overflow: 'hidden',
  zIndex: 5,
},

panel: {
  position: 'fixed',
  width: 390,
  maxWidth: 'calc(100vw - 32px)',
  background: 'rgba(255,255,255,0.99)',
  borderRadius: 18,
  boxShadow: '0 30px 90px rgba(15,23,42,0.38)',
  border: '1px solid rgba(15,23,42,0.08)',
  overflow: 'hidden',
  zIndex: 2147483647,
},

  floatingButton: {
    position: 'relative',
    width: 46,
    height: 46,
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.45)',
    background: 'rgba(15,23,42,0.88)',
    color: '#fff',
    fontSize: 20,
    cursor: 'pointer',
    boxShadow: '0 14px 35px rgba(15,23,42,0.28)',
    backdropFilter: 'blur(14px)',
  },

  inlineButton: {
    position: 'relative',
    width: '100%',
    borderRadius: 16,
    border: '1px solid rgba(37,99,235,0.22)',
    background: 'linear-gradient(135deg, #2563eb, #06b6d4)',
    color: '#fff',
    padding: '12px 16px',
    fontSize: 14,
    fontWeight: 900,
    cursor: 'pointer',
    boxShadow: '0 14px 28px rgba(37,99,235,0.22)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  icon: {
    fontSize: 18,
  },

  inlineText: {
    display: 'inline',
  },

  hiddenText: {
    display: 'none',
  },

  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 22,
    height: 22,
    borderRadius: 999,
    background: '#ef4444',
    color: '#fff',
    fontSize: 11,
    fontWeight: 900,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 6px',
    border: '2px solid #fff',
  },

  panel: {
    position: 'fixed',
    width: 390,
    maxWidth: 'calc(100vw - 32px)',
    background: 'rgba(255,255,255,0.99)',
    borderRadius: 18,
    boxShadow: '0 30px 90px rgba(15,23,42,0.38)',
    border: '1px solid rgba(15,23,42,0.08)',
    overflow: 'hidden',
    zIndex: 2147483647,
  },

  header: {
    padding: 16,
    borderBottom: '1px solid rgba(15,23,42,0.08)',
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
  },

  title: {
    margin: 0,
    fontSize: 16,
    fontWeight: 900,
    color: '#0f172a',
  },

  subtitle: {
    margin: '4px 0 0',
    fontSize: 12,
    color: '#64748b',
    fontWeight: 700,
  },

  markAll: {
    border: 'none',
    background: '#eef2ff',
    color: '#4338ca',
    borderRadius: 999,
    padding: '7px 10px',
    fontSize: 12,
    fontWeight: 800,
    cursor: 'pointer',
  },

  body: {
    maxHeight: 430,
    overflowY: 'auto',
  },

  empty: {
    padding: 18,
    margin: 0,
    color: '#64748b',
    fontSize: 14,
    textAlign: 'center',
  },

  item: {
    width: '100%',
    textAlign: 'left',
    border: 'none',
    borderBottom: '1px solid rgba(15,23,42,0.06)',
    padding: 14,
    cursor: 'pointer',
  },

  itemUnread: {
    background: '#f8fafc',
  },

  itemRead: {
    background: '#fff',
    opacity: 0.78,
  },

  itemTop: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 8,
    alignItems: 'center',
  },

  itemTitle: {
    color: '#0f172a',
    fontSize: 13,
  },

  dot: {
    width: 9,
    height: 9,
    borderRadius: 999,
    background: '#2563eb',
    flexShrink: 0,
  },

  message: {
    margin: '6px 0',
    fontSize: 13,
    color: '#334155',
    lineHeight: 1.35,
  },

  date: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: 700,
  },
};