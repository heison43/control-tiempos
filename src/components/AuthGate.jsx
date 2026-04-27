'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ensureAuthorizedUser } from '../lib/userAccess';

export default function AuthGate({ children, requiredRole }) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;

    async function validate() {
      if (status === 'loading') return;
      if (status === 'unauthenticated') {
        router.push('/');
        return;
      }

      const result = await ensureAuthorizedUser({
        email: session?.user?.email,
        name: session?.user?.name,
      });

      if (!active) return;

      if (!result.ok) {
        router.push('/');
        return;
      }

      if (requiredRole && result.role !== requiredRole) {
        router.push('/');
        return;
      }

      setChecking(false);
    }

    validate();
    return () => {
      active = false;
    };
  }, [router, session, status, requiredRole]);

  if (checking || status === 'loading') {
    return <div style={{ padding: 24 }}>Verificando acceso...</div>;
  }

  return children;
}
