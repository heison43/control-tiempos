'use client';

import Link from 'next/link';
import {
  useEffect,
  useMemo,
  useState
} from 'react';
import { signIn,
  signOut,
  useSession } from 'next-auth/react';
import PortalMicrosoftGuard from '../../components/PortalMicrosoftGuard';
import {
  db,
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  limit,
  onSnapshot,
  orderBy
} from '../../lib/pgFirestoreCompat';


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

function normalizeExecutionStatus(status) {
  if (!status) return 'pending';

  const value = String(status).trim().toLowerCase();

  if (value === 'en_progreso' || value === 'in_progress') return 'in_progress';
  if (value === 'pausado' || value === 'paused') return 'paused';
  if (value === 'finalizado' || value === 'completed') return 'completed';
  if (value === 'pendiente' || value === 'pending') return 'pending';

  return 'pending';
}

function execStatusLabel(status) {
  const normalized = normalizeExecutionStatus(status);

  switch (normalized) {
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

function pickOverallExecutionStatus(assignments = [], fallbackStatus = 'pending') {
  const statuses = assignments.map((item) => normalizeExecutionStatus(item.status));

  if (statuses.includes('in_progress')) return 'in_progress';
  if (statuses.includes('paused')) return 'paused';
  if (statuses.includes('pending')) return 'pending';

  if (statuses.length > 0 && statuses.every((item) => item === 'completed')) {
    return 'completed';
  }

  return normalizeExecutionStatus(fallbackStatus);
}

async function getFirstByField(collectionName, fieldName, value) {
  if (!value) return null;

  const snap = await getDocs(
    query(
      collection(db, collectionName),
      where(fieldName, '==', value),
      limit(1)
    )
  );

  if (snap.empty) return null;

  return {
    id: snap.docs[0].id,
    ...snap.docs[0].data(),
  };
}

async function getOperatorNameById(operatorId) {
  if (!operatorId) return '';

  try {
    const operator =
      (await getFirstByField('operators', 'id', operatorId)) ||
      (await getFirstByField('operators', 'code', operatorId));

    if (!operator) return operatorId;

    return operator.name || operator.nombre || operator.code || operatorId;
  } catch (error) {
    console.error('Error consultando operador asignado:', error);
    return operatorId;
  }
}

async function getEquipmentNameById(equipmentId) {
  if (!equipmentId) return '';

  try {
    const equipment =
      (await getFirstByField('equipment', 'id', equipmentId)) ||
      (await getFirstByField('equipment', 'code', equipmentId));

    if (!equipment) return equipmentId;

    const name = equipment.name || equipment.nombre || equipmentId;
    const code = equipment.code || equipment.codigo || equipmentId;

    return code && code !== name ? `${name} (${code})` : name;
  } catch (error) {
    console.error('Error consultando equipo asignado:', error);
    return equipmentId;
  }
}

async function getAssignmentsForRequest(request) {
  const assignments = [];
  const seen = new Set();

  const addFromSnapshot = (snap) => {
    snap.docs.forEach((docItem) => {
      const row = { id: docItem.id, ...docItem.data() };
      if (!seen.has(row.id)) {
        seen.add(row.id);
        assignments.push(row);
      }
    });
  };

  if (request?.id) {
    const snapByRequestId = await getDocs(
      query(
        collection(db, 'assignments'),
        where('requestId', '==', request.id),
        limit(20)
      )
    );
    addFromSnapshot(snapByRequestId);
  }

  if (request?.trackingCode) {
    const snapByCode = await getDocs(
      query(
        collection(db, 'assignments'),
        where('trackingCode', '==', request.trackingCode),
        limit(20)
      )
    );
    addFromSnapshot(snapByCode);
  }

  return assignments;
}

async function enrichRequestWithAssignment(request) {
  try {
    const assignments = await getAssignmentsForRequest(request);

    if (assignments.length === 0) {
      return {
        ...request,
        assignedOperatorName: '',
        assignedOperatorId: '',
        assignedEquipmentName: '',
        assignedEquipmentId: '',
        operatorCurrentStatus: normalizeExecutionStatus(request.executionStatus),
        linkedAssignments: [],
      };
    }

    const operatorIds = [
      ...new Set(
        assignments
          .map((item) => item.operatorId || item.operator_id)
          .filter(Boolean)
      ),
    ];

    const equipmentIds = [
      ...new Set(
        assignments
          .map((item) => item.equipmentId || item.equipment_id)
          .filter(Boolean)
      ),
    ];

    const operatorNames = await Promise.all(
      operatorIds.map((operatorId) => getOperatorNameById(operatorId))
    );

    const equipmentNamesFromAssignments = assignments
      .map((item) => item.equipmentName || item.equipment_name)
      .filter(Boolean);

    const equipmentNames = equipmentNamesFromAssignments.length > 0
      ? [...new Set(equipmentNamesFromAssignments)]
      : await Promise.all(
          equipmentIds.map((equipmentId) => getEquipmentNameById(equipmentId))
        );

    const operatorCurrentStatus = pickOverallExecutionStatus(
      assignments,
      request.executionStatus
    );

    return {
      ...request,
      assignedOperatorName: operatorNames.filter(Boolean).join(', '),
      assignedOperatorId: operatorIds.join(', '),
      assignedEquipmentName: equipmentNames.filter(Boolean).join(', '),
      assignedEquipmentId: equipmentIds.join(', '),
      operatorCurrentStatus,
      linkedAssignments: assignments,
    };
  } catch (error) {
    console.error('Error enriqueciendo solicitud con asignación:', error);
    return request;
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

  const { data: session } = useSession();

  // Sesión corporativa con Microsoft (fase 1)
  const portalUser = useMemo(() => {
    const email = normalizeEmail(session?.user?.email);
    if (!email) return null;
    return {
      uid: email,
      email,
      displayName: session?.user?.name || '',
    };
  }, [session?.user?.email, session?.user?.name]);

  // Mis solicitudes
  const [myRequests, setMyRequests] = useState([]);
  const [myLoading, setMyLoading] = useState(false);

  // Panel derecho: tab
  const [rightTab, setRightTab] = useState('mine'); // mine | code

  // 1) Prefill con sesión corporativa
  useEffect(() => {
    if (!portalUser) return;

    setForm((prev) => ({
      ...prev,
      requesterName: prev.requesterName || portalUser.displayName || '',
      requesterEmail: prev.requesterEmail || portalUser.email || '',
    }));
  }, [portalUser]);

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
  if (!portalUser?.email) {
    setMyRequests([]);
    return;
  }

  setMyLoading(true);

  const userEmail = normalizeEmail(portalUser.email);

  const qMine = query(
    collection(db, 'assignmentRequests'),
    where('requesterEmail', '==', userEmail),
    orderBy('createdAt', 'desc'),
    limit(25)
  );

  const unsub = onSnapshot(
    qMine,
    async (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      const enrichedRows = await Promise.all(
        rows.map((row) => enrichRequestWithAssignment(row))
      );

      setMyRequests(enrichedRows);
      setMyLoading(false);
    },
    (err) => {
      console.error('Error leyendo mis solicitudes:', err);
      setMyLoading(false);
    }
  );

  return () => unsub();
}, [portalUser?.email]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };


  const handlePortalLogout = async () => {
    try {
      await signOut({ callbackUrl: '/' });
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
  if (!portalUser?.email) {
    setSubmitMessage('Debes iniciar sesión con tu cuenta Microsoft corporativa para enviar la solicitud.');
    await signIn('azure-ad', { callbackUrl: '/solicitud-asignacion' });
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

    const requesterEmailNormalized = normalizeEmail(portalUser.email || form.requesterEmail);
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

// ✅ NUEVO: notificación interna para administradores
try {
  await fetch('/api/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      role: 'admin',
      title: 'Nueva solicitud de asignación',
      message: `${form.requesterName.trim()} envió una solicitud de asignación: ${form.activity.trim()}`,
      type: 'assignment_request_created',
      related_id: docRef.id,
      related_module: 'assignmentRequests',
    }),
  });
} catch (notificationErr) {
  console.error('Error creando notificación interna:', notificationErr);
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
        const requestData = {
          id: snap.docs[0].id,
          ...snap.docs[0].data(),
        };

        const enrichedRequest = await enrichRequestWithAssignment(requestData);
        setLookupResult(enrichedRequest);
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
    const name = portalUser.displayName || 'Usuario corporativo';
    return { name, email };
  }, [portalUser]);

  return (
    <PortalMicrosoftGuard callbackUrl="/solicitud-asignacion">
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
            <div className="account__box">
              <div className="account__meta">
                <div className="account__name">{portalBadge?.name}</div>
                <div className="account__email">{portalBadge?.email}</div>
              </div>
              <button className="btn btn--ghost" onClick={handlePortalLogout}>
                Salir
              </button>
            </div>
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

            <div className="notice">
              <strong>Sesión corporativa activa:</strong> las solicitudes quedarán asociadas a tu cuenta Microsoft para que puedas consultarlas en este mismo panel.
            </div>

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
                    <p><strong>Debes iniciar sesión con Microsoft</strong> para ver tus solicitudes.</p>
                    <div className="empty__actions">
                      <button className="btn btn--primary" onClick={() => signIn('azure-ad', { callbackUrl: '/solicitud-asignacion' })}>Continuar con Microsoft</button>
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
                      const execTag = execStatusLabel(r.operatorCurrentStatus || r.executionStatus);

                      return (
                        <div key={r.id} className="status-card status-card--pending">
                          <div className="status-card__header">
                            <div>
                              <p className="status-card__title">
                                {r.activity || 'Actividad sin título'}
                              </p>

                              <p className="status-card__location">
                                <span>Lugar:</span> {r.location || '-'}
                              </p>
                            </div>

                            <div className="req__tags">
                              <span className={adminTag.cls}>{adminTag.text}</span>
                              <span className={execTag.cls}>{execTag.text}</span>
                            </div>
                          </div>

                          <div className="status-card__body">
                            <p>
                              <span>Código:</span>{' '}
                              <strong>{r.trackingCode || '-'}</strong>
                            </p>

                            <p>
                              <span>Solicitante:</span> {r.requesterName || '-'} • C.C. {r.requesterId || '-'}
                            </p>

                            {(r.requesterArea || r.area) && (
                              <p>
                                <span>Área:</span> {r.requesterArea || r.area}
                              </p>
                            )}

                            {r.costCenter && (
                              <p>
                                <span>Centro de costos:</span> {r.costCenter}
                              </p>
                            )}

                            {r.contactPhone && (
                              <p>
                                <span>Contacto responsable:</span> {r.contactPhone}
                              </p>
                            )}

                            {r.assignedOperatorName ? (
                              <p>
                                <span>Asignado a operador:</span> {r.assignedOperatorName}
                              </p>
                            ) : (
                              <p>
                                <span>Asignación:</span> Sin operador asignado
                              </p>
                            )}

                            {r.assignedEquipmentName && (
                              <p>
                                <span>Equipo asignado:</span> {r.assignedEquipmentName}
                              </p>
                            )}

                            <p>
                              <span>Estado de aprobación:</span> {adminTag.text}
                            </p>

                            <p>
                              <span>Estado del operador:</span> {execTag.text}
                            </p>

                            {(r.adminMessage || r.responseMessage) && (
                              <p className="status-card__message">
                                <span>Mensaje del administrador:</span> {r.adminMessage || r.responseMessage}
                              </p>
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
                      <div className="req__tags">
                        <span className={adminStatusLabel(lookupResult.status).cls}>
                          {adminStatusLabel(lookupResult.status).text}
                        </span>
                        <span className={execStatusLabel(lookupResult.operatorCurrentStatus || lookupResult.executionStatus).cls}>
                          {execStatusLabel(lookupResult.operatorCurrentStatus || lookupResult.executionStatus).text}
                        </span>
                      </div>
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

                      {lookupResult.assignedOperatorName ? (
                        <p>
                          <span>Asignado a operador:</span> {lookupResult.assignedOperatorName}
                        </p>
                      ) : (
                        <p>
                          <span>Asignación:</span> Sin operador asignado
                        </p>
                      )}

                      {lookupResult.assignedEquipmentName && (
                        <p>
                          <span>Equipo asignado:</span> {lookupResult.assignedEquipmentName}
                        </p>
                      )}

                      <p>
                        <span>Estado del operador:</span>{' '}
                        {execStatusLabel(lookupResult.operatorCurrentStatus || lookupResult.executionStatus).text}
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
    </PortalMicrosoftGuard>
  );
}
