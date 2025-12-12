'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '../../firebaseConfig';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

// 👇 IMPORTAMOS LOS MISMOS ESTILOS QUE EN ADMIN
import '../admin-styles.css';

export default function OperadorLayout({ children }) {
  const [status, setStatus] = useState('checking'); // 'checking' | 'allowed' | 'denied'
  const [user, setUser] = useState(null);
  const [userMeta, setUserMeta] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      try {
        if (!currentUser) {
          setStatus('denied');
          router.push('/');
          return;
        }

        const userRef = doc(db, 'users', currentUser.email);
        const snap = await getDoc(userRef);

        if (!snap.exists()) {
          setStatus('denied');
          await signOut(auth);
          router.push('/');
          return;
        }

        const data = snap.data();
        setUserMeta(data);

        // ✅ Operador válido
        if (data.role === 'operator' && data.isActive !== false) {
          setUser(currentUser);
          setStatus('allowed');
          return;
        }

        // Si es admin / superAdmin lo mandamos a /admin
        if (
          (data.role === 'admin' || data.role === 'superAdmin') &&
          data.isActive !== false
        ) {
          setStatus('denied');
          router.push('/admin');
          return;
        }

        // Cualquier otro caso
        setStatus('denied');
        await signOut(auth);
        router.push('/');
      } catch (err) {
        console.error('💥 [Operador] Error verificando permisos:', err);
        setStatus('denied');
        router.push('/');
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error('💥 [Operador] Error al cerrar sesión:', e);
    }
  };

  if (status === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600 mx-auto" />
          <p className="mt-2 text-xs text-gray-600">
            Cargando panel de operador...
          </p>
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

  // status === 'allowed'
  const initials = (user?.displayName || user?.email || 'OP')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const roleLabel = 'Operador';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 🔹 HEADER IGUAL DE PRO QUE EL DE ADMIN, PERO PARA OPERADOR */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-3">
          <div className="flex justify-between items-center h-10">
            {/* Logo / texto izquierdos */}
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-900">MiningSoft</span>
              <span className="text-xs text-gray-500">| Panel de Operador</span>
            </div>

            {/* Botón usuario + dropdown */}
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center space-x-1 p-1 rounded hover:bg-gray-100 transition-colors"
              >
                <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-medium">
                    {initials}
                  </span>
                </div>
                <svg
                  className={`w-3 h-3 text-gray-500 transition-transform ${
                    dropdownOpen ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {dropdownOpen && (
                <>
                  {/* overlay para cerrar al hacer click fuera */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setDropdownOpen(false)}
                  />
                  <div className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50 py-1">
                    {/* Info del operador */}
                    <div className="px-3 py-2 border-b border-gray-100">
                      <div className="flex items-center space-x-2">
                        <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs font-medium">
                            {initials}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-900 truncate">
                            {user?.displayName || 'Operador'}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {user?.email}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded">
                          {roleLabel}
                        </span>
                        <div className="flex items-center space-x-1">
                          <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                          <span className="text-xs text-gray-500">Online</span>
                        </div>
                      </div>
                    </div>

                    {/* Botón cerrar sesión */}
                    <div className="border-t border-gray-100 pt-1">
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center space-x-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
                      >
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
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

      {/* Contenido principal: tu panel morado de operador */}
      <main className="max-w-7xl mx-auto px-3 py-4">{children}</main>
    </div>
  );
}
