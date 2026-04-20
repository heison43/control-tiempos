'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, signOut, useSession } from 'next-auth/react';
import { ensureAuthorizedUser } from '../lib/userAccess';

export default function HomePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function resolveAccess() {
      try {
        if (status === 'loading') return;

        if (status === 'unauthenticated') {
          if (isMounted) setChecking(false);
          return;
        }

        const email = session?.user?.email;
        const name = session?.user?.name;
        const result = await ensureAuthorizedUser({ email, name });

        if (!isMounted) return;

        if (!result.ok) {
          setError('Tu usuario no está autorizado en el sistema.');
          await signOut({ redirect: false });
          setChecking(false);
          return;
        }

        if (result.role === 'admin' || result.role === 'superAdmin') {
          router.push('/admin');
          return;
        }

        if (result.role === 'operator') {
          router.push('/operador');
          return;
        }

        setError('No tienes permisos para ingresar al sistema.');
        await signOut({ redirect: false });
        setChecking(false);
      } catch (e) {
        console.error('Error verificando sesión:', e);
        if (isMounted) {
          setError('Ocurrió un error al validar tu usuario.');
          setChecking(false);
        }
      }
    }

    resolveAccess();

    return () => {
      isMounted = false;
    };
  }, [router, session, status]);

  const handleMicrosoftLogin = async () => {
    try {
      setError('');
      await signIn('azure-ad', {
        callbackUrl: '/',
      });
    } catch (e) {
      console.error('Error en login Microsoft:', e);
      setError('No se pudo iniciar sesión con Microsoft. Intenta de nuevo.');
    }
  };

  if (checking || status === 'loading') {
    return (
      <div className="login-page">
        <div className="login-loading">
          <div className="spinner" />
          <p>Verificando sesión...</p>
        </div>

        <style jsx>{`
          .login-page {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: radial-gradient(circle at top left, #4f46e5 0, transparent 55%),
              radial-gradient(circle at bottom right, #0ea5e9 0, transparent 55%),
              #020617;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI',
              sans-serif;
            color: #f9fafb;
          }
          .login-loading {
            text-align: center;
            font-size: 0.9rem;
            color: #e5e7eb;
          }
          .spinner {
            width: 32px;
            height: 32px;
            border-radius: 999px;
            border: 3px solid rgba(148, 163, 184, 0.4);
            border-top-color: #38bdf8;
            animation: spin 0.8s linear infinite;
            margin: 0 auto 8px;
          }
          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="login-icon">
            <span>⏱️</span>
          </div>
          <h1>Gestión de Equipos</h1>
          <p>Ingreso corporativo con cuenta Microsoft</p>
        </div>

        <div className="login-actions">
          <button className="btn btn-primary" onClick={handleMicrosoftLogin}>
            Continuar con Microsoft
          </button>
        </div>

        {error && <p className="login-error">{error}</p>}

        <div className="login-footer">
          <p>
            Acceso exclusivo para personal autorizado.
            <br />
            El portal de solicitudes corporativo está disponible en:{' '}
            <span className="login-link">/solicitudes</span>
          </p>
          <p className="login-copy">© 2026 Gestión de Equipos • v1.1</p>
        </div>
      </div>

      <style jsx>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          background: radial-gradient(circle at top left, #4f46e5 0, transparent 55%),
            radial-gradient(circle at bottom right, #0ea5e9 0, transparent 55%),
            #020617;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI',
            sans-serif;
          color: #f9fafb;
        }

        .login-card {
          width: 100%;
          max-width: 420px;
          background: rgba(15, 23, 42, 0.96);
          border-radius: 20px;
          padding: 20px 22px 18px;
          box-shadow: 0 24px 60px rgba(15, 23, 42, 0.9);
          border: 1px solid rgba(148, 163, 184, 0.4);
          backdrop-filter: blur(18px);
          overflow: hidden;
        }

        .login-header {
          text-align: center;
          margin-bottom: 18px;
        }

        .login-icon {
          width: 52px;
          height: 52px;
          border-radius: 16px;
          margin: 0 auto 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #2563eb, #0ea5e9);
          box-shadow: 0 10px 25px rgba(37, 99, 235, 0.55);
          font-size: 26px;
        }

        .login-header h1 {
          font-size: 1.4rem;
          font-weight: 700;
          letter-spacing: 0.03em;
          color: #f9fafb;
          margin: 0;
        }

        .login-header p {
          margin-top: 4px;
          font-size: 0.85rem;
          color: #cbd5f5;
        }

        .login-actions {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 12px;
        }

        .btn {
          width: 100%;
          border-radius: 999px;
          padding: 10px 14px;
          font-size: 0.95rem;
          font-weight: 600;
          border: none;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.08s ease, box-shadow 0.15s ease,
            background 0.15s ease, color 0.15s ease;
        }

        .btn-primary {
          background: linear-gradient(135deg, #2563eb, #0ea5e9);
          color: #f9fafb;
          box-shadow: 0 12px 30px rgba(37, 99, 235, 0.55);
        }

        .btn-primary:hover {
          transform: translateY(-1px);
        }

        .login-error {
          margin: 0 0 12px;
          padding: 10px 12px;
          border-radius: 12px;
          background: rgba(127, 29, 29, 0.32);
          border: 1px solid rgba(248, 113, 113, 0.4);
          color: #fecaca;
          font-size: 0.85rem;
          text-align: center;
        }

        .login-footer {
          margin-top: 14px;
          text-align: center;
          font-size: 0.78rem;
          color: #cbd5e1;
          line-height: 1.55;
        }

        .login-link {
          color: #7dd3fc;
          font-weight: 600;
        }

        .login-copy {
          margin-top: 8px;
          opacity: 0.75;
        }
      `}</style>
    </div>
  );
}
