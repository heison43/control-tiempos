'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '../../firebaseConfig';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

export default function OperadorLayout({ children }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.email));

        if (userDoc.exists()) {
          const userData = userDoc.data();

          if (userData.role === 'operador' && userData.isActive !== false) {
            setUser(user);
            setLoading(false);
          } else {
            console.log('❌ Usuario no es operador, redirigiendo a /admin');
            router.push('/admin');
          }
        } else {
          console.log('❌ Usuario no autorizado en Firestore');
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto" />
          <p className="mt-2 text-xs text-gray-600">Verificando permisos de operador...</p>
        </div>
      </div>
    );
  }

  const initials = (user?.displayName || user?.email || 'OP')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* HEADER SUPER SIMPLE Y BONITO */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3">
          <div className="flex h-12 items-center justify-between">
            {/* IZQUIERDA: MS | MiningSoft | Panel de Operador */}
         

            {/* DERECHA: info usuario + botón salir */}
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-xs font-medium text-gray-900 max-w-[220px] truncate">
                  {user?.email}
                </span>
                <span className="text-[11px] font-semibold text-emerald-600">
                  Operador
                </span>
              </div>

              {/* Avatar pequeño (se ve en móvil y también de apoyo en escritorio) */}
              <div className="flex sm:hidden items-center justify-center w-7 h-7 rounded-full bg-emerald-500 text-[11px] font-semibold text-white">
                {initials}
              </div>

              <button
                onClick={handleLogout}
                className="text-xs font-medium text-white bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-md transition-colors"
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main className="max-w-7xl mx-auto px-3 py-4">
        {children}
      </main>
    </div>
  );
}

