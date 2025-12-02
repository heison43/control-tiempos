'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '../../firebaseConfig';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

import '../admin-styles.css';

export default function AdminLayout({ children }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.email));

        if (userDoc.exists()) {
          const userData = userDoc.data();

          if (userData.role === 'admin' && userData.isActive !== false) {
            setUser(user);
            setLoading(false);
          } else {
            router.push('/operador');
          }
        } else {
          await signOut(auth);
          router.push('/');
        }
      } else {
        router.push('/');
      }
    });

    return unsubscribe;
  }, [router]);

  const handleLogout = async () => {
    await signOut(auth);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-xs text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  const initials = (user?.displayName || user?.email || 'A')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Super Compacto - Estilo Chino */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-3">
          <div className="flex justify-between items-center h-10"> {/* h-10 es muy pequeño */}
            
            {/* Logo Minimalista */}
            <div className="flex items-center space-x-2">
    
              <span className="text-sm font-medium text-gray-900">MiningSoft</span>
            </div>

            {/* Botón de Usuario Super Compacto */}
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center space-x-1 p-1 rounded hover:bg-gray-100 transition-colors"
              >
                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-medium">{initials}</span>
                </div>
                <svg 
                  className={`w-3 h-3 text-gray-500 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Compacto - Se abre hacia abajo a la izquierda */}
              {dropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setDropdownOpen(false)}
                  />
                  <div className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50 py-1">
                    
                    {/* Información Mínima del Usuario */}
                    <div className="px-3 py-2 border-b border-gray-100">
                      <div className="flex items-center space-x-2">
                        <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs font-medium">{initials}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-900 truncate">
                            {user?.displayName || 'Admin'}
                          </p>
                          <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">Admin</span>
                        <div className="flex items-center space-x-1">
                          <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                          <span className="text-xs text-gray-500">Online</span>
                        </div>
                      </div>
                    </div>

                    
                   

                    {/* Cerrar Sesión */}
                    <div className="border-t border-gray-100 pt-1">
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center space-x-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        <span>Cerrar Sesión</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="max-w-7xl mx-auto px-3 py-4">
        {children}
      </main>
    </div>
  );
}