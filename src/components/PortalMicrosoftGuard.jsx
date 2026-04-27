'use client';

import { signIn, useSession } from 'next-auth/react';

export default function PortalMicrosoftGuard({ children, callbackUrl = '/solicitudes' }) {
  const { status } = useSession();

  if (status === 'loading') {
    return (
      <div className="portal-auth-page">
        <div className="portal-auth-card">
          <div className="portal-spinner" />
          <h2>Verificando acceso corporativo...</h2>
          <p>Espera un momento mientras validamos tu sesión con Microsoft.</p>
        </div>
        <style jsx>{`
          .portal-auth-page {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
            background: radial-gradient(circle at top left, #4f46e5 0, transparent 55%),
              radial-gradient(circle at bottom right, #0ea5e9 0, transparent 55%),
              #020617;
          }
          .portal-auth-card {
            width: 100%;
            max-width: 460px;
            background: rgba(15, 23, 42, 0.96);
            border-radius: 22px;
            padding: 28px 24px;
            border: 1px solid rgba(148, 163, 184, 0.35);
            box-shadow: 0 24px 60px rgba(15, 23, 42, 0.9);
            text-align: center;
            color: #f8fafc;
          }
          .portal-spinner {
            width: 34px;
            height: 34px;
            border-radius: 999px;
            border: 3px solid rgba(148, 163, 184, 0.35);
            border-top-color: #38bdf8;
            animation: spin 0.8s linear infinite;
            margin: 0 auto 12px;
          }
          h2 { margin: 0 0 8px; font-size: 1.2rem; }
          p { margin: 0; color: #cbd5e1; }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="portal-auth-page">
        <div className="portal-auth-card">
          <div className="portal-icon">🔐</div>
          <h1>Portal corporativo de solicitudes</h1>
          <p>
            Para ingresar a este módulo debes autenticarte con tu cuenta Microsoft
            corporativa.
          </p>
          <button
            className="portal-auth-btn"
            onClick={() => signIn('azure-ad', { callbackUrl })}
          >
            Continuar con Microsoft
          </button>
        </div>
        <style jsx>{`
          .portal-auth-page {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
            background: radial-gradient(circle at top left, #4f46e5 0, transparent 55%),
              radial-gradient(circle at bottom right, #0ea5e9 0, transparent 55%),
              #020617;
          }
          .portal-auth-card {
            width: 100%;
            max-width: 520px;
            background: rgba(15, 23, 42, 0.96);
            border-radius: 22px;
            padding: 30px 24px;
            border: 1px solid rgba(148, 163, 184, 0.35);
            box-shadow: 0 24px 60px rgba(15, 23, 42, 0.9);
            text-align: center;
            color: #f8fafc;
          }
          .portal-icon {
            width: 56px;
            height: 56px;
            margin: 0 auto 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 18px;
            background: linear-gradient(135deg, #2563eb, #0ea5e9);
            font-size: 28px;
            box-shadow: 0 12px 26px rgba(37, 99, 235, 0.45);
          }
          h1 { margin: 0 0 10px; font-size: 1.45rem; }
          p { margin: 0; color: #cbd5e1; line-height: 1.5; }
          .portal-auth-btn {
            margin-top: 18px;
            width: 100%;
            border: none;
            border-radius: 999px;
            padding: 14px 18px;
            font-size: 0.95rem;
            font-weight: 700;
            color: white;
            cursor: pointer;
            background: linear-gradient(135deg, #2563eb, #0ea5e9);
            box-shadow: 0 14px 26px rgba(14, 165, 233, 0.28);
          }
        `}</style>
      </div>
    );
  }

  return children;
}
