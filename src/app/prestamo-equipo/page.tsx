'use client';

import Link from 'next/link';
import { useState, type CSSProperties } from 'react';
import { db } from '../../firebaseConfig';
import {
  addDoc,
  collection,
  serverTimestamp,
  Timestamp,
  query,
  where,
  getDocs,
} from 'firebase/firestore';

const styles = {
  page: {
    minHeight: '100vh',
    padding: '24px 16px',
    background:
      'radial-gradient(circle at top left, #1e293b 0, #020617 40%, #020617 100%)',
    fontFamily:
      "'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
    color: '#e5e7eb',
  } as CSSProperties,
  container: {
    maxWidth: 1040,
    margin: '0 auto',
  } as CSSProperties,
  card: {
    background:
      'linear-gradient(150deg, rgba(15,23,42,0.96), rgba(15,23,42,0.92))',
    borderRadius: 24,
    padding: '22px 20px',
    border: '1px solid rgba(148,163,184,0.35)',
    boxShadow: '0 22px 60px rgba(15,23,42,0.85)',
  } as CSSProperties,
  backLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 12,
    color: '#9ca3af',
    textDecoration: 'none',
    marginBottom: 10,
  } as CSSProperties,
  headerTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  } as CSSProperties,
  headerTitle: {
    fontSize: 24,
    fontWeight: 800,
    color: '#f9fafb',
  } as CSSProperties,
  headerSubtitle: {
    fontSize: 13,
    color: '#cbd5f5',
    marginBottom: 12,
  } as CSSProperties,
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 11,
    background: 'rgba(16,185,129,0.15)',
    color: '#bbf7d0',
  } as CSSProperties,
  sectionTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: '#f9fafb',
    marginTop: 10,
    marginBottom: 4,
  } as CSSProperties,
  formGrid: {
    marginTop: 12,
    display: 'grid',
    gap: 18,
  } as CSSProperties,
  groupCard: {
    borderRadius: 18,
    border: '1px solid rgba(148,163,184,0.25)',
    background: 'rgba(15,23,42,0.75)',
    padding: 16,
  } as CSSProperties,
  fieldsGrid2: {
    display: 'grid',
    gap: 12,
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  } as CSSProperties,
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  } as CSSProperties,
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: '#e5e7eb',
  } as CSSProperties,
  input: {
    borderRadius: 10,
    border: '1px solid rgba(148,163,184,0.5)',
    padding: '9px 11px',
    background: 'rgba(15,23,42,0.9)',
    color: '#e5e7eb',
    fontSize: 13,
    outline: 'none',
  } as CSSProperties,
  textarea: {
    borderRadius: 10,
    border: '1px solid rgba(148,163,184,0.5)',
    padding: '9px 11px',
    background: 'rgba(15,23,42,0.9)',
    color: '#e5e7eb',
    fontSize: 13,
    minHeight: 70,
    outline: 'none',
    resize: 'vertical',
  } as CSSProperties,
  requiredLegend: {
    marginTop: 6,
    fontSize: 11,
    color: '#9ca3af',
  } as CSSProperties,
  footerRow: {
    marginTop: 18,
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
    alignItems: 'center',
  } as CSSProperties,
  submitBtn: {
    borderRadius: 999,
    padding: '10px 18px',
    border: 'none',
    background: 'linear-gradient(135deg, #22c55e, #16a34a)',
    color: '#022c22',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  } as CSSProperties,
  helperText: {
    fontSize: 11,
    color: '#9ca3af',
    maxWidth: 420,
  } as CSSProperties,
  successMsg: {
    marginTop: 10,
    fontSize: 12,
    color: '#4ade80',
  } as CSSProperties,
  statusCard: {
    marginTop: 22,
    borderRadius: 24,
    border: '1px solid rgba(148,163,184,0.3)',
    background:
      'radial-gradient(circle at top, rgba(15,23,42,0.98), rgba(15,23,42,0.9))',
    padding: 18,
  } as CSSProperties,
  statusHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  } as CSSProperties,
  statusForm: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
    marginTop: 8,
  } as CSSProperties,
  statusInput: {
    flex: '1 1 220px',
    borderRadius: 999,
    border: '1px solid rgba(148,163,184,0.5)',
    padding: '8px 14px',
    background: 'rgba(15,23,42,0.9)',
    color: '#e5e7eb',
    fontSize: 13,
    outline: 'none',
  } as CSSProperties,
  statusBtn: {
    borderRadius: 999,
    padding: '8px 16px',
    border: 'none',
    background: 'linear-gradient(135deg, #38bdf8, #0ea5e9)',
    color: '#0f172a',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  } as CSSProperties,
  statusResult: {
    marginTop: 14,
    fontSize: 13,
    color: '#e5e7eb',
  } as CSSProperties,
  statusChip: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '3px 9px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 600,
  } as CSSProperties,
  errorText: {
    marginTop: 8,
    fontSize: 12,
    color: '#f97373',
  } as CSSProperties,
};

