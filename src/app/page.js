'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '../firebaseConfig';
import {
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

const provider = new GoogleAuthProvider();

export default function HomePage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');

  // Si ya hay sesión, redirigimos a admin u operador
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      try {
        if (!user) {
          setChecking(false);
          return;
        }

        const ref = doc(db, 'users', user.email);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          setError('Tu usuario no está registrado en el sistema.');
          await signOut(auth);
          setChecking(false);
          return;
        }

        const data = snap.data();

        if (data.isActive === false) {
          setError('Tu usuario está inactivo. Consulta con el administrador.');
          await signOut(auth);
          setChecking(false);
          return;
        }

        if (data.role === 'admin' || data.role === 'superAdmin') {
          router.push('/admin');
          return;
        }

        if (data.role === 'operator') {
          router.push('/operador');
          return;
        }

        setError('No tienes permisos para ingresar al sistema.');
        await signOut(auth);
        setChecking(false);
      } catch (e) {
        console.error('Error verificando sesión:', e);
        setError('Ocurrió un error al validar tu usuario.');
        setChecking(false);
      }
    });

    return () => unsub();
  }, [router]);

  const handleGoogleLogin = async (forceSelect = false) => {
    try {
      setError('');
      provider.setCustomParameters(
        forceSelect ? { prompt: 'select_account' } : {}
      );
      await signInWithPopup(auth, provider);
      // el onAuthStateChanged se encarga del redirect
    } catch (e) {
      console.error('Error en login Google:', e);
      setError('No se pudo iniciar sesión. Intenta de nuevo.');
    }
  };

  // Mientras valida sesión
  if (checking) {
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
          <h1>Control de Tiempos</h1>
          <p>Sistema de control para equipos, operadores y solicitudes.</p>
        </div>

        <div className="login-actions">
          <button
            className="btn btn-primary"
            onClick={() => handleGoogleLogin(false)}
          >
            Continuar con Google
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => handleGoogleLogin(true)}
          >
            Usar otra cuenta
          </button>
        </div>

        {error && <p className="login-error">{error}</p>}

        <div className="login-footer">
          <p>
            Acceso exclusivo para personal autorizado.
            <br />
            El portal de solicitudes público está disponible en:{' '}
            <span className="login-link">/solicitudes</span>
          </p>
          <p className="login-copy">© 2025 Control de Tiempos • v1.0</p>
        </div>
      </div>

      {/* ESTILOS SOLO PARA ESTA PANTALLA */}
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
          background: rgba(15, 23, 42, 0.96); /* 👈 TODO oscuro, sin bloque blanco */
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
          background: transparent; /* 👈 sin fondo blanco */
        }

        .login-icon {
          width: 52px;
          height: 52px;
          border-radius: 16px;
          margin: 0 auto 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #4f46e5, #38bdf8);
          box-shadow: 0 10px 25px rgba(59, 130, 246, 0.6);
          font-size: 26px;
        }

        .login-header h1 {
          font-size: 1.4rem;
          font-weight: 700;
          letter-spacing: 0.03em;
          color: #f9fafb; /* 👈 bien visible sobre oscuro */
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
          padding: 8px 14px;
          font-size: 0.9rem;
          font-weight: 500;
          border: none;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.08s ease, box-shadow 0.15s ease,
            background 0.15s ease, color 0.15s ease;
          white-space: nowrap;
        }

        .btn-primary {
          background: linear-gradient(135deg, #4f46e5, #38bdf8);
          color: #f9fafb;
          box-shadow: 0 12px 30px rgba(59, 130, 246, 0.55);
        }

        .btn-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 14px 40px rgba(56, 189, 248, 0.65);
        }

        .btn-secondary {
          background: transparent;
          color: #e5e7eb;
          border: 1px solid rgba(148, 163, 184, 0.7);
        }

        .btn-secondary:hover {
          background: rgba(15, 23, 42, 0.9);
        }

        .login-error {
          margin-top: 6px;
          padding: 6px 8px;
          border-radius: 10px;
          background: rgba(220, 38, 38, 0.1);
          border: 1px solid rgba(248, 113, 113, 0.7);
          font-size: 0.8rem;
          color: #fecaca;
          text-align: center;
        }

        .login-footer {
          margin-top: 10px;
          border-top: 1px dashed rgba(148, 163, 184, 0.5);
          padding-top: 8px;
          font-size: 0.78rem;
          color: #9ca3af;
          text-align: center;
        }

        .login-link {
          color: #e0f2fe;
          font-weight: 600;
        }

        .login-copy {
          margin-top: 6px;
          font-size: 0.75rem;
          color: #6b7280;
        }

        @media (max-width: 480px) {
          .login-card {
            padding: 18px 16px 16px;
          }

          .login-header h1 {
            font-size: 1.2rem;
          }
        }
      `}</style>
    </div>
  );
}
