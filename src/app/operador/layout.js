'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { ensureAuthorizedUser } from '../../lib/userAccess';

import '../admin-styles.css';

export default function OperadorLayout({ children }) {
  const { data: session, status: sessionStatus } = useSession();
  const [status, setStatus] = useState('checking');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let active = true;

    async function validate() {
      try {
        if (sessionStatus === 'loading') return;

        if (sessionStatus === 'unauthenticated') {
          if (active) {
            setStatus('denied');
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
          setStatus('denied');
          await signOut({ redirect: false });
          router.push('/');
          return;
        }

        if (result.role === 'operator') {
          setStatus('allowed');
          return;
        }

        if (result.role === 'admin' || result.role === 'superAdmin') {
          setStatus('denied');
          router.push('/admin');
          return;
        }

        setStatus('denied');
        await signOut({ redirect: false });
        router.push('/');
      } catch (err) {
        console.error('💥 [Operador] Error verificando permisos:', err);
        if (active) {
          setStatus('denied');
          router.push('/');
        }
      }
    }

    validate();
    return () => {
      active = false;
    };
  }, [router, session, sessionStatus]);

  const handleLogout = async () => {
    try {
      await signOut({ callbackUrl: '/' });
    } catch (e) {
      console.error('💥 [Operador] Error al cerrar sesión:', e);
    }
  };

  if (status === 'checking' || sessionStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600 mx-auto" />
          <p className="mt-2 text-xs text-gray-600">Cargando panel de operador...</p>
        </div>
      </div>
    );
  }

  if (status === 'denied') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-xs text-gray-600">Redirigiendo...</p>
      </div>
    );
  }

  const displayName = session?.user?.name || session?.user?.email || 'Operador';
  const initials = displayName
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-3">
          <div className="flex justify-between items-center h-10">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-900">MiningSoft</span>
              <span className="text-xs text-gray-500">| Panel de Operador</span>
            </div>

            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center space-x-1 p-1 rounded hover:bg-gray-100 transition-colors"
              >
                <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-medium">{initials}</span>
                </div>
                <svg
                  className={`w-3 h-3 text-gray-500 transition-transform ${
                    dropdownOpen ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {dropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
                  <div className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50 py-1">
                    <div className="px-3 py-2 border-b border-gray-100">
                      <div className="flex items-center space-x-2">
                        <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs font-medium">{initials}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-900 truncate">{displayName}</p>
                          <p className="text-xs text-gray-500 truncate">{session?.user?.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded">Operador</span>
                        <div className="flex items-center space-x-1">
                          <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                          <span className="text-xs text-gray-500">Online</span>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-gray-100 pt-1">
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center space-x-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                          />
                        </svg>
                        <span>Cerrar sesión</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {children}
    </div>
  );
}