type PrestamoConsulta = {
  codigoSeguimiento: string;
  estado: string;
  nombreCompleto: string;
  cedula: string;
  areaSolicitante: string;
  centroCosto: string;
  lugarUso: string;
  equipoRequerido: string;
  desdeSolicitado?: Date | null;
  hastaSolicitado?: Date | null;
  desdeAprobado?: Date | null;
  hastaAprobado?: Date | null;
  motivoRechazo?: string | null; // 👈 nuevo campo
};

function formatDateTime(d?: Date | null) {
  if (!d) return '—';
  return d.toLocaleString('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

// etiqueta en español para el estado
function statusLabel(estado: string) {
  const e = estado.toLowerCase();
  if (e === 'pending' || e === 'pendiente') return 'PENDIENTE';
  if (e === 'approved' || e === 'aprobado') return 'APROBADO';
  if (e === 'in_loan' || e === 'en_prestamo' || e === 'en préstamo')
    return 'EN PRÉSTAMO';
  if (e === 'returned' || e === 'devuelto') return 'DEVUELTO';
  if (e === 'rejected' || e === 'rechazado') return 'RECHAZADO';
  return estado.toUpperCase();
}

export default function PrestamoEquipoPage() {
  const [enviando, setEnviando] = useState(false);
  const [mensajeOk, setMensajeOk] = useState('');
  const [codigoGenerado, setCodigoGenerado] = useState('');

  // consulta por código
  const [codigoConsulta, setCodigoConsulta] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [errorConsulta, setErrorConsulta] = useState('');
  const [resultado, setResultado] = useState<PrestamoConsulta | null>(null);

  // ✅ envío de solicitud
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMensajeOk('');
    setCodigoGenerado('');
    setEnviando(true);

    try {
      const form = e.currentTarget;
      const data = new FormData(form);

      const nombreCompleto = String(data.get('nombreCompleto') || '').trim();
      const cedula = String(data.get('cedula') || '').trim();
      const telefono = String(data.get('telefono') || '').trim();
      const areaSolicitante = String(data.get('areaSolicitante') || '').trim();
      const centroCosto = String(data.get('centroCosto') || '').trim();
      const lugarUso = String(data.get('lugarUso') || '').trim();
      const equipoRequerido = String(data.get('equipoRequerido') || '').trim();
      const motivo = String(data.get('motivo') || '').trim();

      const desdeStr = String(data.get('desde') || '');
      const hastaStr = String(data.get('hasta') || '');

      const desdeDate = new Date(desdeStr);
      const hastaDate = new Date(hastaStr);

      if (isNaN(desdeDate.getTime()) || isNaN(hastaDate.getTime())) {
        throw new Error('Fechas inválidas');
      }

      if (hastaDate <= desdeDate) {
        throw new Error('La fecha final debe ser posterior a la inicial');
      }

      // pequeño código pseudo-único: PE-3MCM91
      const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
      const codigoSeguimiento = `PE-${randomPart}`;

      // 👇 Guardamos en la MISMA colección y con los mismos campos
      // que usa el panel admin: equipmentLoans
      await addDoc(collection(db, 'equipmentLoans'), {
        trackingCode: codigoSeguimiento,
        status: 'pending', // mismo enum que usa ManageEquipmentLoans
        createdAt: serverTimestamp(),

        // rango solicitado por el usuario
        requestedFrom: Timestamp.fromDate(desdeDate),
        requestedTo: Timestamp.fromDate(hastaDate),

        // datos del solicitante
        applicantName: nombreCompleto,
        applicantId: cedula,
        contactPhone: telefono,
        applicantArea: areaSolicitante,
        costCenter: centroCosto,
        location: lugarUso,

        // equipo y motivo
        equipmentRequested: equipoRequerido,
        purpose: motivo,

        // estos los llenará el admin al aprobar / entregar / devolver
        approvedFrom: null,
        approvedTo: null,
        approvedAt: null,
        deliveredAt: null,
        returnedAt: null,
        returnedCondition: null,
      });

      form.reset();

      setCodigoGenerado(codigoSeguimiento);
      setMensajeOk(
        `Solicitud enviada correctamente. Tu código de seguimiento es: ${codigoSeguimiento}.`
      );
    } catch (err) {
      console.error(err);
      setMensajeOk(
        'Ocurrió un error al enviar la solicitud. Intenta nuevamente.'
      );
    } finally {
      setEnviando(false);
    }
  };

  // 🔍 consulta de estado
  const handleCheckStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorConsulta('');
    setResultado(null);

    const code = codigoConsulta.trim().toUpperCase();
    if (!code) {
      setErrorConsulta('Ingresa un código de seguimiento.');
      return;
    }

    setBuscando(true);
    try {
      const qRef = query(
        collection(db, 'equipmentLoans'),
        where('trackingCode', '==', code)
      );

      const snap = await getDocs(qRef);

      if (snap.empty) {
        setErrorConsulta(
          'No se encontró ninguna solicitud con ese código. Verifica que esté bien escrito.'
        );
        return;
      }

      const docSnap = snap.docs[0];
      const data = docSnap.data() as any;

      const r: PrestamoConsulta = {
        codigoSeguimiento: data.trackingCode,
        estado: data.status || 'pending',
        nombreCompleto: data.applicantName || '',
        cedula: data.applicantId || '',
        areaSolicitante: data.applicantArea || '',
        centroCosto: data.costCenter || '',
        lugarUso: data.location || '',
        equipoRequerido: data.equipmentRequested || '',
        desdeSolicitado: data.requestedFrom?.toDate
          ? data.requestedFrom.toDate()
          : null,
        hastaSolicitado: data.requestedTo?.toDate
          ? data.requestedTo.toDate()
          : null,
        desdeAprobado: data.approvedFrom?.toDate
          ? data.approvedFrom.toDate()
          : null,
        hastaAprobado: data.approvedTo?.toDate
          ? data.approvedTo.toDate()
          : null,
        // 👇 motivo guardado en returnedCondition cuando se rechaza
        motivoRechazo: data.returnedCondition || null,
      };

      setResultado(r);
    } catch (err) {
      console.error(err);
      setErrorConsulta(
        'No se pudo consultar el estado. Intenta de nuevo en unos segundos.'
      );
    } finally {
      setBuscando(false);
    }
  };

  const chipStyleByStatus = (estado: string) => {
    const base = { ...styles.statusChip };
    const e = estado.toLowerCase();
    if (e === 'pendiente' || e === 'pending') {
      return { ...base, background: '#fef3c7', color: '#92400e' };
    }
    if (e === 'aprobado' || e === 'approved') {
      return { ...base, background: '#dcfce7', color: '#166534' };
    }
    if (e === 'en_prestamo' || e === 'en préstamo' || e === 'in_loan') {
      return { ...base, background: '#dbeafe', color: '#1d4ed8' };
    }
    if (e === 'devuelto' || e === 'returned') {
      return { ...base, background: '#e0f2fe', color: '#0369a1' };
    }
    if (e === 'rechazado' || e === 'rejected') {
      return { ...base, background: '#fee2e2', color: '#b91c1c' };
    }
    return { ...base, background: '#e5e7eb', color: '#111827' };
  };

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <div style={styles.card}>
          {/* Volver */}
          <Link href="/solicitudes" style={styles.backLink}>
            <span>←</span> <span>Volver al menú de solicitudes</span>
          </Link>

          {/* Encabezado */}
          <header>
            <div style={styles.headerTitleRow}>
              <span style={{ fontSize: 30 }}>🚜</span>
              <div>
                <h1 style={styles.headerTitle}>
                  Solicitud de préstamo de equipo
                </h1>
                <div style={styles.badge}>
                  <span>Nuevo préstamo</span>
                </div>
              </div>
            </div>

            <p style={styles.headerSubtitle}>
              Diligencia este formulario para solicitar el préstamo de un
              equipo por un rango de tiempo definido. Recibirás un código
              de seguimiento para consultar el estado de tu solicitud.
            </p>
          </header>

          {/* Formulario */}
          <form onSubmit={handleSubmit}>
            <div style={styles.formGrid}>
              {/* Datos del solicitante */}
              <section style={styles.groupCard}>
                <h2 style={styles.sectionTitle}>Datos del solicitante</h2>

                <div style={styles.fieldsGrid2}>
                  <div style={styles.field}>
                    <label style={styles.label}>
                      Nombre completo <span style={{ color: '#f97316' }}>*</span>
                    </label>
                    <input
                      name="nombreCompleto"
                      type="text"
                      placeholder="Ej: Juan Pérez"
                      style={styles.input}
                      required
                    />
                  </div>

                  <div style={styles.field}>
                    <label style={styles.label}>
                      Cédula <span style={{ color: '#f97316' }}>*</span>
                    </label>
                    <input
                      name="cedula"
                      type="text"
                      placeholder="Ej: 123456789"
                      style={styles.input}
                      required
                    />
                  </div>

                  <div style={styles.field}>
                    <label style={styles.label}>
                      Teléfono{' '}
                      <span style={{ color: '#f97316' }}>*</span>
                    </label>
                    <input
                      name="telefono"
                      type="text"
                      placeholder="Ej: 3001234567"
                      style={styles.input}
                      required
                    />
                  </div>

                  <div style={styles.field}>
                    <label style={styles.label}>
                      Área solicitante{' '}
                      <span style={{ color: '#f97316' }}>*</span>
                    </label>
                    <input
                      name="areaSolicitante"
                      type="text"
                      placeholder="Ej: Mantenimiento, Producción…"
                      style={styles.input}
                      required
                    />
                  </div>

                  <div style={styles.field}>
                    <label style={styles.label}>
                      Centro de costo{' '}
                      <span style={{ color: '#f97316' }}>*</span>
                    </label>
                    <input
                      name="centroCosto"
                      type="text"
                      placeholder="Ej: CC-0123"
                      style={styles.input}
                      required
                    />
                  </div>

                  <div style={styles.field}>
                    <label style={styles.label}>
                      Lugar donde se usará el equipo{' '}
                      <span style={{ color: '#f97316' }}>*</span>
                    </label>
                    <input
                      name="lugarUso"
                      type="text"
                      placeholder="Ej: Patio almacén, frente 3…"
                      style={styles.input}
                      required
                    />
                  </div>
                </div>
              </section>

              {/* Detalles del préstamo */}
              <section style={styles.groupCard}>
                <h2 style={styles.sectionTitle}>Detalles del préstamo</h2>

                <div style={styles.fieldsGrid2}>
                  <div style={styles.field}>
                    <label style={styles.label}>
                      Equipo requerido (tipo / referencia){' '}
                      <span style={{ color: '#f97316' }}>*</span>
                    </label>
                    <input
                      name="equipoRequerido"
                      type="text"
                      placeholder="Ej: Montacarga 3T, Manlift 1…"
                      style={styles.input}
                      required
                    />
                  </div>

                  <div style={styles.field}>
                    <label style={styles.label}>
                      Motivo del préstamo / actividad a realizar{' '}
                      <span style={{ color: '#f97316' }}>*</span>
                    </label>
                    <textarea
                      name="motivo"
                      placeholder="Describe brevemente para qué necesitas el equipo."
                      style={styles.textarea}
                      required
                    />
                  </div>
                </div>

                <div style={{ ...styles.fieldsGrid2, marginTop: 10 }}>
                  <div style={styles.field}>
                    <label style={styles.label}>
                      Desde (fecha y hora){' '}
                      <span style={{ color: '#f97316' }}>*</span>
                    </label>
                    <input
                      name="desde"
                      type="datetime-local"
                      style={styles.input}
                      required
                    />
                  </div>

                  <div style={styles.field}>
                    <label style={styles.label}>
                      Hasta (fecha y hora){' '}
                      <span style={{ color: '#f97316' }}>*</span>
                    </label>
                    <input
                      name="hasta"
                      type="datetime-local"
                      style={styles.input}
                      required
                    />
                  </div>
                </div>

                <p style={styles.requiredLegend}>
                  Los campos marcados con{' '}
                  <span style={{ color: '#f97316' }}>*</span> son
                  obligatorios.
                </p>
              </section>
            </div>

            {/* Footer del formulario */}
            <div style={styles.footerRow}>
              <p style={styles.helperText}>
                Al enviar la solicitud se generará un código de seguimiento.
                Con ese código podrás consultar el estado del préstamo en
                el área de almacén.
              </p>

              <button
                type="submit"
                style={styles.submitBtn}
                disabled={enviando}
              >
                {enviando
                  ? 'Enviando solicitud…'
                  : 'Enviar solicitud de préstamo'}
              </button>
            </div>

            {mensajeOk && <p style={styles.successMsg}>{mensajeOk}</p>}
          </form>

          {/* 🔍 Panel de consulta de estado */}
          <section style={styles.statusCard}>
            <div style={styles.statusHeader}>
              <h2 style={styles.sectionTitle}>
                Consultar estado de tu solicitud
              </h2>
              {codigoGenerado && (
                <span style={{ fontSize: 11, color: '#a5b4fc' }}>
                  Último código generado:{' '}
                  <strong>{codigoGenerado}</strong>
                </span>
              )}
            </div>

            <p style={{ fontSize: 12, color: '#9ca3af' }}>
              Ingresa el código de seguimiento (por ejemplo{' '}
              <code>PE-3MCM91</code>) para ver el estado, las fechas
              aprobadas y los datos principales del préstamo.
            </p>

            <form onSubmit={handleCheckStatus} style={styles.statusForm}>
              <input
                style={styles.statusInput}
                placeholder="Ej: PE-3MCM91"
                value={codigoConsulta}
                onChange={(e) => setCodigoConsulta(e.target.value)}
              />
              <button
                type="submit"
                style={styles.statusBtn}
                disabled={buscando}
              >
                {buscando ? 'Buscando…' : 'Consultar estado'}
              </button>
            </form>

            {errorConsulta && (
              <p style={styles.errorText}>{errorConsulta}</p>
            )}

            {resultado && (
              <div style={styles.statusResult}>
                <p style={{ marginBottom: 6 }}>
                  Código:{' '}
                  <strong>{resultado.codigoSeguimiento}</strong>{' '}
                  <span style={chipStyleByStatus(resultado.estado)}>
                    {statusLabel(resultado.estado)}
                  </span>
                </p>
                <p>
                  Solicitante:{' '}
                  <strong>{resultado.nombreCompleto || '—'}</strong>
                </p>
                <p>
                  Cédula:{' '}
                  <strong>{resultado.cedula || '—'}</strong>
                </p>
                <p>
                  Área:{' '}
                  <strong>{resultado.areaSolicitante || '—'}</strong>
                </p>
                <p>
                  Centro de costo:{' '}
                  <strong>{resultado.centroCosto || '—'}</strong>
                </p>
                <p>
                  Lugar donde se usará:{' '}
                  <strong>{resultado.lugarUso || '—'}</strong>
                </p>
                <p>
                  Equipo:{' '}
                  <strong>{resultado.equipoRequerido || '—'}</strong>
                </p>

                <p style={{ marginTop: 6 }}>
                  <span style={{ fontWeight: 600 }}>
                    Rango solicitado:
                  </span>{' '}
                  {formatDateTime(resultado.desdeSolicitado)} &nbsp;→&nbsp;{' '}
                  {formatDateTime(resultado.hastaSolicitado)}
                </p>

                <p>
                  <span style={{ fontWeight: 600 }}>
                    Rango aprobado:
                  </span>{' '}
                  {resultado.desdeAprobado || resultado.hastaAprobado ? (
                    <>
                      {formatDateTime(resultado.desdeAprobado)} &nbsp;→&nbsp;{' '}
                      {formatDateTime(resultado.hastaAprobado)}
                    </>
                  ) : (
                    'Pendiente de aprobación'
                  )}
                </p>

                {/* 👇 Mensaje visible si la solicitud fue rechazada */}
                {(() => {
                  const e = resultado.estado.toLowerCase();
                  const esRechazado =
                    e === 'rechazado' || e === 'rejected';
                  if (!esRechazado) return null;
                  return (
                    <p
                      style={{
                        marginTop: 10,
                        fontSize: 12,
                        color: '#fecaca',
                      }}
                    >
                      <strong>Motivo del rechazo:</strong>{' '}
                      {resultado.motivoRechazo ||
                        'No se registró un motivo específico para el rechazo.'}
                    </p>
                  );
                })()}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
