'use client';

import Link from 'next/link';
import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from 'react';
import { signOut, useSession } from 'next-auth/react';
import PortalMicrosoftGuard from '../../components/PortalMicrosoftGuard';
import {
  db,
  addDoc,
  collection,
  serverTimestamp,
  Timestamp,
  query,
  where,
  getDocs,
} from '../../lib/pgFirestoreCompat';






const styles = {
  page: {
    minHeight: '100vh',
    width: '100%',
    boxSizing: 'border-box',
    overflowX: 'hidden',
    padding: '28px 16px',
    background:
      'radial-gradient(circle at top left, #4f46e5 0, transparent 48%), radial-gradient(circle at bottom right, #0ea5e9 0, transparent 52%), #020617',
    fontFamily:
      "'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
    color: '#e5e7eb',
  } as CSSProperties,
  pageMobile: {
    padding: '18px 12px',
  } as CSSProperties,
  container: {
    width: '100%',
    maxWidth: 1180,
    margin: '0 auto',
    boxSizing: 'border-box',
  } as CSSProperties,
  containerMobile: {
    maxWidth: '100%',
  } as CSSProperties,
  backLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 13,
    color: '#cbd5e1',
    textDecoration: 'none',
    marginBottom: 14,
    padding: '8px 14px',
    borderRadius: 999,
    border: '1px solid rgba(148,163,184,0.35)',
    background: 'rgba(15,23,42,0.35)',
    maxWidth: '100%',
    boxSizing: 'border-box',
  } as CSSProperties,
  backLinkMobile: {
    fontSize: 12,
    padding: '8px 12px',
    marginBottom: 16,
  } as CSSProperties,
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 18,
    alignItems: 'flex-start',
    marginBottom: 20,
  } as CSSProperties,
  headerMobile: {
    flexDirection: 'column',
    gap: 14,
    marginBottom: 18,
  } as CSSProperties,
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  } as CSSProperties,
  headerLeftMobile: {
    alignItems: 'flex-start',
    gap: 12,
  } as CSSProperties,
  headerIcon: {
    width: 58,
    height: 58,
    borderRadius: 16,
    background: 'linear-gradient(135deg, #22c55e, #0ea5e9)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 28,
    boxShadow: '0 10px 30px rgba(14,165,233,0.35)',
    flexShrink: 0,
  } as CSSProperties,
  headerIconMobile: {
    width: 54,
    height: 54,
    borderRadius: 15,
    fontSize: 25,
  } as CSSProperties,
  headerTitle: {
    fontSize: 'clamp(1.7rem, 3vw, 2.35rem)',
    lineHeight: 1.1,
    fontWeight: 900,
    color: '#f9fafb',
    margin: 0,
    overflowWrap: 'anywhere',
  } as CSSProperties,
  headerTitleMobile: {
    fontSize: 'clamp(1.75rem, 8vw, 2.2rem)',
    lineHeight: 1.08,
  } as CSSProperties,
  headerSubtitle: {
    fontSize: 14,
    color: '#dbeafe',
    marginTop: 8,
    marginBottom: 0,
    maxWidth: 720,
    lineHeight: 1.4,
  } as CSSProperties,
  headerSubtitleMobile: {
    fontSize: 13,
    maxWidth: '100%',
  } as CSSProperties,
  accountBox: {
    minWidth: 250,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    padding: '12px 14px',
    borderRadius: 18,
    border: '1px solid rgba(148,163,184,0.35)',
    background: 'rgba(2,6,23,0.52)',
  } as CSSProperties,
  accountBoxMobile: {
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
  } as CSSProperties,
  accountName: {
    fontSize: 14,
    fontWeight: 800,
    color: '#f9fafb',
  } as CSSProperties,
  accountEmail: {
    fontSize: 12,
    color: '#bfdbfe',
    overflowWrap: 'anywhere',
  } as CSSProperties,
  logoutBtn: {
    borderRadius: 999,
    border: '1px solid rgba(226,232,240,0.4)',
    background: 'rgba(15,23,42,0.55)',
    color: '#f9fafb',
    padding: '8px 14px',
    fontWeight: 700,
    cursor: 'pointer',
  } as CSSProperties,
  mainGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.18fr) minmax(0, 0.82fr)',
    gap: 20,
    alignItems: 'start',
  } as CSSProperties,
  mainGridMobile: {
    gridTemplateColumns: '1fr',
    gap: 18,
  } as CSSProperties,
  card: {
    background:
      'linear-gradient(150deg, rgba(15,23,42,0.96), rgba(15,23,42,0.90))',
    borderRadius: 24,
    padding: '22px 20px',
    border: '1px solid rgba(148,163,184,0.35)',
    boxShadow: '0 22px 60px rgba(15,23,42,0.55)',
    minWidth: 0,
    boxSizing: 'border-box',
  } as CSSProperties,
  cardMobile: {
    borderRadius: 22,
    padding: '18px 16px',
  } as CSSProperties,
  cardTitle: {
    fontSize: 22,
    fontWeight: 900,
    color: '#f9fafb',
    margin: 0,
  } as CSSProperties,
  cardSubtitle: {
    fontSize: 13,
    color: '#cbd5e1',
    marginTop: 8,
    marginBottom: 0,
  } as CSSProperties,
  notice: {
    marginTop: 16,
    marginBottom: 16,
    padding: '12px 14px',
    borderRadius: 16,
    border: '1px solid rgba(56,189,248,0.45)',
    background: 'rgba(14,165,233,0.12)',
    color: '#dbeafe',
    fontSize: 13,
    lineHeight: 1.4,
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
    marginTop: 8,
  } as CSSProperties,
  sectionTitle: {
    fontSize: 17,
    fontWeight: 900,
    color: '#f9fafb',
    marginTop: 0,
    marginBottom: 12,
  } as CSSProperties,
  formGrid: {
    marginTop: 12,
    display: 'grid',
    gap: 16,
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
  fieldsGridMobile: {
    gridTemplateColumns: '1fr',
  } as CSSProperties,
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
  } as CSSProperties,
  label: {
    fontSize: 12,
    fontWeight: 700,
    color: '#e5e7eb',
  } as CSSProperties,
  input: {
    borderRadius: 11,
    border: '1px solid rgba(148,163,184,0.5)',
    padding: '10px 12px',
    background: 'rgba(15,23,42,0.9)',
    color: '#e5e7eb',
    fontSize: 13,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  } as CSSProperties,
  textarea: {
    borderRadius: 11,
    border: '1px solid rgba(148,163,184,0.5)',
    padding: '10px 12px',
    background: 'rgba(15,23,42,0.9)',
    color: '#e5e7eb',
    fontSize: 13,
    minHeight: 82,
    outline: 'none',
    resize: 'vertical',
    width: '100%',
    boxSizing: 'border-box',
  } as CSSProperties,
  requiredLegend: {
    marginTop: 8,
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
  footerRowMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
  } as CSSProperties,
  submitBtn: {
    borderRadius: 999,
    padding: '11px 20px',
    border: 'none',
    background: 'linear-gradient(135deg, #22c55e, #16a34a)',
    color: '#022c22',
    fontSize: 13,
    fontWeight: 900,
    cursor: 'pointer',
    boxShadow: '0 14px 35px rgba(34,197,94,0.24)',
  } as CSSProperties,
  submitBtnMobile: {
    width: '100%',
    borderRadius: 16,
    padding: '12px 16px',
  } as CSSProperties,
  helperText: {
    fontSize: 11,
    color: '#9ca3af',
    maxWidth: 460,
    lineHeight: 1.35,
  } as CSSProperties,
  successMsg: {
    marginTop: 12,
    fontSize: 13,
    color: '#bbf7d0',
    background: 'rgba(22,163,74,0.12)',
    border: '1px solid rgba(74,222,128,0.25)',
    padding: '10px 12px',
    borderRadius: 14,
  } as CSSProperties,
  segmented: {
    marginTop: 16,
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
  } as CSSProperties,
  segmentedMobile: {
    gridTemplateColumns: '1fr',
  } as CSSProperties,
  segmentedBtn: {
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'rgba(148,163,184,0.35)',
    borderRadius: 999,
    padding: '10px 12px',
    background: 'rgba(15,23,42,0.65)',
    color: '#e5e7eb',
    fontSize: 13,
    fontWeight: 900,
    cursor: 'pointer',
    minWidth: 0,
  } as CSSProperties,
  segmentedBtnMobile: {
    width: '100%',
    borderRadius: 16,
  } as CSSProperties,
  segmentedBtnActive: {
    background: 'linear-gradient(135deg, #4f46e5, #0ea5e9)',
    borderColor: 'rgba(125,211,252,0.55)',
    color: '#f9fafb',
  } as CSSProperties,
  statusForm: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
    marginTop: 12,
  } as CSSProperties,
  statusFormMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
  } as CSSProperties,
  statusInput: {
    flex: '1 1 220px',
    borderRadius: 999,
    border: '1px solid rgba(148,163,184,0.5)',
    padding: '10px 14px',
    background: 'rgba(15,23,42,0.9)',
    color: '#e5e7eb',
    fontSize: 13,
    outline: 'none',
    minWidth: 0,
    boxSizing: 'border-box',
  } as CSSProperties,
  statusInputMobile: {
    flex: '0 1 auto',
    width: '100%',
    borderRadius: 14,
  } as CSSProperties,
  statusBtn: {
    borderRadius: 999,
    padding: '10px 16px',
    border: 'none',
    background: 'linear-gradient(135deg, #38bdf8, #0ea5e9)',
    color: '#0f172a',
    fontSize: 13,
    fontWeight: 900,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  } as CSSProperties,
  statusBtnMobile: {
    width: '100%',
    borderRadius: 14,
  } as CSSProperties,
  list: {
    marginTop: 14,
    maxHeight: 560,
    overflowY: 'auto',
    paddingRight: 6,
    display: 'grid',
    gap: 12,
  } as CSSProperties,
  listMobile: {
    maxHeight: 'none',
    paddingRight: 0,
    overflowY: 'visible',
  } as CSSProperties,
  loanCard: {
    borderRadius: 18,
    border: '1px solid rgba(234,179,8,0.65)',
    background: 'rgba(15,23,42,0.82)',
    padding: 14,
    color: '#e5e7eb',
    minWidth: 0,
    boxSizing: 'border-box',
    overflowWrap: 'anywhere',
  } as CSSProperties,
  loanHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
    flexWrap: 'wrap',
  } as CSSProperties,
  loanTitle: {
    margin: 0,
    fontSize: 17,
    fontWeight: 900,
    color: '#f9fafb',
  } as CSSProperties,
  loanText: {
    margin: '7px 0',
    fontSize: 13,
    lineHeight: 1.35,
    color: '#e5e7eb',
    overflowWrap: 'anywhere',
  } as CSSProperties,
  muted: {
    color: '#94a3b8',
    fontSize: 12,
  } as CSSProperties,
  statusChip: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '5px 11px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 900,
    whiteSpace: 'nowrap',
  } as CSSProperties,
  errorText: {
    marginTop: 10,
    fontSize: 12,
    color: '#fecaca',
  } as CSSProperties,
  empty: {
    marginTop: 14,
    borderRadius: 16,
    border: '1px dashed rgba(148,163,184,0.4)',
    padding: 16,
    color: '#cbd5e1',
    fontSize: 13,
  } as CSSProperties,
};

