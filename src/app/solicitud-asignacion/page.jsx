'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { db, auth } from '../../firebaseConfig';
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  setDoc,
  doc,
} from 'firebase/firestore';
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';

const PROFILE_STORAGE_KEY = 'ctiempos_solicitante';

// Genera un código corto tipo AX7Q2C
function generateTrackingCode(length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function normalizeEmail(email) {
  return email ? email.trim().toLowerCase() : '';
}

function adminStatusLabel(status) {
  if (status === 'approved') return { text: 'Aprobada', cls: 'tag tag--success' };
  if (status === 'rejected') return { text: 'Rechazada', cls: 'tag tag--danger' };
  return { text: 'Pendiente', cls: 'tag tag--warning' };
}

function execStatusLabel(status) {
  switch (status) {
    case 'in_progress':
      return { text: 'En progreso', cls: 'tag tag--info' };
    case 'paused':
      return { text: 'Pausada', cls: 'tag tag--paused' };
    case 'completed':
      return { text: 'Finalizada', cls: 'tag tag--success' };
    case 'pending':
    default:
      return { text: 'Pendiente', cls: 'tag tag--warning' };
  }
}

export default function SolicitudAsignacionPage() {
  const [form, setForm] = useState({
    requesterName: '',
    requesterId: '',
    requesterEmail: '',
    area: '',
    costCenter: '',
    contactPhone: '',
    activity: '',
    location: '',
  });

  const [rememberProfile, setRememberProfile] = useState(true);
  const [sending, setSending] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const [lastTrackingCode, setLastTrackingCode] = useState('');

  // Consulta por código
  const [lookupCode, setLookupCode] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupError, setLookupError] = useState('');

  // Portal Auth (email/password)
  const [portalUser, setPortalUser] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // login | register
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPass, setAuthPass] = useState('');
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);

  // Mis solicitudes
  const [myRequests, setMyRequests] = useState([]);
  const [myLoading, setMyLoading] = useState(false);

  // Panel derecho: tab
  const [rightTab, setRightTab] = useState('mine'); // mine | code

  // 1) Escuchar auth del portal (email/password)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setPortalUser(u || null);
      if (u) {
        setAuthOpen(false);
        setAuthError('');
      }
    });
    return () => unsub();
  }, []);

  // 2) Cargar perfil guardado en localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);

      setForm((prev) => ({
        ...prev,
        requesterName: saved.requesterName || '',
        requesterEmail: saved.requesterEmail || '',
        area: saved.area || '',
        costCenter: saved.costCenter || '',
        contactPhone: saved.contactPhone || '',
      }));
      setRememberProfile(true);
    } catch (error) {
      console.error('Error leyendo perfil guardado:', error);
    }
  }, []);

  // 3) Suscripción a “Mis solicitudes”
  useEffect(() => {
    if (!portalUser?.uid) {
      setMyRequests([]);
      return;
    }

    setMyLoading(true);
    const qMine = query(
      collection(db, 'assignmentRequests'),
      where('createdByUid', '==', portalUser.uid),
      orderBy('createdAt', 'desc'),
      limit(25)
    );

    const unsub = onSnapshot(
      qMine,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setMyRequests(rows);
        setMyLoading(false);
      },
      (err) => {
        console.error('Error leyendo mis solicitudes:', err);
        setMyLoading(false);
      }
    );

    return () => unsub();
  }, [portalUser?.uid]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // -------- Portal Auth handlers --------
  const openAuth = (mode = 'login') => {
    setAuthMode(mode);
    setAuthError('');
    setAuthOpen(true);
    setAuthEmail(form.requesterEmail || authEmail || '');
    setAuthName(form.requesterName || authName || '');
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthBusy(true);

    try {
      const email = normalizeEmail(authEmail);
      if (!email) throw new Error('Ingresa un correo válido.');
      if (!authPass || authPass.length < 6) {
        throw new Error('La clave debe tener al menos 6 caracteres.');
      }

      if (authMode === 'register') {
        const cred = await createUserWithEmailAndPassword(auth, email, authPass);

        // Guardamos nombre (displayName) solo para UX
        if (authName?.trim()) {
          await updateProfile(cred.user, { displayName: authName.trim() });
        }

        // Guardamos un doc separado del sistema interno
        await setDoc(
          doc(db, 'portalUsers', cred.user.uid),
          {
            uid: cred.user.uid,
            email,
            name: (authName || cred.user.displayName || '').trim(),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        // Autollenar formulario con lo que registró
        setForm((prev) => ({
          ...prev,
          requesterName: authName?.trim() || prev.requesterName,
          requesterEmail: email,
        }));
      } else {
        await signInWithEmailAndPassword(auth, email, authPass);

        // autollenar
        setForm((prev) => ({
          ...prev,
          requesterEmail: email,
        }));
      }

      setAuthPass('');
      setAuthOpen(false);
    } catch (err) {
      console.error(err);
      setAuthError(err?.message || 'Error de autenticación.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handlePortalLogout = async () => {
    try {
      await signOut(auth);
      setMyRequests([]);
      setRightTab('code');
    } catch (e) {
      console.error(e);
    }
  };

  // -------- Submit solicitud --------
const handleSubmit = async (e) => {
  e.preventDefault();
  setSubmitMessage('');
  setLastTrackingCode('');

  // ✅ Requerimos sesión para que el usuario vea “Mis solicitudes”
  if (!portalUser?.uid) {
    setSubmitMessage(
      'Para enviar y visualizar tus solicitudes, primero debes iniciar sesión o crear una cuenta.'
    );
    openAuth('login');
    return;
  }

  // Validación extra
  if (
    !form.requesterName.trim() ||
    !form.requesterId.trim() ||
    !form.activity.trim() ||
    !form.location.trim() ||
    !form.contactPhone.trim() ||
    !form.costCenter.trim()
  ) {
    setSubmitMessage(
      'Por favor completa los campos obligatorios: Nombre, Cédula, Centro de costos, Actividad, Lugar y Número de contacto del responsable.'
    );
    return;
  }

  setSending(true);

  try {
    const trackingCode = generateTrackingCode();
    const createdByName = (portalUser.displayName || form.requesterName || '').trim();

    const requesterEmailNormalized = normalizeEmail(form.requesterEmail);
    const areaTrim = form.area.trim();

    // ⬇️ ANTES:  await addDoc(...)
    // ⬇️ AHORA: guardamos el docRef para tener el ID
    const docRef = await addDoc(collection(db, 'assignmentRequests'), {
      requesterName: form.requesterName.trim(),
      requesterId: form.requesterId.trim(),
      requesterEmail: requesterEmailNormalized, // ✅ normalizado
      // compatibilidad (admin/operador puede leer cualquiera)
      area: areaTrim,
      requesterArea: areaTrim, // ✅ NUEVO
      costCenter: form.costCenter.trim(),
      contactPhone: form.contactPhone.trim(),
      activity: form.activity.trim(),
      location: form.location.trim(),

      // Estado admin (no romper nada)
      status: 'pending',
      adminMessage: '',
      responseMessage: '',
      assignmentIds: [],
      trackingCode,

      // vínculo portal + estados operativos
      createdByUid: portalUser.uid,
      createdByEmail: normalizeEmail(portalUser.email || requesterEmailNormalized),
      createdByName,
      executionStatus: 'pending', // pending | in_progress | paused | completed

      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // ✅ NUEVO: avisar a la API para correo + push a administradores
    try {
      await fetch('/api/notify-admin-new-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestId: docRef.id,
          trackingCode,
          requesterName: form.requesterName.trim(),
          activity: form.activity.trim(),
          location: form.location.trim(),
          costCenter: form.costCenter.trim(),
        }),
      });
    } catch (notifyErr) {
      console.error('Error llamando a notify-admin-new-request:', notifyErr);
      // No rompemos el flujo si falla la notificación
    }

    // Guardar perfil básico en el equipo
    if (typeof window !== 'undefined') {
      if (rememberProfile) {
        const profileToSave = {
          requesterName: form.requesterName.trim(),
          requesterEmail: requesterEmailNormalized,
          area: areaTrim,
          costCenter: form.costCenter.trim(),
          contactPhone: form.contactPhone.trim(),
        };
        localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profileToSave));
      } else {
        localStorage.removeItem(PROFILE_STORAGE_KEY);
      }
    }

    setLastTrackingCode(trackingCode);
    setSubmitMessage('Solicitud enviada correctamente. También la verás en “Mis solicitudes”.');
    setRightTab('mine');

    // Limpiar campos variables
    setForm((prev) => ({
      ...prev,
      requesterId: '',
      activity: '',
      location: '',
      contactPhone: '',
    }));
  } catch (error) {
    console.error('Error creando solicitud:', error);
    setSubmitMessage('Ocurrió un error al enviar la solicitud. Intenta nuevamente.');
  } finally {
    setSending(false);
  }
};

  // -------- Lookup por código --------
  const handleLookup = async (e) => {
    e.preventDefault();
    setLookupError('');
    setLookupResult(null);

    const code = lookupCode.trim().toUpperCase();
    if (!code) {
      setLookupError('Ingresa un código de seguimiento.');
      return;
    }

    setLookupLoading(true);
    try {
      const qx = query(
        collection(db, 'assignmentRequests'),
        where('trackingCode', '==', code),
        limit(1)
      );
      const snap = await getDocs(qx);

      if (snap.empty) {
        setLookupError('No se encontró ninguna solicitud con ese código. Verifica que esté bien escrito.');
      } else {
        setLookupResult(snap.docs[0].data());
      }
    } catch (error) {
      console.error('Error consultando solicitud:', error);
      setLookupError('Error al consultar la solicitud. Intenta de nuevo.');
    } finally {
      setLookupLoading(false);
    }
  };

  const statusCardClass =
    lookupResult?.status === 'approved'
      ? 'status-card--approved'
      : lookupResult?.status === 'rejected'
        ? 'status-card--rejected'
        : lookupResult
          ? 'status-card--pending'
          : '';

  const adminMessageToShow =
    (lookupResult && (lookupResult.adminMessage || lookupResult.responseMessage)) || '';

  const portalBadge = useMemo(() => {
    if (!portalUser) return null;
    const email = portalUser.email || '';
    const name = portalUser.displayName || 'Usuario';
    return { name, email };
  }, [portalUser]);

  return (
    <div className="page">
      <div className="content">
        <Link href="/solicitudes" className="back-link">
          <span className="back-link__icon">←</span>
          <span>Volver al menú de solicitudes</span>
        </Link>

        {/* Encabezado + cuenta */}
        <header className="header header--row">
          <div className="header__left">
            <div className="header__icon">
              <span className="header__icon-rocket">🚚</span>
            </div>
            <div>
              <h1 className="header__title">Solicitud de Asignación de Equipos</h1>
              <p className="header__subtitle">
                Envía solicitudes y consulta su estado (aprobación + ejecución) en un solo lugar.
              </p>
            </div>
          </div>

          <div className="account">
            {!portalUser ? (
              <>
                <button className="btn btn--ghost" onClick={() => openAuth('login')}>
                  Iniciar sesión
                </button>
                <button className="btn btn--primary" onClick={() => openAuth('register')}>
                  Crear cuenta
                </button>
              </>
            ) : (
              <div className="account__box">
                <div className="account__meta">
                  <div className="account__name">{portalBadge?.name}</div>
                  <div className="account__email">{portalBadge?.email}</div>
                </div>
                <button className="btn btn--ghost" onClick={handlePortalLogout}>
                  Salir
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="main-grid">
          {/* Tarjeta: Nueva solicitud */}
          <section className="card card--primary">
            <div className="card__header">
              <h2 className="card__title">Nueva solicitud</h2>
              <p className="card__subtitle">
                Completa los datos de la actividad. El administrador revisará la solicitud y el operador actualizará el progreso.
              </p>
            </div>

            {!portalUser && (
              <div className="notice">
                <strong>Recomendación:</strong> inicia sesión o crea una cuenta para que puedas ver todas tus solicitudes en este mismo panel.
              </div>
            )}

            <form className="form" onSubmit={handleSubmit}>
              <div className="form__group form__group--two">
                <div className="form__field">
                  <label>Nombre de quien solicita *</label>
                  <input
                    type="text"
                    name="requesterName"
                    value={form.requesterName}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="form__field">
                  <label>Cédula *</label>
                  <input
                    type="text"
                    name="requesterId"
                    value={form.requesterId}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="form__group form__group--two">
                <div className="form__field">
                  <label>Área</label>
                  <input
                    type="text"
                    name="area"
                    value={form.area}
                    onChange={handleChange}
                    placeholder="Planta, Mantenimiento, Bodega..."
                  />
                </div>

                <div className="form__field">
                  <label>Número de contacto del responsable *</label>
                  <input
                    type="tel"
                    name="contactPhone"
                    value={form.contactPhone}
                    onChange={handleChange}
                    required
                    placeholder="Ej: 300 123 4567"
                  />
                </div>
              </div>

              <div className="form__group form__group--two">
                <div className="form__field">
                  <label>Centro de costos *</label>
                  <input
                    type="text"
                    name="costCenter"
                    value={form.costCenter}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="form__field">
                  <label>Correo (opcional)</label>
                  <input
                    type="email"
                    name="requesterEmail"
                    value={form.requesterEmail}
                    onChange={handleChange}
                    placeholder="Opcional (para contacto)"
                  />
                </div>
              </div>

              <div className="form__group">
                <div className="form__field">
                  <label>Actividad solicitada *</label>
                  <textarea
                    name="activity"
                    value={form.activity}
                    onChange={handleChange}
                    required
                    rows={3}
                    placeholder="Ej: Traslado de material desde bodega a planta 2..."
                  />
                </div>
              </div>

              <div className="form__group">
                <div className="form__field">
                  <label>Lugar *</label>
                  <input
                    type="text"
                    name="location"
                    value={form.location}
                    onChange={handleChange}
                    required
                    placeholder="Ej: Subestación, frente al almacén..."
                  />
                </div>
              </div>

              <div className="form__footer">
                <label className="remember">
                  <input
                    type="checkbox"
                    checked={rememberProfile}
                    onChange={(e) => setRememberProfile(e.target.checked)}
                  />
                  <span>Recordar mis datos en este equipo</span>
                </label>

                <button className="btn btn--primary" type="submit" disabled={sending}>
                  {sending ? 'Enviando...' : 'Enviar solicitud'}
                </button>
              </div>
            </form>

            {submitMessage && (
              <div className="feedback">
                <p>{submitMessage}</p>
                {lastTrackingCode && (
                  <p className="feedback__code">
                    Código de seguimiento: <span>{lastTrackingCode}</span>
                  </p>
                )}
              </div>
            )}
          </section>

          {/* Panel derecho: Mis solicitudes / Consultar código */}
          <section className="card card--secondary">
            <div className="card__header">
              <h2 className="card__title">Seguimiento</h2>
              <p className="card__subtitle">
                Visualiza tus solicitudes fácilmente. Puedes ver el estado de aprobación y el estado de ejecución del operador.
              </p>
            </div>

            <div className="segmented">
              <button
                className={rightTab === 'mine' ? 'segmented__btn segmented__btn--active' : 'segmented__btn'}
                onClick={() => setRightTab('mine')}
                type="button"
              >
                Mis solicitudes
              </button>
              <button
                className={rightTab === 'code' ? 'segmented__btn segmented__btn--active' : 'segmented__btn'}
                onClick={() => setRightTab('code')}
                type="button"
              >
                Consultar por código
              </button>
            </div>

            {rightTab === 'mine' && (
              <>
                {!portalUser ? (
                  <div className="empty">
                    <p><strong>Inicia sesión</strong> para ver todas tus solicitudes aquí.</p>
                    <div className="empty__actions">
                      <button className="btn btn--ghost" onClick={() => openAuth('login')}>Iniciar sesión</button>
                      <button className="btn btn--primary" onClick={() => openAuth('register')}>Crear cuenta</button>
                    </div>
                    <p className="hint">
                      Si ya tienes un código de seguimiento, usa la pestaña “Consultar por código”.
                    </p>
                  </div>
                ) : (
                  <div className="list">
                    {myLoading && <p className="hint">Cargando tus solicitudes…</p>}

                    {!myLoading && myRequests.length === 0 && (
                      <p className="hint">Aún no tienes solicitudes registradas con esta cuenta.</p>
                    )}

                    {myRequests.map((r) => {
                      const adminTag = adminStatusLabel(r.status);
                      const execTag = execStatusLabel(r.executionStatus);
                      return (
                        <div key={r.id} className="req">
                          <div className="req__top">
                            <div>
                              <div className="req__title">{r.activity || 'Actividad'}</div>
                              <div className="req__meta">
                                <span><strong>Lugar:</strong> {r.location || '-'}</span>
                                <span className="dot">•</span>
                                <span><strong>CC:</strong> {r.costCenter || '-'}</span>
                              </div>
                            </div>
                            <div className="req__tags">
                              <span className={adminTag.cls}>{adminTag.text}</span>
                              <span className={execTag.cls}>{execTag.text}</span>
                            </div>
                          </div>

                          <div className="req__bottom">
                            <div className="req__code">
                              <span>Código:</span>
                              <strong>{r.trackingCode || '-'}</strong>
                            </div>

                            {(r.adminMessage || r.responseMessage) && (
                              <div className="req__msg">
                                <span>Mensaje admin:</span> {r.adminMessage || r.responseMessage}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {rightTab === 'code' && (
              <>
                <form className="lookup" onSubmit={handleLookup}>
                  <input
                    type="text"
                    value={lookupCode}
                    onChange={(e) => setLookupCode(e.target.value.toUpperCase())}
                    placeholder="Ej: AX7Q2C"
                    className="lookup__input"
                  />
                  <button
                    type="submit"
                    className="btn btn--ghost lookup__button"
                    disabled={lookupLoading}
                  >
                    {lookupLoading ? 'Buscando...' : 'Consultar'}
                  </button>
                </form>

                {lookupError && <p className="lookup__error">{lookupError}</p>}

                {lookupResult && (
                  <div className={`status-card ${statusCardClass}`}>
                    <div className="status-card__header">
                      <div>
                        <p className="status-card__title">
                          {lookupResult.activity || 'Actividad sin título'}
                        </p>
                        <p className="status-card__location">
                          <span>Lugar:</span> {lookupResult.location}
                        </p>
                      </div>
                      <span className={adminStatusLabel(lookupResult.status).cls}>
                        {adminStatusLabel(lookupResult.status).text}
                      </span>
                    </div>

                    <div className="status-card__body">
                      <p>
                        <span>Solicitante:</span> {lookupResult.requesterName} • C.C. {lookupResult.requesterId}
                      </p>

                      {(lookupResult.requesterArea || lookupResult.area) && (
                        <p>
                          <span>Área:</span> {lookupResult.requesterArea || lookupResult.area}
                        </p>
                      )}

                      {lookupResult.costCenter && (
                        <p>
                          <span>Centro de costos:</span> {lookupResult.costCenter}
                        </p>
                      )}
                      {lookupResult.contactPhone && (
                        <p>
                          <span>Contacto responsable:</span> {lookupResult.contactPhone}
                        </p>
                      )}

                      <p>
                        <span>Estado de ejecución:</span>{' '}
                        {execStatusLabel(lookupResult.executionStatus).text}
                      </p>

                      {adminMessageToShow && (
                        <p className="status-card__message">
                          <span>Mensaje del administrador:</span> {adminMessageToShow}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {!lookupResult && !lookupError && (
                  <p className="hint">
                    Tip: si no quieres crear cuenta, guarda el código de seguimiento para consultar después.
                  </p>
                )}
              </>
            )}
          </section>
        </main>
      </div>

      {/* Modal auth */}
      {authOpen && (
        <div className="modal-overlay" onMouseDown={() => setAuthOpen(false)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h3 className="modal__title">
                {authMode === 'register' ? 'Crear cuenta' : 'Iniciar sesión'}
              </h3>
              <button className="modal__close" onClick={() => setAuthOpen(false)} type="button">
                ✕
              </button>
            </div>

            <p className="modal__subtitle">
              Esto te permite ver <strong>tus solicitudes</strong> en este panel (sin Google).
            </p>

            <form onSubmit={handleAuthSubmit} className="modal__form">
              {authMode === 'register' && (
                <div className="modal__field">
                  <label>Nombre</label>
                  <input value={authName} onChange={(e) => setAuthName(e.target.value)} placeholder="Ej: Pedro Pérez" />
                </div>
              )}

              <div className="modal__field">
                <label>Correo</label>
                <input
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  type="email"
                  placeholder="correo@empresa.com"
                  required
                />
              </div>

              <div className="modal__field">
                <label>Clave</label>
                <input
                  value={authPass}
                  onChange={(e) => setAuthPass(e.target.value)}
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  required
                />
              </div>

              {authError && <div className="modal__error">{authError}</div>}

              <div className="modal__actions">
                <button className="btn btn--primary" type="submit" disabled={authBusy}>
                  {authBusy ? 'Procesando…' : authMode === 'register' ? 'Crear cuenta' : 'Entrar'}
                </button>

                <button
                  className="btn btn--ghost"
                  type="button"
                  onClick={() => {
                    setAuthMode(authMode === 'register' ? 'login' : 'register');
                    setAuthError('');
                  }}
                >
                  {authMode === 'register' ? 'Ya tengo cuenta' : 'Crear una cuenta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .page,
        .content,
        .card,
        input,
        textarea {
          box-sizing: border-box;
        }

        .page {
          min-height: 100vh;
          padding: 32px 16px;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          background:
            radial-gradient(circle at top left, #4f46e5 0, transparent 50%),
            radial-gradient(circle at bottom right, #0ea5e9 0, transparent 55%),
            #020617;
          color: #f9fafb;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        .content {
          width: 100%;
          max-width: 1120px;
        }

        .header--row {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
          margin-bottom: 18px;
        }

        .header__left {
          display: flex;
          gap: 16px;
          align-items: center;
        }

        .header__icon {
          width: 52px;
          height: 52px;
          border-radius: 16px;
          background: linear-gradient(135deg, #22c55e, #0ea5e9);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 10px 25px rgba(15, 118, 110, 0.45);
          flex-shrink: 0;
        }

        .header__icon-rocket { font-size: 26px; }
        .header__title { font-size: clamp(1.6rem, 3vw, 2.2rem); font-weight: 800; }
        .header__subtitle { margin-top: 6px; font-size: 0.95rem; color: #cbd5f5; max-width: 680px; }

        .account { display: flex; gap: 10px; align-items: center; }
        .account__box {
          display: flex;
          gap: 10px;
          align-items: center;
          padding: 10px 12px;
          border-radius: 16px;
          background: rgba(15, 23, 42, 0.55);
          border: 1px solid rgba(148, 163, 184, 0.35);
        }
        .account__meta { display: flex; flex-direction: column; line-height: 1.15; }
        .account__name { font-weight: 700; font-size: 0.9rem; }
        .account__email { font-size: 0.78rem; color: #cbd5f5; }

        .main-grid {
          display: grid;
          grid-template-columns: minmax(0, 3fr) minmax(0, 2.2fr);
          gap: 24px;
        }

        .card {
          border-radius: 20px;
          padding: 22px 22px 20px;
          background: rgba(15, 23, 42, 0.95);
          border: 1px solid rgba(148, 163, 184, 0.2);
          box-shadow: 0 18px 45px rgba(15, 23, 42, 0.8);
          backdrop-filter: blur(18px);
        }

        .card--primary {
          background: radial-gradient(circle at top left, #4f46e5 0, #020617 60%), #020617;
        }

        .card--secondary {
          background: linear-gradient(145deg, #020617, #020617 40%, #0f172a);
        }

        .card__header { margin-bottom: 14px; }
        .card__title { font-size: 1.2rem; font-weight: 700; }
        .card__subtitle { margin-top: 6px; font-size: 0.9rem; color: #cbd5f5; }

        .notice {
          margin: 10px 0 14px;
          padding: 10px 12px;
          border-radius: 14px;
          background: rgba(56, 189, 248, 0.08);
          border: 1px solid rgba(56, 189, 248, 0.35);
          color: #e0f2fe;
          font-size: 0.88rem;
        }

        .form { display: flex; flex-direction: column; gap: 14px; }

        .form__group { display: flex; flex-direction: column; gap: 12px; }
        .form__group--two { display: grid; gap: 12px; grid-template-columns: repeat(2, minmax(0, 1fr)); }

        .form__field label { display: block; font-size: 0.8rem; color: #e5e7eb; margin-bottom: 4px; }

        input, textarea {
          width: 100%;
          border-radius: 10px;
          border: 1px solid rgba(148, 163, 184, 0.55);
          background: rgba(15, 23, 42, 0.88);
          color: #f9fafb;
          font-size: 0.9rem;
          padding: 8px 10px;
          outline: none;
          transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
        }
        textarea { resize: vertical; }
        input::placeholder, textarea::placeholder { color: #9ca3af; font-size: 0.85rem; }
        input:focus, textarea:focus {
          border-color: #38bdf8;
          box-shadow: 0 0 0 1px rgba(56, 189, 248, 0.6);
          background: rgba(15, 23, 42, 1);
        }

        .form__footer {
          margin-top: 4px;
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
        }

        .remember { display: inline-flex; align-items: center; gap: 6px; font-size: 0.8rem; color: #e5e7eb; }
        .remember input { width: 14px; height: 14px; }

        .btn {
          border-radius: 999px;
          border: none;
          padding: 8px 18px;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.1s ease, box-shadow 0.15s ease, background 0.15s ease, color 0.15s ease;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          white-space: nowrap;
        }

        .btn:disabled { opacity: 0.7; cursor: default; box-shadow: none; transform: none; }

        .btn--primary {
          background: linear-gradient(135deg, #4f46e5, #38bdf8);
          box-shadow: 0 12px 30px rgba(59, 130, 246, 0.55);
          color: #f9fafb;
        }
        .btn--primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 14px 38px rgba(56, 189, 248, 0.6); }

        .btn--ghost {
          background: transparent;
          color: #e5e7eb;
          border: 1px solid rgba(148, 163, 184, 0.7);
        }
        .btn--ghost:hover:not(:disabled) { background: rgba(15, 23, 42, 0.9); }

        .feedback {
          margin-top: 14px;
          font-size: 0.86rem;
          color: #e5e7eb;
          padding: 10px 12px;
          border-radius: 12px;
          background: rgba(15, 23, 42, 0.85);
          border: 1px solid rgba(52, 211, 153, 0.4);
        }
        .feedback__code span {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
          font-weight: 700;
          letter-spacing: 0.1em;
        }

        .segmented {
          display: flex;
          gap: 10px;
          margin: 6px 0 12px;
        }
        .segmented__btn {
          flex: 1;
          border-radius: 999px;
          padding: 8px 10px;
          background: rgba(15, 23, 42, 0.65);
          border: 1px solid rgba(148, 163, 184, 0.45);
          color: #e5e7eb;
          cursor: pointer;
          font-weight: 700;
          font-size: 0.85rem;
        }
        .segmented__btn--active {
          background: linear-gradient(135deg, rgba(79,70,229,0.7), rgba(56,189,248,0.6));
          border-color: rgba(56, 189, 248, 0.7);
        }

        .empty { padding: 10px 6px; }
        .empty__actions { display: flex; gap: 10px; margin-top: 10px; }

        .list {
          display: flex;
          flex-direction: column;
          gap: 10px;
          max-height: 520px;
          overflow: auto;
          padding-right: 4px;
        }

        .req {
          border-radius: 16px;
          border: 1px solid rgba(148, 163, 184, 0.35);
          background: rgba(15, 23, 42, 0.85);
          padding: 12px 12px 10px;
        }

        .req__top {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: flex-start;
        }
        .req__title { font-weight: 800; font-size: 0.95rem; }
        .req__meta { margin-top: 4px; font-size: 0.82rem; color: #cbd5f5; display: flex; gap: 8px; flex-wrap: wrap; }
        .dot { opacity: 0.7; }
        .req__tags { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; justify-content: flex-end; }
        .req__bottom { margin-top: 8px; font-size: 0.82rem; color: #e5e7eb; }
        .req__code { display: flex; gap: 8px; align-items: baseline; }
        .req__code strong { letter-spacing: 0.08em; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; }
        .req__msg { margin-top: 6px; padding-top: 6px; border-top: 1px dashed rgba(148, 163, 184, 0.35); color: #e0f2fe; }

        .lookup { display: flex; gap: 10px; margin-top: 10px; margin-bottom: 12px; }
        .lookup__input {
          flex: 1;
          border-radius: 999px;
          border: 1px solid rgba(148, 163, 184, 0.7);
          background: rgba(15, 23, 42, 0.9);
          color: #f9fafb;
          padding: 8px 12px;
          font-size: 0.88rem;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
          text-transform: uppercase;
        }
        .lookup__error { font-size: 0.85rem; color: #fecaca; }
        .hint { margin-top: 10px; font-size: 0.85rem; color: #9ca3af; }

        .status-card {
          margin-top: 10px;
          padding: 12px 12px 10px;
          border-radius: 14px;
          background: rgba(15, 23, 42, 0.95);
          border: 1px solid rgba(148, 163, 184, 0.5);
        }
        .status-card--approved { border-color: rgba(34, 197, 94, 0.9); }
        .status-card--rejected { border-color: rgba(248, 113, 113, 0.95); }
        .status-card--pending { border-color: rgba(250, 204, 21, 0.95); }

        .status-card__header { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 6px; }
        .status-card__title { font-size: 0.98rem; font-weight: 700; }
        .status-card__location { font-size: 0.85rem; color: #e5e7eb; }
        .status-card__location span { font-weight: 700; }
        .status-card__body { font-size: 0.85rem; color: #e5e7eb; }
        .status-card__body p + p { margin-top: 4px; }
        .status-card__body span { font-weight: 700; }
        .status-card__message { margin-top: 6px; padding-top: 6px; border-top: 1px dashed rgba(148, 163, 184, 0.35); }

        .tag {
          border-radius: 999px;
          padding: 4px 10px;
          font-size: 0.75rem;
          font-weight: 800;
          letter-spacing: 0.03em;
          text-transform: uppercase;
          border: 1px solid transparent;
        }
        .tag--success { background: rgba(22, 163, 74, 0.16); color: #bbf7d0; border-color: rgba(34, 197, 94, 0.8); }
        .tag--danger { background: rgba(220, 38, 38, 0.16); color: #fecaca; border-color: rgba(248, 113, 113, 0.9); }
        .tag--warning { background: rgba(234, 179, 8, 0.16); color: #facc15; border-color: rgba(250, 204, 21, 0.9); }
        .tag--info { background: rgba(56, 189, 248, 0.12); color: #bae6fd; border-color: rgba(56, 189, 248, 0.65); }
        .tag--paused { background: rgba(148, 163, 184, 0.16); color: #e5e7eb; border-color: rgba(148, 163, 184, 0.65); }

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.55);
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 16px;
          z-index: 100;
        }
        .modal {
          width: 100%;
          max-width: 420px;
          border-radius: 18px;
          background: rgba(2, 6, 23, 0.95);
          border: 1px solid rgba(148, 163, 184, 0.25);
          box-shadow: 0 24px 70px rgba(0,0,0,0.7);
          padding: 16px;
        }
        .modal__header { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
        .modal__title { font-size: 1.05rem; font-weight: 900; margin: 0; }
        .modal__close {
          border: 1px solid rgba(148,163,184,0.35);
          background: rgba(15, 23, 42, 0.6);
          color: #e5e7eb;
          border-radius: 12px;
          padding: 6px 10px;
          cursor: pointer;
        }
        .modal__subtitle { margin: 8px 0 12px; color: #cbd5f5; font-size: 0.88rem; }
        .modal__form { display: flex; flex-direction: column; gap: 10px; }
        .modal__field label { display: block; font-size: 0.78rem; color: #e5e7eb; margin-bottom: 4px; }
        .modal__error { padding: 10px; border-radius: 12px; background: rgba(248, 113, 113, 0.12); border: 1px solid rgba(248, 113, 113, 0.35); color: #fecaca; font-size: 0.86rem; }
        .modal__actions { display: flex; gap: 10px; margin-top: 6px; flex-wrap: wrap; }

        @media (max-width: 900px) {
          .main-grid { grid-template-columns: 1fr; gap: 18px; }
          .header--row { flex-direction: column; }
          .account { width: 100%; justify-content: flex-start; }
        }
        @media (max-width: 768px) {
          .form__group--two { grid-template-columns: 1fr; }
          .lookup { flex-direction: column; }
          .lookup__button { width: 100%; }
        }
      `}</style>

      <style jsx global>{`
        .back-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 16px;
          font-size: 0.9rem;
          color: #ffffff;
          text-decoration: none;
          padding: 6px 12px;
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.45);
          border: 1px solid rgba(148, 163, 184, 0.6);
        }
        .back-link__icon { font-size: 1rem; }
        .back-link:hover {
          color: #e0f2fe;
          background: rgba(15, 23, 42, 0.9);
          border-color: #38bdf8;
          text-decoration: none;
        }
      `}</style>
    </div>
  );
}
