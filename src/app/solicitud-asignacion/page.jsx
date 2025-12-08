'use client';

import { useState, useEffect } from 'react';
import { db } from '../../firebaseConfig';
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  limit,
} from 'firebase/firestore';

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

export default function SolicitudAsignacionPage() {
  const [form, setForm] = useState({
    requesterName: '',
    requesterId: '',
    requesterEmail: '',
    area: '',
    costCenter: '',
    activity: '',
    location: '',
  });

  const [rememberProfile, setRememberProfile] = useState(true);
  const [sending, setSending] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const [lastTrackingCode, setLastTrackingCode] = useState('');

  const [lookupCode, setLookupCode] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupError, setLookupError] = useState('');

  // Cargar perfil guardado en localStorage
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
      }));
      setRememberProfile(true);
    } catch (error) {
      console.error('Error leyendo perfil guardado:', error);
    }
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitMessage('');
    setLastTrackingCode('');

    // Validación extra (además del required del HTML)
    if (
      !form.requesterName.trim() ||
      !form.activity.trim() ||
      !form.location.trim()
    ) {
      setSubmitMessage(
        'Por favor completa los campos obligatorios: Nombre de quien solicita, Actividad solicitada y Lugar.'
      );
      return;
    }

    setSending(true);

    try {
      const trackingCode = generateTrackingCode();

      await addDoc(collection(db, 'assignmentRequests'), {
        requesterName: form.requesterName.trim(),
        requesterId: form.requesterId.trim(),
        requesterEmail: form.requesterEmail.trim(),
        area: form.area.trim(),
        costCenter: form.costCenter.trim(),
        activity: form.activity.trim(),
        location: form.location.trim(),
        status: 'pending',
        trackingCode,
        adminMessage: '',
        responseMessage: '',
        assignmentIds: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Guardar perfil básico en el equipo, si el usuario quiere
      if (typeof window !== 'undefined') {
        if (rememberProfile) {
          const profileToSave = {
            requesterName: form.requesterName.trim(),
            requesterEmail: form.requesterEmail.trim(),
            area: form.area.trim(),
            costCenter: form.costCenter.trim(),
          };
          localStorage.setItem(
            PROFILE_STORAGE_KEY,
            JSON.stringify(profileToSave)
          );
        } else {
          localStorage.removeItem(PROFILE_STORAGE_KEY);
        }
      }

      setLastTrackingCode(trackingCode);
      setSubmitMessage(
        'Solicitud enviada correctamente. Guarda tu código de seguimiento.'
      );

      // Limpiamos solo campos variables de cada solicitud
      setForm((prev) => ({
        ...prev,
        requesterId: '',
        activity: '',
        location: '',
      }));
    } catch (error) {
      console.error('Error creando solicitud:', error);
      setSubmitMessage(
        'Ocurrió un error al enviar la solicitud. Intenta nuevamente.'
      );
    } finally {
      setSending(false);
    }
  };

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
      const q = query(
        collection(db, 'assignmentRequests'),
        where('trackingCode', '==', code),
        limit(1)
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        setLookupError(
          'No se encontró ninguna solicitud con ese código. Verifica que esté bien escrito.'
        );
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

  const renderStatusTag = (status) => {
    if (status === 'approved') {
      return <span className="tag tag--success">Aprobada</span>;
    }
    if (status === 'rejected') {
      return <span className="tag tag--danger">Rechazada</span>;
    }
    return <span className="tag tag--warning">Pendiente</span>;
  };

  // Clases dinámicas para la tarjeta según el estado
  const statusCardClass =
    lookupResult?.status === 'approved'
      ? 'status-card--approved'
      : lookupResult?.status === 'rejected'
      ? 'status-card--rejected'
      : lookupResult
      ? 'status-card--pending'
      : '';

  // Mensaje del admin (soporta adminMessage y responseMessage)
  const adminMessageToShow =
    (lookupResult &&
      (lookupResult.adminMessage || lookupResult.responseMessage)) ||
    '';

  return (
    <div className="page">
      <div className="content">
        {/* ENCABEZADO */}
        <header className="header">
          <div className="header__icon">
            <span className="header__icon-rocket">🚚</span>
          </div>
          <div>
            <h1 className="header__title">Solicitud de Asignación de Equipos</h1>
            <p className="header__subtitle">
              Formulario de Solicitud de Movimientos y Actividades con Equipos en
              Almacén.
            </p>
          </div>
        </header>

        {/* DOS TARJETAS: FORM + CONSULTA */}
        <main className="main-grid">
          {/* Tarjeta: Nueva solicitud */}
          <section className="card card--primary">
            <div className="card__header">
              <h2 className="card__title">Nueva solicitud</h2>
              <p className="card__subtitle">
                Completa los datos de la actividad que necesitas. El
                administrador revisará la solicitud y la asignará al equipo
                correspondiente.
              </p>
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
                    placeholder="Ej: Subestación norte, frente al almacén..."
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

                <button
                  className="btn btn--primary"
                  type="submit"
                  disabled={sending}
                >
                  {sending ? 'Enviando solicitud...' : 'Enviar solicitud'}
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

          {/* Tarjeta: Consultar estado */}
          <section className="card card--secondary">
            <div className="card__header">
              <h2 className="card__title">Consultar estado</h2>
              <p className="card__subtitle">
                Ingresa el código de seguimiento que se generó al enviar la
                solicitud para ver si fue aprobada o rechazada.
              </p>
            </div>

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
                className="btn btn--ghost"
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
                  {renderStatusTag(lookupResult.status)}
                </div>

                <div className="status-card__body">
                  <p>
                    <span>Solicitante:</span> {lookupResult.requesterName} • C.C.{' '}
                    {lookupResult.requesterId}
                  </p>
                  {lookupResult.area && (
                    <p>
                      <span>Área:</span> {lookupResult.area}
                    </p>
                  )}
                  {lookupResult.costCenter && (
                    <p>
                      <span>Centro de costos:</span> {lookupResult.costCenter}
                    </p>
                  )}

                  {adminMessageToShow && (
                    <p className="status-card__message">
                      <span>Mensaje del administrador:</span>{' '}
                      {adminMessageToShow}
                    </p>
                  )}
                </div>
              </div>
            )}

            {!lookupResult && !lookupError && (
              <p className="hint">
                Tip: después de enviar una solicitud, imprime o anota el código
                para consultarla más tarde.
              </p>
            )}
          </section>
        </main>
      </div>

      {/* ESTILOS */}
      <style jsx>{`
        .page {
          min-height: 100vh;
          padding: 40px 16px;
          display: flex;
          justify-content: center;
          background:
            radial-gradient(circle at top left, #4f46e5 0, transparent 50%),
            radial-gradient(circle at bottom right, #0ea5e9 0, transparent 55%),
            #020617;
          color: #f9fafb;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI',
            sans-serif;
        }

        .content {
          width: 100%;
          max-width: 1120px;
        }

        .header {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 24px;
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
        }

        .header__icon-rocket {
          font-size: 26px;
        }

        .header__title {
          font-size: clamp(1.9rem, 3vw, 2.4rem);
          font-weight: 700;
          letter-spacing: 0.01em;
        }

        .header__subtitle {
          margin-top: 4px;
          font-size: 0.95rem;
          color: #cbd5f5;
          max-width: 680px;
        }

        .main-grid {
          display: grid;
          grid-template-columns: minmax(0, 3fr) minmax(0, 2.2fr);
          gap: 24px;
        }

        @media (max-width: 900px) {
          .main-grid {
            grid-template-columns: 1fr;
          }
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
          background: radial-gradient(circle at top left, #4f46e5 0, #020617 60%),
            #020617;
        }

        .card--secondary {
          background: linear-gradient(145deg, #020617, #020617 40%, #0f172a);
        }

        .card__header {
          margin-bottom: 18px;
        }

        .card__title {
          font-size: 1.25rem;
          font-weight: 600;
        }

        .card__subtitle {
          margin-top: 4px;
          font-size: 0.9rem;
          color: #cbd5f5;
        }

        /* FORMULARIO */
        .form {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .form__group {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .form__group--two {
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        @media (max-width: 700px) {
          .form__group--two {
            grid-template-columns: 1fr;
          }
        }

        .form__field label {
          display: block;
          font-size: 0.8rem;
          color: #e5e7eb;
          margin-bottom: 4px;
        }

        .form__field input,
        .form__field textarea {
          width: 100%;
          border-radius: 10px;
          border: 1px solid rgba(148, 163, 184, 0.55);
          background: rgba(15, 23, 42, 0.88);
          color: #f9fafb;
          font-size: 0.9rem;
          padding: 8px 10px;
          outline: none;
          transition: border-color 0.15s ease, box-shadow 0.15s ease,
            background 0.15s ease;
        }

        .form__field textarea {
          resize: vertical;
        }

        .form__field input::placeholder,
        .form__field textarea::placeholder {
          color: #9ca3af;
          font-size: 0.85rem;
        }

        .form__field input:focus,
        .form__field textarea:focus {
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

        .remember {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 0.8rem;
          color: #e5e7eb;
        }

        .remember input {
          width: 14px;
          height: 14px;
        }

        .btn {
          border-radius: 999px;
          border: none;
          padding: 8px 18px;
          font-size: 0.9rem;
          font-weight: 500;
          cursor: pointer;
          transition: transform 0.1s ease, box-shadow 0.15s ease,
            background 0.15s ease, color 0.15s ease;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          white-space: nowrap;
        }

        .btn:disabled {
          opacity: 0.7;
          cursor: default;
          box-shadow: none;
          transform: none;
        }

        .btn--primary {
          background: linear-gradient(135deg, #4f46e5, #38bdf8);
          box-shadow: 0 12px 30px rgba(59, 130, 246, 0.55);
          color: #f9fafb;
        }

        .btn--primary:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 14px 38px rgba(56, 189, 248, 0.6);
        }

        .btn--ghost {
          background: transparent;
          color: #e5e7eb;
          border: 1px solid rgba(148, 163, 184, 0.7);
        }

        .btn--ghost:hover:not(:disabled) {
          background: rgba(15, 23, 42, 0.9);
        }

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
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
            'Liberation Mono', 'Courier New', monospace;
          font-weight: 600;
          letter-spacing: 0.1em;
        }

        /* CONSULTA */
        .lookup {
          display: flex;
          gap: 10px;
          margin-bottom: 12px;
          margin-top: 10px;
        }

        .lookup__input {
          flex: 1;
          border-radius: 999px;
          border: 1px solid rgba(148, 163, 184, 0.7);
          background: rgba(15, 23, 42, 0.9);
          color: #f9fafb;
          padding: 8px 12px;
          font-size: 0.88rem;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
            'Liberation Mono', 'Courier New', monospace;
          text-transform: uppercase;
        }

        .lookup__input::placeholder {
          color: #9ca3af;
        }

        .lookup__error {
          font-size: 0.85rem;
          color: #fecaca;
        }

        .hint {
          margin-top: 10px;
          font-size: 0.85rem;
          color: #9ca3af;
        }

        .status-card {
          margin-top: 10px;
          padding: 12px 12px 10px;
          border-radius: 14px;
          background: rgba(15, 23, 42, 0.95);
          border: 1px solid rgba(148, 163, 184, 0.5);
          transition: box-shadow 0.2s ease, border-color 0.2s ease,
            transform 0.1s ease;
        }

        .status-card--approved {
          border-color: rgba(34, 197, 94, 0.9);
          box-shadow: 0 0 0 1px rgba(34, 197, 94, 0.35);
        }

        .status-card--rejected {
          border-color: rgba(248, 113, 113, 0.95);
          box-shadow: 0 0 0 1px rgba(248, 113, 113, 0.35);
        }

        .status-card--pending {
          border-color: rgba(250, 204, 21, 0.95);
          box-shadow: 0 0 0 1px rgba(250, 204, 21, 0.3);
        }

        .status-card__header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 10px;
          margin-bottom: 6px;
        }

        .status-card__title {
          font-size: 0.98rem;
          font-weight: 600;
        }

        .status-card__location {
          font-size: 0.85rem;
          color: #e5e7eb;
        }

        .status-card__location span {
          font-weight: 600;
        }

        .status-card__body {
          font-size: 0.85rem;
          color: #e5e7eb;
        }

        .status-card__body p + p {
          margin-top: 4px;
        }

        .status-card__body span {
          font-weight: 600;
        }

        .status-card__message {
          margin-top: 6px;
          padding-top: 6px;
          border-top: 1px dashed rgba(148, 163, 184, 0.6);
        }

        /* Tags de estado */
        .tag {
          border-radius: 999px;
          padding: 4px 10px;
          font-size: 0.75rem;
          font-weight: 600;
          letter-spacing: 0.03em;
          text-transform: uppercase;
        }

        .tag--success {
          background: rgba(22, 163, 74, 0.16);
          color: #bbf7d0;
          border: 1px solid rgba(34, 197, 94, 0.8);
        }

        .tag--danger {
          background: rgba(220, 38, 38, 0.16);
          color: #fecaca;
          border: 1px solid rgba(248, 113, 113, 0.9);
        }

        .tag--warning {
          background: rgba(234, 179, 8, 0.16);
          color: #facc15;
          border: 1px solid rgba(250, 204, 21, 0.9);
        }
      `}</style>
    </div>
  );
}
