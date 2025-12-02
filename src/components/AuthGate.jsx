'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { auth, provider, db } from '../firebaseConfig';
import { signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

export default function AuthGate({ children }) {
  const [loading, setLoading] = useState(true);
  const [showAccountChooser, setShowAccountChooser] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // Verificar autorización del usuario
  const checkUserAuthorization = async (user) => {
    if (!user?.email) {
      console.log('❌ No hay email de usuario');
      return false;
    }
    
    try {
      console.log('🔍 Verificando usuario:', user.email);
      const userDoc = await getDoc(doc(db, 'users', user.email));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        console.log('✅ Usuario encontrado:', userData);
        
        // Verificar que esté activo y tenga rol
        if (userData.isActive !== false && userData.role) {
          console.log('🎯 Usuario autorizado, rol:', userData.role);
          return userData.role;
        }
      }
      console.log('❌ Usuario no autorizado o no encontrado');
      return false;
    } catch (error) {
      console.error('💥 Error verificando autorización:', error);
      return false;
    }
  };

  // Manejar login con Google (cuenta predeterminada)
  const handleGoogleLogin = async () => {
    console.log('🚀 Iniciando login con cuenta predeterminada...');
    try {
      const result = await signInWithPopup(auth, provider);
      console.log('✅ Login exitoso:', result.user.email);
      
      const role = await checkUserAuthorization(result.user);
      
      if (role) {
        console.log('🎉 Redirigiendo a:', role);
        router.push(role === 'admin' ? '/admin' : '/operador');
      } else {
        console.log('🚫 Usuario no autorizado, cerrando sesión');
        await signOut(auth);
        alert('Tu cuenta no está autorizada. Contacta al administrador.');
      }
    } catch (error) {
      console.error('💥 Error en login:', error);
      alert('Error al iniciar sesión. Intenta nuevamente.');
    }
  };

  // Manejar login con selección de cuenta
  const handleGoogleLoginWithAccountChooser = async () => {
    console.log('🚀 Iniciando login con selector de cuenta...');
    try {
      // Configurar el provider para forzar la selección de cuenta
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      
      const result = await signInWithPopup(auth, provider);
      console.log('✅ Login exitoso:', result.user.email);
      
      const role = await checkUserAuthorization(result.user);
      
      if (role) {
        console.log('🎉 Redirigiendo a:', role);
        router.push(role === 'admin' ? '/admin' : '/operador');
      } else {
        console.log('🚫 Usuario no autorizado, cerrando sesión');
        await signOut(auth);
        alert('Tu cuenta no está autorizada. Contacta al administrador.');
      }
    } catch (error) {
      console.error('💥 Error en login:', error);
      alert('Error al iniciar sesión. Intenta nuevamente.');
    }
  };

  // Efecto principal - escuchar cambios de autenticación
  useEffect(() => {
    console.log('🔧 Iniciando AuthGate...');
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('🔄 Cambio de estado auth:', user ? user.email : 'No user');
      
      if (user) {
        const role = await checkUserAuthorization(user);
        
        if (role) {
          console.log('✅ Usuario autenticado y autorizado');
          // Redirigir si está en la página principal
          if (pathname === '/') {
            router.push(role === 'admin' ? '/admin' : '/operador');
          }
        } else {
          console.log('🚫 Usuario no autorizado, cerrando sesión');
          await signOut(auth);
        }
      } else {
        console.log('👤 No hay usuario autenticado');
      }
      
      setLoading(false);
    });

    return () => {
      console.log('🧹 Limpiando AuthGate');
      unsubscribe();
    };
  }, [router, pathname]);

  // Mostrar loading
  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-dots">
          <div className="loading-dot"></div>
          <div className="loading-dot"></div>
          <div className="loading-dot"></div>
        </div>
      </div>
    );
  }

  // Si no hay usuario, mostrar pantalla de login
  if (!auth.currentUser) {
    return (
      <div className="login-container">
        <div className="login-card">
          {/* Header */}
          <div className="login-header">
            <div className="login-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            <h1 className="login-title">Control de Tiempos</h1>
            <p className="login-subtitle">Sistema de control</p>
          </div>

          {/* Contenido */}
          <div className="login-content">
            <h2 className="login-form-title">Iniciar Sesión</h2>
            <p className="login-form-subtitle">Accede con tu cuenta de acceso</p>
            
            {/* Botón principal - Cuenta predeterminada */}
            <button className="google-login-btn" onClick={handleGoogleLogin}>
              <svg className="google-icon" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continuar con Google
            </button>

            {/* Separador */}
            <div className="flex items-center my-6">
              <div className="flex-1 border-t border-gray-300"></div>
              <span className="px-3 text-sm text-gray-500">o</span>
              <div className="flex-1 border-t border-gray-300"></div>
            </div>

            {/* Botón secundario - Seleccionar cuenta */}
            <button 
              className="google-login-btn"
              onClick={handleGoogleLoginWithAccountChooser}
              style={{
                background: '#f8fafc',
                border: '1px solid #d1d5db'
              }}
            >
              <svg className="google-icon" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Usar otra cuenta
            </button>

            <div className="security-notice">
              <div className="security-content">
                <svg className="security-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                </svg>
                <div className="security-text">
                  <p className="security-title">Acceso seguro</p>
                  <p className="security-description">Solo personal autorizado puede acceder al sistema</p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="login-footer">
            <p className="footer-text">© 2025 Control de Tiempos • v1.0</p>
          </div>
        </div>
      </div>
    );
  }

  // Si hay usuario, mostrar el contenido de la app
  console.log('🎊 Renderizando aplicación para usuario:', auth.currentUser?.email);
  return children;
}