type PrestamoConsulta = {
  id?: string;
  codigoSeguimiento: string;
  estado: string;
  nombreCompleto: string;
  cedula: string;
  telefono?: string;
  areaSolicitante: string;
  centroCosto: string;
  lugarUso: string;
  equipoRequerido: string;
  motivo?: string;
  createdByEmail?: string | null;
  entregadoPorNombre?: string | null;
  entregadoPorDocumento?: string | null;
  condicionEntrega?: string | null;
  devueltoPorNombre?: string | null;
  devueltoPorDocumento?: string | null;
  condicionDevolucion?: string | null;
  minutosEfectivos?: number | null;
  desdeSolicitado?: Date | null;
  hastaSolicitado?: Date | null;
  desdeAprobado?: Date | null;
  hastaAprobado?: Date | null;
  aprobadoEn?: Date | null;
  entregadoEn?: Date | null;
  devueltoEn?: Date | null;
  creadoEn?: Date | null;
  motivoRechazo?: string | null;
};

function normalizeEmail(email?: string | null) {
  return email ? String(email).trim().toLowerCase() : '';
}

function toJsDate(value: any): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (typeof value?.toDate === 'function') {
    const d = value.toDate();
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (typeof value?._pgTimestamp === 'string') {
    const d = new Date(value._pgTimestamp);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const seconds = value?.seconds ?? value?._seconds;
  if (typeof seconds === 'number') {
    const d = new Date(seconds * 1000);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  return null;
}

function formatDateTime(d?: Date | null) {
  if (!d) return '—';
  return d.toLocaleString('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function statusLabel(estado: string) {
  const e = String(estado || '').toLowerCase();
  if (e === 'pending' || e === 'pendiente') return 'PENDIENTE';
  if (e === 'approved' || e === 'aprobado') return 'APROBADO';
  if (e === 'in_loan' || e === 'en_prestamo' || e === 'en préstamo') return 'EN PRÉSTAMO';
  if (e === 'returned' || e === 'devuelto') return 'DEVUELTO';
  if (e === 'rejected' || e === 'rechazado') return 'RECHAZADO';
  return String(estado || 'PENDIENTE').toUpperCase();
}

function mapLoanData(id: string, data: any): PrestamoConsulta {
  return {
    id,
    codigoSeguimiento: data.trackingCode || data.tracking_code || '',
    estado: data.status || 'pending',

    nombreCompleto: data.applicantName || data.requesterName || data.requester_name || '',
    cedula: data.applicantId || data.requesterId || data.requester_id || '',
    telefono: data.contactPhone || data.phone || data.telefono || '',
    areaSolicitante: data.applicantArea || data.area || data.areaSolicitante || '',
    centroCosto: data.costCenter || data.cost_center || data.centroCosto || '',
    lugarUso: data.location || data.lugarUso || '',
    equipoRequerido: data.equipmentRequested || data.equipmentName || data.equipment_id || data.equipmentId || '',
    motivo: data.purpose || data.reason || data.motivo || '',

    createdByEmail: normalizeEmail(
      data.requesterEmail ||
      data.createdByEmail ||
      data.created_by_email ||
      data.requester_email
    ),

    desdeSolicitado: toJsDate(data.requestedFrom || data.loanDate || data.loan_date || data.requested_from),
    hastaSolicitado: toJsDate(data.requestedTo || data.returnDate || data.return_date || data.requested_to),

    desdeAprobado: toJsDate(data.approvedFrom || data.approved_from),
    hastaAprobado: toJsDate(data.approvedTo || data.approved_to),
    aprobadoEn: toJsDate(data.approvedAt || data.approved_at),

    entregadoEn: toJsDate(data.deliveredAt || data.delivered_at),
    devueltoEn: toJsDate(data.returnedAt || data.returned_at),
    entregadoPorNombre: data.deliveredByName || data.delivered_by_name || null,
    entregadoPorDocumento: data.deliveredByIdNumber || data.delivered_by_id_number || null,
    condicionEntrega: data.deliveredCondition || data.delivered_condition || null,
    devueltoPorNombre: data.returnedByName || data.returned_by_name || null,
    devueltoPorDocumento: data.returnedByIdNumber || data.returned_by_id_number || null,
    condicionDevolucion: data.returnedCondition || data.returned_condition || null,
    minutosEfectivos: data.effectiveMinutes ?? data.effective_minutes ?? null,

    creadoEn: toJsDate(data.createdAt || data.created_at),
    motivoRechazo: data.returnedCondition || data.returned_condition || null,
  };
}

function chipStyleByStatus(estado: string) {
  const base = { ...styles.statusChip };
  const e = String(estado || '').toLowerCase();
  if (e === 'pendiente' || e === 'pending') {
    return {
      ...base,
      background: 'rgba(234,179,8,0.18)',
      color: '#fde68a',
      border: '1px solid rgba(234,179,8,0.6)',
    } as CSSProperties;
  }
  if (e === 'aprobado' || e === 'approved') {
    return {
      ...base,
      background: 'rgba(34,197,94,0.16)',
      color: '#bbf7d0',
      border: '1px solid rgba(34,197,94,0.6)',
    } as CSSProperties;
  }
  if (e === 'en_prestamo' || e === 'en préstamo' || e === 'in_loan') {
    return {
      ...base,
      background: 'rgba(59,130,246,0.16)',
      color: '#bfdbfe',
      border: '1px solid rgba(59,130,246,0.6)',
    } as CSSProperties;
  }
  if (e === 'devuelto' || e === 'returned') {
    return {
      ...base,
      background: 'rgba(14,165,233,0.16)',
      color: '#bae6fd',
      border: '1px solid rgba(14,165,233,0.6)',
    } as CSSProperties;
  }
  if (e === 'rechazado' || e === 'rejected') {
    return {
      ...base,
      background: 'rgba(239,68,68,0.16)',
      color: '#fecaca',
      border: '1px solid rgba(239,68,68,0.6)',
    } as CSSProperties;
  }
  return {
    ...base,
    background: 'rgba(226,232,240,0.12)',
    color: '#e5e7eb',
    border: '1px solid rgba(226,232,240,0.35)',
  } as CSSProperties;
}

function LoanCard({ loan }: { loan: PrestamoConsulta }) {
  const esRechazado = ['rechazado', 'rejected'].includes(String(loan.estado || '').toLowerCase());

  return (
    <div style={styles.loanCard}>
      <div style={styles.loanHeader}>
        <div>
          <h3 style={styles.loanTitle}>{loan.equipoRequerido || 'Equipo solicitado'}</h3>
          <p style={styles.muted}>Código: <strong>{loan.codigoSeguimiento || '—'}</strong></p>
        </div>
        <span style={chipStyleByStatus(loan.estado)}>{statusLabel(loan.estado)}</span>
      </div>

      <p style={styles.loanText}><strong>Solicitante:</strong> {loan.nombreCompleto || '—'} • C.C. {loan.cedula || '—'}</p>
      <p style={styles.loanText}><strong>Área:</strong> {loan.areaSolicitante || '—'}</p>
      <p style={styles.loanText}><strong>Centro de costo:</strong> {loan.centroCosto || '—'}</p>
      <p style={styles.loanText}><strong>Lugar donde se usará:</strong> {loan.lugarUso || '—'}</p>
      {loan.telefono && <p style={styles.loanText}><strong>Teléfono:</strong> {loan.telefono}</p>}
      {loan.motivo && <p style={styles.loanText}><strong>Motivo:</strong> {loan.motivo}</p>}

      <p style={{ ...styles.loanText, marginTop: 10 }}>
        <strong>Rango solicitado:</strong> {formatDateTime(loan.desdeSolicitado)} → {formatDateTime(loan.hastaSolicitado)}
      </p>

      <p style={styles.loanText}>
        <strong>Rango aprobado:</strong>{' '}
        {loan.desdeAprobado || loan.hastaAprobado
          ? `${formatDateTime(loan.desdeAprobado)} → ${formatDateTime(loan.hastaAprobado)}`
          : 'Pendiente de aprobación'}
      </p>

      <p style={styles.loanText}><strong>Aprobado:</strong> {formatDateTime(loan.aprobadoEn)}</p>

      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed rgba(148,163,184,0.35)' }}>
        <p style={styles.loanText}><strong>Entregado:</strong> {formatDateTime(loan.entregadoEn)}</p>
        {loan.entregadoPorNombre && (
          <p style={styles.loanText}>
            <strong>Recibió el equipo:</strong> {loan.entregadoPorNombre}
            {loan.entregadoPorDocumento ? ` • C.C. ${loan.entregadoPorDocumento}` : ''}
          </p>
        )}
        {loan.condicionEntrega && (
          <p style={styles.loanText}><strong>Condición de entrega:</strong> {loan.condicionEntrega}</p>
        )}
      </div>

      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed rgba(148,163,184,0.35)' }}>
        <p style={styles.loanText}><strong>Devuelto:</strong> {formatDateTime(loan.devueltoEn)}</p>
        {loan.devueltoPorNombre && (
          <p style={styles.loanText}>
            <strong>Devolvió el equipo:</strong> {loan.devueltoPorNombre}
            {loan.devueltoPorDocumento ? ` • C.C. ${loan.devueltoPorDocumento}` : ''}
          </p>
        )}
        {loan.condicionDevolucion && !esRechazado && (
          <p style={styles.loanText}><strong>Condición de devolución:</strong> {loan.condicionDevolucion}</p>
        )}
        {loan.minutosEfectivos != null && (
          <p style={styles.loanText}><strong>Tiempo efectivo:</strong> {loan.minutosEfectivos} min</p>
        )}
      </div>

      {esRechazado && (
        <p style={{ ...styles.loanText, color: '#fecaca', marginTop: 10 }}>
          <strong>Motivo del rechazo:</strong> {loan.motivoRechazo || 'No se registró un motivo específico.'}
        </p>
      )}
    </div>
  );
}

export default function PrestamoEquipoPage() {
  const { data: session } = useSession();
  const corporateUser = useMemo(
    () => ({
      name: session?.user?.name || '',
      email: normalizeEmail(session?.user?.email || ''),
    }),
    [session?.user?.name, session?.user?.email]
  );

  const [enviando, setEnviando] = useState(false);
  const [mensajeOk, setMensajeOk] = useState('');
  const [codigoGenerado, setCodigoGenerado] = useState('');

  const [rightTab, setRightTab] = useState<'mine' | 'code'>('mine');
  const [misPrestamos, setMisPrestamos] = useState<PrestamoConsulta[]>([]);
  const [misPrestamosLoading, setMisPrestamosLoading] = useState(false);
  const [misPrestamosError, setMisPrestamosError] = useState('');

  const [codigoConsulta, setCodigoConsulta] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [errorConsulta, setErrorConsulta] = useState('');
  const [resultado, setResultado] = useState<PrestamoConsulta | null>(null);

  const loadMyLoans = async () => {
    const email = normalizeEmail(corporateUser.email);
    if (!email) {
      setMisPrestamos([]);
      return;
    }

    setMisPrestamosLoading(true);
    setMisPrestamosError('');

    try {
      const qByEmail = query(
        collection(db, 'equipmentLoans'),
        where('requesterEmail', '==', email)
      );
      const snap = await getDocs(qByEmail);

      const rows = snap.docs
        .map((docSnap: any) => mapLoanData(docSnap.id, docSnap.data()))
        .sort((a: PrestamoConsulta, b: PrestamoConsulta) => {
          const bTime = b.creadoEn?.getTime() || 0;
          const aTime = a.creadoEn?.getTime() || 0;
          return bTime - aTime;
        });

      setMisPrestamos(rows);
    } catch (error) {
      console.error('Error cargando mis préstamos:', error);
      setMisPrestamosError('No se pudieron cargar tus solicitudes de préstamo.');
    } finally {
      setMisPrestamosLoading(false);
    }
  };

  useEffect(() => {
    loadMyLoans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [corporateUser.email]);

  const handlePortalLogout = async () => {
    await signOut({ callbackUrl: '/' });
  };

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
      const requesterEmail = normalizeEmail(corporateUser.email);

      const desdeStr = String(data.get('desde') || '');
      const hastaStr = String(data.get('hasta') || '');

      const desdeDate = new Date(desdeStr);
      const hastaDate = new Date(hastaStr);

      if (Number.isNaN(desdeDate.getTime()) || Number.isNaN(hastaDate.getTime())) {
        throw new Error('Fechas inválidas');
      }

      if (hastaDate <= desdeDate) {
        throw new Error('La fecha final debe ser posterior a la inicial');
      }

      const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
      const codigoSeguimiento = `PE-${randomPart}`;
      const loanId = `LOAN-${crypto.randomUUID()}`;

      const docRef = await addDoc(collection(db, 'equipmentLoans'), {
        id: loanId,
        trackingCode: codigoSeguimiento,
        status: 'pending',
        createdAt: serverTimestamp(),

        requestedFrom: Timestamp.fromDate(desdeDate),
        requestedTo: Timestamp.fromDate(hastaDate),

        applicantName: nombreCompleto,
        applicantId: cedula,
        contactPhone: telefono,
        applicantArea: areaSolicitante,
        costCenter: centroCosto,
        location: lugarUso,

        equipmentRequested: equipoRequerido,
        purpose: motivo,

        requesterEmail: requesterEmail || null,
        createdByEmail: requesterEmail || null,
        createdByName: corporateUser.name || nombreCompleto,
        authProvider: 'microsoft',

        approvedFrom: null,
        approvedTo: null,
        approvedAt: null,
        deliveredAt: null,
        returnedAt: null,
        returnedCondition: null,
      });


      // ✅ NUEVO: notificación interna para administradores
try {
  await fetch('/api/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      role: 'admin',
      title: 'Nueva solicitud de préstamo',
      message: `${nombreCompleto} solicitó préstamo de equipo: ${equipoRequerido}`,
      type: 'equipment_loan_created',
      related_id: docRef.id,
      related_module: 'equipmentLoans',
    }),
  });
} catch (notificationErr) {
  console.error('Error creando notificación interna:', notificationErr);
}

      form.reset();

      setCodigoGenerado(codigoSeguimiento);
      setMensajeOk(
        `Solicitud enviada correctamente. Tu código de seguimiento es: ${codigoSeguimiento}. También la verás en “Mis solicitudes”.`
      );
      setRightTab('mine');
      await loadMyLoans();
    } catch (err) {
      console.error(err);
      setMensajeOk('Ocurrió un error al enviar la solicitud. Intenta nuevamente.');
    } finally {
      setEnviando(false);
    }
  };

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
        setErrorConsulta('No se encontró ninguna solicitud con ese código. Verifica que esté bien escrito.');
        return;
      }

      const docSnap = snap.docs[0];
      const data = docSnap.data() as any;
      setResultado(mapLoanData(docSnap.id, data));
    } catch (err) {
      console.error(err);
      setErrorConsulta('No se pudo consultar el estado. Intenta de nuevo en unos segundos.');
    } finally {
      setBuscando(false);
    }
  };

  const portalBadge = useMemo(() => {
    if (!corporateUser.email && !corporateUser.name) return null;
    return {
      name: corporateUser.name || 'Usuario corporativo',
      email: corporateUser.email,
    };
  }, [corporateUser.email, corporateUser.name]);

  const [viewportWidth, setViewportWidth] = useState(1180);

  useEffect(() => {
    const updateViewportWidth = () => setViewportWidth(window.innerWidth);
    updateViewportWidth();
    window.addEventListener('resize', updateViewportWidth);
    return () => window.removeEventListener('resize', updateViewportWidth);
  }, []);

  const isMobileLayout = viewportWidth <= 768;

  return (
    <PortalMicrosoftGuard callbackUrl="/prestamo-equipo">
      <main style={{ ...styles.page, ...(isMobileLayout ? styles.pageMobile : {}) }}>
        <div style={{ ...styles.container, ...(isMobileLayout ? styles.containerMobile : {}) }}>
          <Link href="/solicitudes" style={{ ...styles.backLink, ...(isMobileLayout ? styles.backLinkMobile : {}) }}>
            <span>←</span> <span>Volver al menú de solicitudes</span>
          </Link>

          <header style={{ ...styles.header, ...(isMobileLayout ? styles.headerMobile : {}) }}>
            <div style={{ ...styles.headerLeft, ...(isMobileLayout ? styles.headerLeftMobile : {}) }}>
              <div style={{ ...styles.headerIcon, ...(isMobileLayout ? styles.headerIconMobile : {}) }}>🚜</div>
              <div>
                <h1 style={{ ...styles.headerTitle, ...(isMobileLayout ? styles.headerTitleMobile : {}) }}>Solicitud de préstamo de equipo</h1>
                <p style={{ ...styles.headerSubtitle, ...(isMobileLayout ? styles.headerSubtitleMobile : {}) }}>
                  Envía solicitudes de préstamo y consulta su estado en un solo lugar.
                </p>
                <div style={styles.badge}>Nuevo préstamo</div>
              </div>
            </div>

            {portalBadge && (
              <div style={{ ...styles.accountBox, ...(isMobileLayout ? styles.accountBoxMobile : {}) }}>
                <div>
                  <div style={styles.accountName}>{portalBadge.name}</div>
                  <div style={styles.accountEmail}>{portalBadge.email}</div>
                </div>
                <button type="button" style={styles.logoutBtn} onClick={handlePortalLogout}>
                  Salir
                </button>
              </div>
            )}
          </header>

          <div style={{ ...styles.mainGrid, ...(isMobileLayout ? styles.mainGridMobile : {}) }}>
            <section style={{ ...styles.card, ...(isMobileLayout ? styles.cardMobile : {}) }}>
              <h2 style={styles.cardTitle}>Nueva solicitud</h2>
              <p style={styles.cardSubtitle}>
                Completa los datos del préstamo. El administrador revisará la solicitud y actualizará el estado.
              </p>

              <div style={styles.notice}>
                <strong>Sesión corporativa activa:</strong> las solicitudes de préstamo quedarán asociadas a tu cuenta Microsoft para que puedas consultarlas en este mismo panel.
              </div>

              <form onSubmit={handleSubmit}>
                <input type="hidden" name="requesterEmail" value={corporateUser.email || ''} readOnly />

                <div style={styles.formGrid}>
                  <section style={styles.groupCard}>
                    <h3 style={styles.sectionTitle}>Datos del solicitante</h3>

                    <div style={{ ...styles.fieldsGrid2, ...(isMobileLayout ? styles.fieldsGridMobile : {}) }}>
                      <div style={styles.field}>
                        <label style={styles.label}>Nombre completo <span style={{ color: '#f97316' }}>*</span></label>
                        <input name="nombreCompleto" type="text" defaultValue={corporateUser.name || ''} placeholder="Ej: Juan Pérez" style={styles.input} required />
                      </div>

                      <div style={styles.field}>
                        <label style={styles.label}>Cédula <span style={{ color: '#f97316' }}>*</span></label>
                        <input name="cedula" type="text" placeholder="Ej: 123456789" style={styles.input} required />
                      </div>

                      <div style={styles.field}>
                        <label style={styles.label}>Teléfono <span style={{ color: '#f97316' }}>*</span></label>
                        <input name="telefono" type="text" placeholder="Ej: 3001234567" style={styles.input} required />
                      </div>

                      <div style={styles.field}>
                        <label style={styles.label}>Área solicitante <span style={{ color: '#f97316' }}>*</span></label>
                        <input name="areaSolicitante" type="text" placeholder="Ej: Mantenimiento, Producción…" style={styles.input} required />
                      </div>

                      <div style={styles.field}>
                        <label style={styles.label}>Centro de costo <span style={{ color: '#f97316' }}>*</span></label>
                        <input name="centroCosto" type="text" placeholder="Ej: CC-0123" style={styles.input} required />
                      </div>

                      <div style={styles.field}>
                        <label style={styles.label}>Lugar donde se usará el equipo <span style={{ color: '#f97316' }}>*</span></label>
                        <input name="lugarUso" type="text" placeholder="Ej: Patio almacén, frente 3…" style={styles.input} required />
                      </div>
                    </div>
                  </section>

                  <section style={styles.groupCard}>
                    <h3 style={styles.sectionTitle}>Detalles del préstamo</h3>

                    <div style={{ ...styles.fieldsGrid2, ...(isMobileLayout ? styles.fieldsGridMobile : {}) }}>
                      <div style={styles.field}>
                        <label style={styles.label}>Equipo requerido (tipo / referencia) <span style={{ color: '#f97316' }}>*</span></label>
                        <input name="equipoRequerido" type="text" placeholder="Ej: Montacarga 3T, Manlift 1…" style={styles.input} required />
                      </div>

                      <div style={styles.field}>
                        <label style={styles.label}>Motivo del préstamo / actividad a realizar <span style={{ color: '#f97316' }}>*</span></label>
                        <textarea name="motivo" placeholder="Describe brevemente para qué necesitas el equipo." style={styles.textarea} required />
                      </div>
                    </div>

                    <div style={{ ...styles.fieldsGrid2, ...(isMobileLayout ? styles.fieldsGridMobile : {}), marginTop: 10 }}>
                      <div style={styles.field}>
                        <label style={styles.label}>Desde (fecha y hora) <span style={{ color: '#f97316' }}>*</span></label>
                        <input name="desde" type="datetime-local" style={styles.input} required />
                      </div>

                      <div style={styles.field}>
                        <label style={styles.label}>Hasta (fecha y hora) <span style={{ color: '#f97316' }}>*</span></label>
                        <input name="hasta" type="datetime-local" style={styles.input} required />
                      </div>
                    </div>

                    <p style={styles.requiredLegend}>Los campos marcados con <span style={{ color: '#f97316' }}>*</span> son obligatorios.</p>
                  </section>
                </div>

                <div style={{ ...styles.footerRow, ...(isMobileLayout ? styles.footerRowMobile : {}) }}>
                  <p style={styles.helperText}>
                    Al enviar la solicitud se generará un código de seguimiento. También podrás verla en “Mis solicitudes” con tu cuenta Microsoft.
                  </p>

                  <button type="submit" style={{ ...styles.submitBtn, ...(isMobileLayout ? styles.submitBtnMobile : {}) }} disabled={enviando}>
                    {enviando ? 'Enviando solicitud…' : 'Enviar solicitud de préstamo'}
                  </button>
                </div>

                {mensajeOk && <p style={styles.successMsg}>{mensajeOk}</p>}
              </form>
            </section>

            <section style={{ ...styles.card, ...(isMobileLayout ? styles.cardMobile : {}) }}>
              <h2 style={styles.cardTitle}>Seguimiento</h2>
              <p style={styles.cardSubtitle}>
                Visualiza tus solicitudes fácilmente. Puedes revisar el estado del préstamo o consultar por código.
              </p>

              <div style={{ ...styles.segmented, ...(isMobileLayout ? styles.segmentedMobile : {}) }}>
                <button
                  type="button"
                  style={{
                    ...styles.segmentedBtn,
                    ...(isMobileLayout ? styles.segmentedBtnMobile : {}),
                    ...(rightTab === 'mine' ? styles.segmentedBtnActive : {}),
                  }}
                  onClick={() => setRightTab('mine')}
                >
                  Mis solicitudes
                </button>
                <button
                  type="button"
                  style={{
                    ...styles.segmentedBtn,
                    ...(isMobileLayout ? styles.segmentedBtnMobile : {}),
                    ...(rightTab === 'code' ? styles.segmentedBtnActive : {}),
                  }}
                  onClick={() => setRightTab('code')}
                >
                  Consultar por código
                </button>
              </div>

              {codigoGenerado && (
                <p style={{ ...styles.muted, marginTop: 12 }}>
                  Último código generado: <strong>{codigoGenerado}</strong>
                </p>
              )}

              {rightTab === 'mine' && (
                <div style={{ ...styles.list, ...(isMobileLayout ? styles.listMobile : {}) }}>
                  {misPrestamosLoading && <p style={styles.muted}>Cargando tus solicitudes…</p>}
                  {misPrestamosError && <p style={styles.errorText}>{misPrestamosError}</p>}
                  {!misPrestamosLoading && !misPrestamosError && misPrestamos.length === 0 && (
                    <div style={styles.empty}>
                      Todavía no tienes solicitudes de préstamo asociadas a esta cuenta. Cuando envíes una solicitud, aparecerá aquí automáticamente.
                    </div>
                  )}
                  {!misPrestamosLoading && misPrestamos.map((loan) => (
                    <LoanCard key={loan.id || loan.codigoSeguimiento} loan={loan} />
                  ))}
                </div>
              )}

              {rightTab === 'code' && (
                <div style={{ marginTop: 14 }}>
                  <p style={styles.muted}>
                    Ingresa el código de seguimiento, por ejemplo <code>PE-3MCM91</code>.
                  </p>

                  <form onSubmit={handleCheckStatus} style={{ ...styles.statusForm, ...(isMobileLayout ? styles.statusFormMobile : {}) }}>
                    <input
                      style={{ ...styles.statusInput, ...(isMobileLayout ? styles.statusInputMobile : {}) }}
                      placeholder="Ej: PE-3MCM91"
                      value={codigoConsulta}
                      onChange={(e) => setCodigoConsulta(e.target.value)}
                    />
                    <button type="submit" style={{ ...styles.statusBtn, ...(isMobileLayout ? styles.statusBtnMobile : {}) }} disabled={buscando}>
                      {buscando ? 'Buscando…' : 'Consultar estado'}
                    </button>
                  </form>

                  {errorConsulta && <p style={styles.errorText}>{errorConsulta}</p>}

                  {resultado && (
                    <div style={{ marginTop: 14 }}>
                      <LoanCard loan={resultado} />
                    </div>
                  )}

                  {!resultado && !errorConsulta && (
                    <div style={styles.empty}>
                      Si tienes un código de seguimiento, puedes consultarlo aquí. La pestaña “Mis solicitudes” muestra el historial asociado a tu cuenta Microsoft.
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </PortalMicrosoftGuard>
  );
}
