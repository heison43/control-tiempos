'use client';

import { useEffect, useState } from 'react';
import { db } from '../../firebaseConfig';
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';

const SUPER_ADMIN_EMAIL = 'heison659@gmail.com'; // 👈 tu correo

export default function ManageAdmins() {
  const [admins, setAdmins] = useState([]);
  const [nuevoEmail, setNuevoEmail] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const colRef = collection(db, 'admins');

    const unsub = onSnapshot(
      colRef,
      (snap) => {
        const data = snap.docs.map((d) => {
          const raw = d.data();
          return {
            id: d.id,
            ...raw,
            createdAt: raw.createdAt?.toDate?.() || null,
          };
        });

        // ordenar: primero super admin, luego por fecha
        data.sort((a, b) => {
          if (a.email === SUPER_ADMIN_EMAIL) return -1;
          if (b.email === SUPER_ADMIN_EMAIL) return 1;
          const ta = a.createdAt ? a.createdAt.getTime() : 0;
          const tb = b.createdAt ? b.createdAt.getTime() : 0;
          return tb - ta;
        });

        setAdmins(data);
        setCargando(false);
      },
      (err) => {
        console.error('Error cargando admins:', err);
        setError('Error al cargar los administradores');
        setCargando(false);
      }
    );

    return () => unsub();
  }, []);

  const handleAgregar = async () => {
    const email = nuevoEmail.trim().toLowerCase();

    if (!email) {
      alert('Ingresa un correo');
      return;
    }

    if (!email.includes('@')) {
      alert('Ingresa un correo válido');
      return;
    }

    try {
      const ref = doc(db, 'admins', email);
      await setDoc(ref, {
        email,
        isActive: true,
        createdAt: new Date(),
      });

      setNuevoEmail('');
    } catch (err) {
      console.error('Error creando admin:', err);
      alert('Error al crear administrador');
    }
  };

  const toggleActivo = async (admin) => {
    if (admin.email === SUPER_ADMIN_EMAIL) {
      alert('No puedes desactivar el Súper Admin.');
      return;
    }

    try {
      const ref = doc(db, 'admins', admin.id);
      await updateDoc(ref, {
        isActive: !admin.isActive,
      });
    } catch (err) {
      console.error('Error actualizando admin:', err);
      alert('Error al actualizar estado del administrador');
    }
  };

  const handleDelete = async (admin) => {
    if (admin.email === SUPER_ADMIN_EMAIL) {
      alert('El Súper Admin no se puede eliminar.');
      return;
    }

    if (!confirm(`¿Eliminar definitivamente a ${admin.email} como administrador?`)) return;

    try {
      const ref = doc(db, 'admins', admin.id);
      await deleteDoc(ref);
    } catch (err) {
      console.error('Error eliminando admin:', err);
      alert('Error al eliminar administrador');
    }
  };

  return (
    <section style={wrapper}>
      <div style={headerRow}>
        <div>
          <h2 style={title}>Gestión de Administradores</h2>
          <p style={subtitle}>
            Define qué correos tendrán acceso al panel de administración.
            El usuario se registra normalmente y, si su correo está aquí y activo,
            entra como <strong>admin</strong>.
          </p>
        </div>

        <span style={badge}>{admins.length} admins configurados</span>
      </div>

      {/* Formulario para agregar admin */}
      <div style={formRow}>
        <input
          type="email"
          placeholder="correo@empresa.com"
          value={nuevoEmail}
          onChange={(e) => setNuevoEmail(e.target.value)}
          style={input}
        />
        <button type="button" style={btnAdd} onClick={handleAgregar}>
          + Agregar admin
        </button>
      </div>

      {cargando ? (
        <div style={loadingBox}>Cargando administradores...</div>
      ) : error ? (
        <div style={errorBox}>❌ {error}</div>
      ) : admins.length === 0 ? (
        <div style={emptyBox}>
          <div style={{ fontSize: 32 }}>👤</div>
          <p style={{ marginTop: 8, color: '#6b7280' }}>
            Aún no has configurado administradores adicionales.
          </p>
        </div>
      ) : (
        <div style={list}>
          {admins.map((admin) => {
            const isSuper = admin.email === SUPER_ADMIN_EMAIL;
            return (
              <article key={admin.id} style={card}>
                <div style={cardMainRow}>
                  <div>
                    <p style={emailText}>{admin.email}</p>
                    <p style={metaText}>
                      Rol:{' '}
                      <strong>
                        {isSuper ? 'Súper Admin' : 'Administrador'}
                      </strong>
                    </p>
                    {admin.createdAt && (
                      <p style={metaText}>
                        Alta:{' '}
                        {admin.createdAt.toLocaleDateString('es-CO', {
                          year: 'numeric',
                          month: 'short',
                          day: '2-digit',
                        })}
                      </p>
                    )}
                  </div>

                  <div style={actions}>
                    <span
                      style={{
                        ...pill,
                        ...(admin.isActive
                          ? pillActive
                          : pillInactive),
                      }}
                    >
                      {admin.isActive ? 'Activo' : 'Inactivo'}
                    </span>

                    {!isSuper && (
                      <>
                        <button
                          type="button"
                          style={btnToggle}
                          onClick={() => toggleActivo(admin)}
                        >
                          {admin.isActive ? 'Desactivar' : 'Activar'}
                        </button>
                        <button
                          type="button"
                          style={btnDelete}
                          onClick={() => handleDelete(admin)}
                        >
                          Eliminar
                        </button>
                      </>
                    )}

                    {isSuper && (
                      <span style={superTag}>Cuenta principal</span>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ───────── estilos ───────── */

const wrapper = {
  marginTop: 24,
  padding: 16,
  borderRadius: 16,
  border: '1px solid rgba(148,163,184,0.35)',
  background: 'linear-gradient(135deg, #0f172a, #111827)',
  boxShadow: '0 10px 30px rgba(15,23,42,0.45)',
  color: '#e5e7eb',
};

const headerRow = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 16,
  flexWrap: 'wrap',
};

const title = {
  fontSize: 20,
  fontWeight: 800,
  margin: 0,
};

const subtitle = {
  marginTop: 6,
  fontSize: 13,
  color: 'rgba(209,213,219,0.9)',
};

const badge = {
  alignSelf: 'flex-start',
  padding: '4px 10px',
  borderRadius: 999,
  fontSize: 12,
  border: '1px solid rgba(148,163,184,0.6)',
  background: 'rgba(15,23,42,0.8)',
};

const formRow = {
  marginTop: 16,
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap',
};

const input = {
  flex: 1,
  minWidth: 0,
  padding: '10px 12px',
  borderRadius: 999,
  border: '1px solid #4b5563',
  background: '#020617',
  color: '#e5e7eb',
  fontSize: 14,
};

const btnAdd = {
  padding: '10px 14px',
  borderRadius: 999,
  border: 'none',
  background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
  color: '#fff',
  fontWeight: 600,
  fontSize: 13,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const loadingBox = {
  marginTop: 16,
  padding: 16,
  borderRadius: 12,
  background: 'rgba(15,23,42,0.8)',
  textAlign: 'center',
  fontSize: 13,
};

const errorBox = {
  marginTop: 16,
  padding: 16,
  borderRadius: 12,
  background: 'rgba(127,29,29,0.9)',
  textAlign: 'center',
  fontSize: 13,
};

const emptyBox = {
  marginTop: 20,
  padding: 24,
  borderRadius: 16,
  background: 'rgba(15,23,42,0.9)',
  textAlign: 'center',
};

const list = {
  marginTop: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};

const card = {
  borderRadius: 14,
  padding: 12,
  background: 'linear-gradient(135deg, #020617, #111827)',
  border: '1px solid rgba(55,65,81,0.9)',
};

const cardMainRow = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  flexWrap: 'wrap',
};

const emailText = {
  fontSize: 14,
  fontWeight: 700,
  margin: 0,
  color: '#f9fafb',
};

const metaText = {
  fontSize: 12,
  margin: '2px 0',
  color: '#9ca3af',
};

const actions = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  alignItems: 'center',
  justifyContent: 'flex-end',
  minWidth: 0,
};

const pill = {
  padding: '4px 10px',
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 600,
  borderWidth: 1,
  borderStyle: 'solid',
};

const pillActive = {
  backgroundColor: '#dcfce7',
  color: '#166534',
  borderColor: '#22c55e',
};

const pillInactive = {
  backgroundColor: '#fee2e2',
  color: '#b91c1c',
  borderColor: '#f97373',
};

const btnToggle = {
  padding: '6px 10px',
  borderRadius: 999,
  border: 'none',
  fontSize: 11,
  fontWeight: 600,
  cursor: 'pointer',
  backgroundColor: '#1d4ed8',
  color: '#eef2ff',
};

const btnDelete = {
  padding: '6px 10px',
  borderRadius: 999,
  border: 'none',
  fontSize: 11,
  fontWeight: 600,
  cursor: 'pointer',
  backgroundColor: '#7f1d1d',
  color: '#fee2e2',
};

const superTag = {
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  padding: '3px 8px',
  borderRadius: 999,
  border: '1px solid rgba(250,250,250,0.25)',
  color: '#e5e7eb',
};
