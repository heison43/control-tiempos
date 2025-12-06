'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '../../firebaseConfig';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

export default function OperadorLayout({ children }) {
  const [status, setStatus] = useState('checking'); // 'checking' | 'allowed' | 'denied'
  const [user, setUser] = useState(null);
  const router = useRouter();

  useEffect(() => {
    console.log('👀 OperadorLayout montado, verificando usuario...');

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      try {
        if (!currentUser) {
          console.log('🔒 [Operador] No hay usuario autenticado, redirigiendo a /');
          setStatus('denied');
          router.push('/');
          return;
        }

        console.log('👤 [Operador] Usuario autenticado:', currentUser.email);

        const userRef = doc(db, 'users', currentUser.email);
        const snap = await getDoc(userRef);

        if (!snap.exists()) {
          console.log('❌ [Operador] Documento de usuario no existe en Firestore');
          setStatus('denied');
          await signOut(auth);
          router.push('/');
          return;
        }

        const data = snap.data();
        console.log('📄 [Operador] Datos usuario:', data);

        // ⚠️ IMPORTANTE: el rol es 'operator' (en inglés)
        if (data.role === 'operator' && data.isActive !== false) {
          console.log('✅ [Operador] Usuario autorizado como OPERATOR');
          setUser(currentUser);
          setStatus('allowed');
          return;
        }

        // Si es admin, lo mandamos a /admin
        if (data.role === 'admin' && data.isActive !== false) {
          console.log('➡️ [Operador] Usuario es ADMIN, redirigiendo a /admin');
          setStatus('denied');
          router.push('/admin');
          return;
        }

        console.log('🚫 [Operador] Usuario sin rol válido o inactivo');
        setStatus('denied');
        await signOut(auth);
        router.push('/');
      } catch (err) {
        console.error('💥 [Operador] Error verificando permisos:', err);
        setStatus('denied');
        router.push('/');
      }
    });

    return () => {
      console.log('🧹 [Operador] Limpiando listener');
      unsubscribe();
    };
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto" />
          <p className="mt-2 text-xs text-gray-600">Verificando permisos de operador...</p>
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* HEADER SUPER SIMPLE Y BONITO */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3">
          <div className="flex h-12 items-center justify-between">
            {/* (Si quieres, aquí puedes volver a poner el título "Panel de Operador") */}

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

              {/* Avatar pequeño */}
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


