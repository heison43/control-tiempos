'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { ensureAuthorizedUser } from '../../lib/userAccess';

export default function HistorialLayout({ children }) {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const [accessStatus, setAccessStatus] = useState('checking');

  useEffect(() => {
    let active = true;

    async function validateAccess() {
      try {
        if (sessionStatus === 'loading') return;

        if (sessionStatus === 'unauthenticated') {
          if (active) {
            setAccessStatus('denied');
            router.push('/');
          }
          return;
        }

        const result = await ensureAuthorizedUser({
          email: session?.user?.email,
          name: session?.user?.name,
        });

        if (!active) return;

        if (!result.ok) {
          setAccessStatus('denied');
          await signOut({ redirect: false });
          router.push('/');
          return;
        }

        if (result.role === 'admin' || result.role === 'superAdmin') {
          setAccessStatus('allowed');
          return;
        }

        if (result.role === 'operator') {
          setAccessStatus('denied');
          router.push('/operador');
          return;
        }

        setAccessStatus('denied');
        await signOut({ redirect: false });
        router.push('/');
      } catch (error) {
        console.error('💥 [Historial] Error validando acceso:', error);
        if (active) {
          setAccessStatus('denied');
          router.push('/');
        }
      }
    }

    validateAccess();

    return () => {
      active = false;
    };
  }, [router, session, sessionStatus]);

  if (accessStatus === 'checking' || sessionStatus === 'loading') {
    return (
      <div style={styles.wrapper}>
        <div style={styles.card}>
          <div style={styles.spinner} />
          <p style={styles.text}>Validando acceso al historial...</p>
        </div>
      </div>
    );
  }

  if (accessStatus === 'denied') {
    return (
      <div style={styles.wrapper}>
        <div style={styles.card}>
          <p style={styles.text}>Redirigiendo...</p>
        </div>
      </div>
    );
  }

  return children;
}

const styles = {
  wrapper: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f8fafc',
  },
  card: {
    padding: '24px 28px',
    borderRadius: 16,
    background: 'white',
    boxShadow: '0 10px 30px rgba(15,23,42,0.08)',
    textAlign: 'center',
  },
  spinner: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    border: '3px solid #cbd5e1',
    borderTopColor: '#2563eb',
    animation: 'spin 1s linear infinite',
    margin: '0 auto 10px',
  },
  text: {
    margin: 0,
    color: '#475569',
    fontSize: '0.95rem',
  },
};
