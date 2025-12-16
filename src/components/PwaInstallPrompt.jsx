'use client';

import { useEffect, useState } from 'react';

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Solo mostrar si el usuario no lo ha cerrado antes
    const dismissed = window.localStorage.getItem('pwaInstallDismissed');
    if (dismissed === 'true') return;

    const handleBeforeInstall = (e) => {
      // Evitar el banner nativo
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();

    const { outcome } = await deferredPrompt.userChoice;
    console.log('Resultado de instalación PWA:', outcome);

    // Sea que acepte o rechace, no lo volvemos a molestar
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('pwaInstallDismissed', 'true');
    }

    setVisible(false);
    setDeferredPrompt(null);
  };

  const handleClose = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('pwaInstallDismissed', 'true');
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        right: '16px',
        bottom: '16px',
        zIndex: 9999,
        maxWidth: '320px',
        background: 'linear-gradient(135deg, #111827, #1f2937)',
        color: 'white',
        padding: '14px 16px',
        borderRadius: '16px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        fontFamily: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>
          📲 Instalar Gestión de Equipos
        </div>
        <div
          style={{
            fontSize: '0.75rem',
            opacity: 0.85,
            marginTop: 4,
          }}
        >
          Instala la app en tu dispositivo para acceder más rápido al panel.
        </div>
      </div>

      <button
        onClick={handleInstallClick}
        style={{
          background: 'linear-gradient(135deg, #22c55e, #16a34a)',
          border: 'none',
          color: 'white',
          fontSize: '0.8rem',
          fontWeight: 600,
          padding: '8px 10px',
          borderRadius: '999px',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        Instalar
      </button>

      <button
        onClick={handleClose}
        aria-label="Cerrar"
        style={{
          background: 'transparent',
          border: 'none',
          color: '#9ca3af',
          fontSize: '1rem',
          cursor: 'pointer',
          padding: 0,
          marginLeft: 4,
        }}
      >
        ✕
      </button>
    </div>
  );
}
