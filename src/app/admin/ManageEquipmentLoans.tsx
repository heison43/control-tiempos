'use client';

import {
  useEffect,
  useMemo,
  useState,
  FormEvent
} from 'react';
import {
  db,
  collection,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  doc,
  serverTimestamp,
  Timestamp
} from '../../lib/pgFirestoreCompat';

type LoanStatus = 'pending' | 'approved' | 'in_loan' | 'returned' | 'rejected';

type DateLike =
  | Date
  | string
  | number
  | {
      seconds?: number;
      nanoseconds?: number;
      _seconds?: number;
      _nanoseconds?: number;
      _pgTimestamp?: string;
      toDate?: () => Date;
    }
  | null
  | undefined;

interface EquipmentLoan {
  id: string;
  trackingCode?: string;
  status?: LoanStatus;

  createdAt?: DateLike;
  updatedAt?: DateLike;
  approvedAt?: DateLike;
  deliveredAt?: DateLike;
  returnedAt?: DateLike;

  // rango solicitado por el usuario
  requestedFrom?: DateLike;
  requestedTo?: DateLike;

  // rango finalmente aprobado por el admin
  approvedFrom?: DateLike;
  approvedTo?: DateLike;

  // compatibilidad con PostgreSQL / nombres alternos
  loanDate?: DateLike;
  returnDate?: DateLike;
  requesterEmail?: string | null;
  createdByEmail?: string | null;

  // datos del solicitante
  applicantName?: string;
  applicantId?: string;
  contactPhone?: string;
  applicantArea?: string;
  costCenter?: string;
  location?: string;

  // equipo y observaciones
  equipmentRequested?: string;
  purpose?: string;

  // entrega / devolución
  deliveredByName?: string | null;
  deliveredByIdNumber?: string | null;
  deliveredCondition?: string | null;
  returnedByName?: string | null;
  returnedByIdNumber?: string | null;
  returnedCondition?: string | null;

  effectiveMinutes?: number | null;
}

function firstValue<T = any>(...values: T[]): T | undefined {
  return values.find((value) => value !== undefined && value !== null && value !== '') as T | undefined;
}

function toJsDate(value: DateLike): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (typeof value.toDate === 'function') {
    const d = value.toDate();
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (typeof value._pgTimestamp === 'string') {
    const d = new Date(value._pgTimestamp);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const seconds = value.seconds ?? value._seconds;
  if (typeof seconds === 'number') {
    const d = new Date(seconds * 1000);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  return null;
}

function normalizeLoan(id: string, data: any): EquipmentLoan {
  const metadata = data?.metadata || {};
  const source = { ...metadata, ...data };

  return {
    ...source,
    id,
    trackingCode: firstValue(source.trackingCode, source.tracking_code),
    status: firstValue(source.status, 'pending') as LoanStatus,

    createdAt: firstValue(source.createdAt, source.created_at),
    updatedAt: firstValue(source.updatedAt, source.updated_at),
    approvedAt: firstValue(source.approvedAt, source.approved_at),
    deliveredAt: firstValue(source.deliveredAt, source.delivered_at),
    returnedAt: firstValue(source.returnedAt, source.returned_at),

    requestedFrom: firstValue(
      source.requestedFrom,
      source.requested_from,
      source.loanDate,
      source.loan_date
    ),
    requestedTo: firstValue(
      source.requestedTo,
      source.requested_to,
      source.returnDate,
      source.return_date
    ),

    approvedFrom: firstValue(source.approvedFrom, source.approved_from),
    approvedTo: firstValue(source.approvedTo, source.approved_to),

    loanDate: firstValue(source.loanDate, source.loan_date),
    returnDate: firstValue(source.returnDate, source.return_date),

    applicantName: firstValue(
      source.applicantName,
      source.requesterName,
      source.requester_name
    ),
    applicantId: firstValue(source.applicantId, source.requesterId, source.requester_id),
    contactPhone: firstValue(source.contactPhone, source.contact_phone),
    applicantArea: firstValue(source.applicantArea, source.requesterArea, source.area),
    costCenter: firstValue(source.costCenter, source.cost_center),
    location: source.location,

    equipmentRequested: firstValue(
      source.equipmentRequested,
      source.equipmentName,
      source.equipmentId,
      source.equipment_id
    ),
    purpose: firstValue(source.purpose, source.reason),

    requesterEmail: firstValue(source.requesterEmail, source.requester_email),
    createdByEmail: firstValue(source.createdByEmail, source.created_by_email),

    deliveredByName: firstValue(source.deliveredByName, source.delivered_by_name),
    deliveredByIdNumber: firstValue(
      source.deliveredByIdNumber,
      source.delivered_by_id_number
    ),
    deliveredCondition: firstValue(
      source.deliveredCondition,
      source.delivered_condition
    ),
    returnedByName: firstValue(source.returnedByName, source.returned_by_name),
    returnedByIdNumber: firstValue(
      source.returnedByIdNumber,
      source.returned_by_id_number
    ),
    returnedCondition: firstValue(
      source.returnedCondition,
      source.returned_condition
    ),
    effectiveMinutes: firstValue(
      source.effectiveMinutes,
      source.effective_minutes
    ) as number | null,
  };
}

function minutesBetween(start: DateLike, end: Date) {
  const startDate = toJsDate(start);
  if (!startDate) return null;
  const diffMs = end.getTime() - startDate.getTime();
  return diffMs > 0 ? Math.round(diffMs / 60000) : 0;
}

function toInputDateTime(value?: DateLike) {
  const d = toJsDate(value);
  if (!d) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate()
  )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const statusLabels: Record<LoanStatus | 'all', string> = {
  all: 'Todos',
  pending: 'Pendiente',
  approved: 'Aprobado',
  in_loan: 'En préstamo',
  returned: 'Devuelto',
  rejected: 'Rechazado',
};

export default function ManageEquipmentLoans() {
  const [loans, setLoans] = useState<EquipmentLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<LoanStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  // layout responsive
  const [isMobileLayout, setIsMobileLayout] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      // 1024px o menos: usamos layout de una columna (lista arriba, detalle abajo)
      setIsMobileLayout(window.innerWidth <= 1024);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // modal de aprobación (rango de fechas)
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approveFrom, setApproveFrom] = useState('');
  const [approveTo, setApproveTo] = useState('');

  // ---- Cargar préstamos ----
  useEffect(() => {
    const q = query(
      collection(db, 'equipmentLoans'),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items: EquipmentLoan[] = snap.docs.map((d) =>
          normalizeLoan(d.id, d.data() as any)
        );
        setLoans(items);
        if (!selectedLoanId && items.length > 0) {
          setSelectedLoanId(items[0].id);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error cargando préstamos:', err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [selectedLoanId]);

  const filteredLoans = useMemo(() => {
    return loans.filter((loan) => {
      if (statusFilter !== 'all' && loan.status !== statusFilter) return false;

      if (!search.trim()) return true;
      const s = search.trim().toLowerCase();

      const haystack = [
        loan.trackingCode,
        loan.applicantName,
        loan.applicantId,
        loan.contactPhone,
        loan.equipmentRequested,
        loan.purpose,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(s);
    });
  }, [loans, statusFilter, search]);

  const selectedLoan = useMemo(
    () =>
      filteredLoans.find((l) => l.id === selectedLoanId) ??
      filteredLoans[0] ??
      null,
    [filteredLoans, selectedLoanId]
  );

  const stats = useMemo(
    () => ({
      total: loans.length,
      pending: loans.filter((l) => l.status === 'pending').length,
      approved: loans.filter((l) => l.status === 'approved').length,
      in_loan: loans.filter((l) => l.status === 'in_loan').length,
      returned: loans.filter((l) => l.status === 'returned').length,
      rejected: loans.filter((l) => l.status === 'rejected').length,
    }),
    [loans]
  );

  const formatDate = (value?: DateLike) => {
    const d = toJsDate(value);
    if (!d) return '—';
    return d.toLocaleString('es-CO', { timeZone: 'America/Bogota' });
  };

  const formatShortDate = (value?: DateLike) => {
    const d = toJsDate(value);
    if (!d) return '—';
    return d.toLocaleDateString('es-CO', { timeZone: 'America/Bogota' });
  };

  const formatTime = (value?: DateLike) => {
    const d = toJsDate(value);
    if (!d) return '—';
    return d.toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Bogota',
    });
  };

  // ---- Acciones ----

  const updateLoan = async (id: string, data: Partial<EquipmentLoan>) => {
    setUpdating(true);
    try {
      const ref = doc(db, 'equipmentLoans', id);
      await updateDoc(ref, data as any);
    } catch (err) {
      console.error('Error actualizando préstamo:', err);
      alert('No fue posible actualizar el préstamo.');
    } finally {
      setUpdating(false);
    }
  };

  // abrir modal de aprobación
  const openApproveModal = (loan: EquipmentLoan) => {
    setApproveFrom(
      toInputDateTime(loan.approvedFrom || loan.requestedFrom || null)
    );
    setApproveTo(
      toInputDateTime(loan.approvedTo || loan.requestedTo || null)
    );
    setShowApproveModal(true);
  };

  // guardar aprobación con rango de fechas
  const handleApproveSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedLoan) return;

    if (!approveFrom || !approveTo) {
      alert('Debes indicar fecha y hora de inicio y de devolución.');
      return;
    }

    const fromDate = new Date(approveFrom);
    const toDate = new Date(approveTo);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      alert('Las fechas ingresadas no son válidas.');
      return;
    }

    if (toDate <= fromDate) {
      alert('La fecha de devolución debe ser posterior a la fecha de inicio.');
      return;
    }

    await updateLoan(selectedLoan.id, {
      status: 'approved',
      approvedAt: serverTimestamp() as any,
      approvedFrom: Timestamp.fromDate(fromDate) as any,
      approvedTo: Timestamp.fromDate(toDate) as any,
    });

    setShowApproveModal(false);
  };

  const handleReject = async (loan: EquipmentLoan) => {
    const msg = window.prompt(
      'Motivo del rechazo (opcional):',
      'Solicitud rechazada.'
    );
    if (msg === null) return;

    await updateLoan(loan.id, {
      status: 'rejected',
      returnedCondition: msg || 'Solicitud rechazada.',
      returnedAt: serverTimestamp() as any,
    });
  };

  const handleDelivered = async (loan: EquipmentLoan) => {
    const deliveredByName = window.prompt(
      'Nombre de quien recibe el equipo:',
      ''
    );
    if (deliveredByName === null) return;

    const deliveredByIdNumber = window.prompt(
      'Documento de quien recibe el equipo:',
      ''
    );
    if (deliveredByIdNumber === null) return;

    const deliveredCondition =
      window.prompt('Condición del equipo al entregar (opcional):', '') || null;

    await updateLoan(loan.id, {
      status: 'in_loan',
      deliveredAt: serverTimestamp() as any,
      deliveredByName: deliveredByName.trim() || null,
      deliveredByIdNumber: deliveredByIdNumber.trim() || null,
      deliveredCondition,
    });
  };

  const handleReturned = async (loan: EquipmentLoan) => {
    if (!loan.deliveredAt) {
      alert('Este préstamo no tiene fecha de entrega registrada.');
      return;
    }

    const returnedByName =
      window.prompt('Nombre de quien devuelve el equipo:', '') || null;
    if (returnedByName === null) return;

    const returnedByIdNumber =
      window.prompt('Documento de quien devuelve el equipo:', '') || null;
    if (returnedByIdNumber === null) return;

    const returnedCondition =
      window.prompt('Condición del equipo al devolver (opcional):', '') || null;

    const effMinutes = minutesBetween(loan.deliveredAt, new Date());

    await updateLoan(loan.id, {
      status: 'returned',
      returnedAt: serverTimestamp() as any,
      returnedByName: returnedByName.trim() || null,
      returnedByIdNumber: returnedByIdNumber.trim() || null,
      returnedCondition,
      effectiveMinutes: effMinutes,
    });
  };

  // ---- Exportar CSV ----
  const handleExportCSV = () => {
    if (!filteredLoans.length) {
      alert('No hay préstamos con los filtros actuales.');
      return;
    }

    const header = [
      'Código',
      'Estado',
      'Fecha Solicitud',
      'Solicitante',
      'Documento',
      'Teléfono',
      'Área',
      'Centro de costo',
      'Lugar',
      'Equipo solicitado',
      'Motivo',
      'Desde solicitado',
      'Hasta solicitado',
      'Desde aprobado',
      'Hasta aprobado',
      'Aprobado',
      'Entregado',
      'Devuelto',
      'Minutos efectivos',
    ];

    const rows = filteredLoans.map((l) => [
      l.trackingCode || '',
      l.status || '',
      formatDate(l.createdAt),
      l.applicantName || '',
      l.applicantId || '',
      l.contactPhone || '',
      l.applicantArea || '',
      l.costCenter || '',
      l.location || '',
      l.equipmentRequested || '',
      l.purpose || '',
      formatDate(l.requestedFrom),
      formatDate(l.requestedTo),
      formatDate(l.approvedFrom),
      formatDate(l.approvedTo),
      formatDate(l.approvedAt),
      formatDate(l.deliveredAt),
      formatDate(l.returnedAt),
      l.effectiveMinutes != null ? l.effectiveMinutes : '',
    ]);

    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prestamos_equipo_${new Date()
      .toLocaleDateString('es-CO')
      .replace(/\//g, '-')}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // ---- UI ----
  return (
    <>
      <section
        style={{
          ...styles.card,
          ...(isMobileLayout ? styles.cardMobile : {}),
        }}
      >
        <div
          style={{
            ...styles.cardHeader,
            ...(isMobileLayout ? styles.cardHeaderMobile : {}),
          }}
        >
          <div>
            <h2 style={styles.cardTitle}>🚛 Préstamos de equipo</h2>
            <p style={styles.cardSubtitle}>
              Gestiona las solicitudes de préstamo: aprobación, entrega,
              devolución y registro histórico.
            </p>

            <div style={styles.chipRow}>
              <span style={styles.chipMuted}>
                📌 Total: <strong>{stats.total}</strong>
              </span>
              <span style={styles.chipPending}>
                ⏳ Pendientes: <strong>{stats.pending}</strong>
              </span>
              <span style={styles.chipApproved}>
                ✅ Aprobados: <strong>{stats.approved}</strong>
              </span>
              <span style={styles.chipInLoan}>
                🚚 En préstamo: <strong>{stats.in_loan}</strong>
              </span>
              <span style={styles.chipReturned}>
                📦 Devueltos: <strong>{stats.returned}</strong>
              </span>
              <span style={styles.chipRejected}>
                ❌ Rechazados: <strong>{stats.rejected}</strong>
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleExportCSV}
            style={{
              ...styles.btnExport,
              ...(isMobileLayout ? styles.btnExportMobile : {}),
            }}
          >
            📥 Exportar CSV
          </button>
        </div>

        {/* Filtros */}
        <div
          style={{
            ...styles.filtersBar,
            ...(isMobileLayout ? styles.filtersBarMobile : {}),
          }}
        >
          <div style={styles.statusTabs}>
            {(
              [
                'all',
                'pending',
                'approved',
                'in_loan',
                'returned',
                'rejected',
              ] as (LoanStatus | 'all')[]
            ).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                style={{
                  ...styles.statusTab,
                  ...(statusFilter === st ? styles.statusTabActive : {}),
                }}
              >
                {statusLabels[st]}
              </button>
            ))}
          </div>

          <div style={styles.searchBox}>
            <span style={styles.searchIcon}>🔍</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por código, solicitante, documento..."
              style={styles.searchInput}
            />
          </div>
        </div>

        {/* Contenido principal: lista + detalle */}
        <div
          style={{
            ...styles.mainGrid,
            ...(isMobileLayout ? styles.mainGridMobile : {}),
          }}
        >
          {/* Lista */}
          <div style={styles.listPanel}>
            <div style={styles.listHeader}>
              <span style={styles.listTitle}>Solicitudes registradas</span>
              <span style={styles.listCounter}>
                {filteredLoans.length} de {loans.length} préstamos
              </span>
            </div>

            {loading ? (
              <div style={styles.listEmpty}>Cargando préstamos...</div>
            ) : filteredLoans.length === 0 ? (
              <div style={styles.listEmpty}>
                No hay préstamos con los filtros actuales.
                <br />
                Selecciona otro estado o borra el texto de búsqueda.
              </div>
            ) : (
              <div style={styles.listItems}>
                {filteredLoans.map((loan) => (
                  <button
                    key={loan.id}
                    type="button"
                    onClick={() => setSelectedLoanId(loan.id)}
                    style={{
                      ...styles.listItem,
                      ...(selectedLoan && selectedLoan.id === loan.id
                        ? styles.listItemActive
                        : {}),
                    }}
                  >
                    <div style={styles.listItemTop}>
                      <span style={styles.loanCode}>
                        {loan.trackingCode || 'SIN-CÓDIGO'}
                      </span>
                      <span
                        style={styles.badgeSmall(loan.status || 'pending')}
                      >
                        {
                          statusLabels[
                            (loan.status || 'pending') as LoanStatus
                          ]
                        }
                      </span>
                    </div>
                    <div style={styles.listItemMain}>
                      <div style={styles.listItemName}>
                        {loan.applicantName || 'Sin nombre'}
                      </div>
                      <div style={styles.listItemSub}>
                        {loan.applicantId
                          ? `C.C. ${loan.applicantId} • `
                          : ''}
                        {loan.equipmentRequested || ''}
                      </div>
                    </div>
                    <div style={styles.listItemDate}>
                      {formatShortDate(loan.createdAt)}
                      <br />
                      <span style={{ fontSize: '0.7rem' }}>
                        {formatTime(loan.createdAt)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Detalle */}
          <div
            style={{
              ...styles.detailPanel,
              ...(isMobileLayout ? styles.detailPanelMobile : {}),
            }}
          >
            {!selectedLoan ? (
              <div style={styles.detailEmpty}>
                Selecciona un préstamo en la lista para ver el detalle.
              </div>
            ) : (
              <>
                <div style={styles.detailHeader}>
                  <div>
                    <div style={styles.detailLabel}>Código de seguimiento</div>
                    <div style={styles.detailCode}>
                      {selectedLoan.trackingCode || 'SIN-CÓDIGO'}
                    </div>
                  </div>
                  <span
                    style={styles.badgeLarge(
                      selectedLoan.status || 'pending'
                    )}
                  >
                    {
                      statusLabels[
                        (selectedLoan.status || 'pending') as LoanStatus
                      ]
                    }
                  </span>
                </div>

                <div style={styles.detailGrid}>
                  <div>
                    <div style={styles.detailLabel}>Solicitante</div>
                    <div style={styles.detailValue}>
                      {selectedLoan.applicantName || '—'}
                      {selectedLoan.applicantId
                        ? ` • C.C. ${selectedLoan.applicantId}`
                        : ''}
                      {selectedLoan.contactPhone
                        ? ` • 📞 ${selectedLoan.contactPhone}`
                        : ''}
                    </div>
                  </div>

                  <div>
                    <div style={styles.detailLabel}>
                      Área / Centro de costo
                    </div>
                    <div style={styles.detailValue}>
                      {selectedLoan.applicantArea || '—'}
                      {selectedLoan.costCenter
                        ? ` • ${selectedLoan.costCenter}`
                        : ''}
                    </div>
                  </div>

                  <div>
                    <div style={styles.detailLabel}>Lugar donde se usará</div>
                    <div style={styles.detailValue}>
                      {selectedLoan.location || '—'}
                    </div>
                  </div>

                  <div>
                    <div style={styles.detailLabel}>Equipo solicitado</div>
                    <div style={styles.detailValue}>
                      {selectedLoan.equipmentRequested || '—'}
                    </div>
                  </div>

                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={styles.detailLabel}>
                      Motivo del préstamo / actividad
                    </div>
                    <div style={styles.detailValue}>
                      {selectedLoan.purpose || '—'}
                    </div>
                  </div>

                  <div>
                    <div style={styles.detailLabel}>Desde solicitado</div>
                    <div style={styles.detailValue}>
                      {formatDate(selectedLoan.requestedFrom)}
                    </div>
                  </div>
                  <div>
                    <div style={styles.detailLabel}>Hasta solicitado</div>
                    <div style={styles.detailValue}>
                      {formatDate(selectedLoan.requestedTo)}
                    </div>
                  </div>

                  <div>
                    <div style={styles.detailLabel}>Desde aprobado</div>
                    <div style={styles.detailValue}>
                      {formatDate(selectedLoan.approvedFrom)}
                    </div>
                  </div>
                  <div>
                    <div style={styles.detailLabel}>Hasta aprobado</div>
                    <div style={styles.detailValue}>
                      {formatDate(selectedLoan.approvedTo)}
                    </div>
                  </div>

                  <div>
                    <div style={styles.detailLabel}>Creado</div>
                    <div style={styles.detailValue}>
                      {formatDate(selectedLoan.createdAt)}
                    </div>
                  </div>
                  <div>
                    <div style={styles.detailLabel}>Aprobado</div>
                    <div style={styles.detailValue}>
                      {formatDate(selectedLoan.approvedAt)}
                    </div>
                  </div>
                  <div>
                    <div style={styles.detailLabel}>Entregado</div>
                    <div style={styles.detailValue}>
                      {formatDate(selectedLoan.deliveredAt)}
                    </div>
                  </div>
                  <div>
                    <div style={styles.detailLabel}>Devuelto</div>
                    <div style={styles.detailValue}>
                      {formatDate(selectedLoan.returnedAt)}
                    </div>
                  </div>

                  {(selectedLoan.deliveredByName || selectedLoan.deliveredByIdNumber) && (
                    <div>
                      <div style={styles.detailLabel}>Recibió el equipo</div>
                      <div style={styles.detailValue}>
                        {selectedLoan.deliveredByName || '—'}
                        {selectedLoan.deliveredByIdNumber
                          ? ` • C.C. ${selectedLoan.deliveredByIdNumber}`
                          : ''}
                      </div>
                    </div>
                  )}

                  {selectedLoan.deliveredCondition && (
                    <div>
                      <div style={styles.detailLabel}>Condición de entrega</div>
                      <div style={styles.detailValue}>
                        {selectedLoan.deliveredCondition}
                      </div>
                    </div>
                  )}

                  {(selectedLoan.returnedByName || selectedLoan.returnedByIdNumber) && (
                    <div>
                      <div style={styles.detailLabel}>Devolvió el equipo</div>
                      <div style={styles.detailValue}>
                        {selectedLoan.returnedByName || '—'}
                        {selectedLoan.returnedByIdNumber
                          ? ` • C.C. ${selectedLoan.returnedByIdNumber}`
                          : ''}
                      </div>
                    </div>
                  )}

                  {selectedLoan.returnedCondition && selectedLoan.status !== 'rejected' && (
                    <div>
                      <div style={styles.detailLabel}>Condición de devolución</div>
                      <div style={styles.detailValue}>
                        {selectedLoan.returnedCondition}
                      </div>
                    </div>
                  )}

                  {selectedLoan.status === 'rejected' && selectedLoan.returnedCondition && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <div style={styles.detailLabel}>Motivo del rechazo</div>
                      <div style={styles.detailValue}>
                        {selectedLoan.returnedCondition}
                      </div>
                    </div>
                  )}

                  {selectedLoan.effectiveMinutes != null && (
                    <div>
                      <div style={styles.detailLabel}>Tiempo efectivo</div>
                      <div style={styles.detailValue}>
                        {selectedLoan.effectiveMinutes} min
                      </div>
                    </div>
                  )}
                </div>

                <div style={styles.actionsRow}>
                  {selectedLoan.status === 'pending' && (
                    <>
                      <button
                        type="button"
                        onClick={() => openApproveModal(selectedLoan)}
                        disabled={updating}
                        style={styles.btnApprove}
                      >
                        {updating ? 'Procesando...' : '✅ Aprobar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReject(selectedLoan)}
                        disabled={updating}
                        style={styles.btnReject}
                      >
                        ❌ Rechazar
                      </button>
                    </>
                  )}

                  {selectedLoan.status === 'approved' && (
                    <button
                      type="button"
                      onClick={() => handleDelivered(selectedLoan)}
                      disabled={updating}
                      style={styles.btnPrimary}
                    >
                      🚚 Registrar entrega
                    </button>
                  )}

                  {selectedLoan.status === 'in_loan' && (
                    <button
                      type="button"
                      onClick={() => handleReturned(selectedLoan)}
                      disabled={updating}
                      style={styles.btnPrimary}
                    >
                      📦 Registrar devolución
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Modal de aprobación */}
      {showApproveModal && selectedLoan && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modalCard}>
            <h3 style={styles.modalTitle}>Aprobar préstamo de equipo</h3>
            <p style={styles.modalText}>
              Define desde qué fecha y hora se puede prestar el equipo y
              cuándo debe ser devuelto. Estos datos serán visibles para el
              solicitante al consultar con el código de seguimiento.
            </p>

            <p style={styles.modalTextSmall}>
              <strong>Solicitante:</strong>{' '}
              {selectedLoan.applicantName || '—'}
              {selectedLoan.applicantId
                ? ` • C.C. ${selectedLoan.applicantId}`
                : ''}
              <br />
              <strong>Equipo:</strong>{' '}
              {selectedLoan.equipmentRequested || '—'}
            </p>

            <form onSubmit={handleApproveSubmit}>
              <div style={styles.modalField}>
                <label style={styles.modalLabel}>
                  Desde (fecha y hora aprobada)
                </label>
                <input
                  type="datetime-local"
                  value={approveFrom}
                  onChange={(e) => setApproveFrom(e.target.value)}
                  required
                  style={styles.modalInput}
                />
              </div>

              <div style={styles.modalField}>
                <label style={styles.modalLabel}>
                  Hasta (fecha y hora de devolución)
                </label>
                <input
                  type="datetime-local"
                  value={approveTo}
                  onChange={(e) => setApproveTo(e.target.value)}
                  required
                  style={styles.modalInput}
                />
              </div>

              <p style={styles.modalHint}>
                Sugerencia: usa el rango solicitado como referencia y ajusta
                según la disponibilidad real del equipo.
              </p>

              <div style={styles.modalActions}>
                <button
                  type="button"
                  style={styles.btnGhost}
                  onClick={() => setShowApproveModal(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={styles.btnApproveLg}
                  disabled={updating}
                >
                  {updating ? 'Guardando...' : '✅ Confirmar aprobación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

const styles: any = {
  card: {
    background: 'white',
    borderRadius: 20,
    padding: 24,
    boxShadow: '0 10px 30px rgba(15,23,42,0.18)',
    marginBottom: 24,
    width: '100%',
    maxWidth: 1200,
    boxSizing: 'border-box',
    marginInline: 'auto',
  },
  cardMobile: {
    padding: 16,
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    marginBottom: 16,
  },
  cardHeaderMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  cardTitle: {
    fontSize: '1.6rem',
    fontWeight: 800,
    color: '#111827',
    margin: 0,
  },
  cardSubtitle: {
    fontSize: '0.9rem',
    color: '#6b7280',
    marginTop: 4,
    marginBottom: 8,
  },
  chipRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  chipMuted: {
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: '0.75rem',
    fontWeight: 600,
    background: 'rgba(148,163,184,0.18)',
    color: '#0f172a',
  },
  chipPending: {
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: '0.75rem',
    fontWeight: 600,
    background: 'rgba(245,158,11,0.16)',
    color: '#b45309',
  },
  chipApproved: {
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: '0.75rem',
    fontWeight: 600,
    background: 'rgba(16,185,129,0.18)',
    color: '#047857',
  },
  chipInLoan: {
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: '0.75rem',
    fontWeight: 600,
    background: 'rgba(59,130,246,0.16)',
    color: '#1d4ed8',
  },
  chipReturned: {
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: '0.75rem',
    fontWeight: 600,
    background: 'rgba(52,211,153,0.16)',
    color: '#047857',
  },
  chipRejected: {
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: '0.75rem',
    fontWeight: 600,
    background: 'rgba(248,113,113,0.18)',
    color: '#b91c1c',
  },
  btnExport: {
    background: 'linear-gradient(135deg,#6366f1,#3b82f6)',
    color: 'white',
    border: 'none',
    padding: '10px 18px',
    borderRadius: 999,
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 6px 18px rgba(79,70,229,0.45)',
    whiteSpace: 'nowrap',
  },
  btnExportMobile: {
    width: '100%',
    justifyContent: 'center',
    display: 'inline-flex',
    textAlign: 'center',
    marginTop: 8,
    fontSize: '0.9rem',
  },
  filtersBar: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  filtersBarMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  statusTabs: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusTab: {
    padding: '6px 14px',
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
    color: '#374151',
  },
  statusTabActive: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
    color: '#1d4ed8',
  },
  searchBox: {
    position: 'relative',
    minWidth: 220,
    maxWidth: 360,
    flex: 1,
  },
  searchIcon: {
    position: 'absolute',
    left: 10,
    top: '50%',
    transform: 'translateY(-50%)',
    fontSize: '0.9rem',
    opacity: 0.7,
  },
  searchInput: {
    width: '100%',
    padding: '8px 10px 8px 28px',
    borderRadius: 999,
    border: '1px solid #e5e7eb',
    fontSize: '0.85rem',
    boxSizing: 'border-box',
  },
  mainGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1.7fr)',
    gap: 16,
    marginTop: 4,
  },
  mainGridMobile: {
    gridTemplateColumns: '1fr',
  },
  listPanel: {
    background: '#f9fafb',
    borderRadius: 16,
    padding: 10,
    border: '1px solid #e5e7eb',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 220,
  },
  listHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    padding: '4px 6px 8px',
  },
  listTitle: {
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#111827',
  },
  listCounter: {
    fontSize: '0.75rem',
    color: '#6b7280',
  },
  listEmpty: {
    fontSize: '0.8rem',
    color: '#6b7280',
    padding: 12,
  },
  listItems: {
    marginTop: 4,
    overflowY: 'auto',
    maxHeight: 380,
    paddingRight: 4,
  },
  listItem: {
    width: '100%',
    textAlign: 'left',
    padding: '8px 10px',
    borderRadius: 12,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    display: 'grid',
    gridTemplateColumns: 'auto 1fr auto',
    gap: 8,
    marginBottom: 4,
  },
  listItemActive: {
    background: 'rgba(59,130,246,0.08)',
    boxShadow: '0 0 0 1px rgba(59,130,246,0.4)',
  },
  listItemTop: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  loanCode: {
    fontFamily: 'monospace',
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '0.2em',
    color: '#2563eb',
  },
  listItemMain: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  listItemName: {
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#111827',
  },
  listItemSub: {
    fontSize: '0.75rem',
    color: '#6b7280',
  },
  listItemDate: {
    fontSize: '0.75rem',
    color: '#6b7280',
    textAlign: 'right',
  },
  detailPanel: {
    borderRadius: 16,
    border: '1px solid #e5e7eb',
    padding: 16,
    background: '#f9fafb',
    minHeight: 220,
  },
  detailPanelMobile: {
    marginTop: 8,
  },
  detailEmpty: {
    fontSize: '0.8rem',
    color: '#6b7280',
  },
  detailHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  detailLabel: {
    fontSize: '0.7rem',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    color: '#6b7280',
  },
  detailCode: {
    fontFamily: 'monospace',
    fontSize: '0.9rem',
    letterSpacing: '0.35em',
    marginTop: 4,
    color: '#0f172a',
    overflowX: 'auto',
    whiteSpace: 'nowrap',
  },
  detailGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
    gap: '8px 16px',
    fontSize: '0.8rem',
    color: '#111827',
    marginBottom: 12,
  },
  detailValue: {
    marginTop: 2,
  },
  badgeSmall: (status: LoanStatus) => ({
    padding: '2px 8px',
    borderRadius: 999,
    fontSize: '0.7rem',
    fontWeight: 600,
    background:
      status === 'pending'
        ? 'rgba(245,158,11,0.16)'
        : status === 'approved'
        ? 'rgba(16,185,129,0.18)'
        : status === 'in_loan'
        ? 'rgba(59,130,246,0.16)'
        : status === 'returned'
        ? 'rgba(52,211,153,0.16)'
        : 'rgba(248,113,113,0.18)',
    color:
      status === 'pending'
        ? '#b45309'
        : status === 'approved'
        ? '#047857'
        : status === 'in_loan'
        ? '#1d4ed8'
        : status === 'returned'
        ? '#047857'
        : '#b91c1c',
  }),
  badgeLarge: (status: LoanStatus) => ({
    padding: '6px 12px',
    borderRadius: 999,
    fontSize: '0.8rem',
    fontWeight: 700,
    background:
      status === 'pending'
        ? 'rgba(245,158,11,0.16)'
        : status === 'approved'
        ? 'rgba(16,185,129,0.18)'
        : status === 'in_loan'
        ? 'rgba(59,130,246,0.16)'
        : status === 'returned'
        ? 'rgba(52,211,153,0.16)'
        : 'rgba(248,113,113,0.18)',
    color:
      status === 'pending'
        ? '#b45309'
        : status === 'approved'
        ? '#047857'
        : status === 'in_loan'
        ? '#1d4ed8'
        : status === 'returned'
        ? '#047857'
        : '#b91c1c',
  }),
  actionsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  btnPrimary: {
    background: '#3b82f6',
    color: 'white',
    border: 'none',
    padding: '8px 14px',
    borderRadius: 999,
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnApprove: {
    background: '#22c55e',
    color: '#022c22',
    border: 'none',
    padding: '8px 14px',
    borderRadius: 999,
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnReject: {
    background: '#ef4444',
    color: 'white',
    border: 'none',
    padding: '8px 14px',
    borderRadius: 999,
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
  },

  // Modal aprobación
  modalBackdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15,23,42,0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
  modalCard: {
    background: '#ffffff',
    borderRadius: 16,
    padding: 20,
    maxWidth: 420,
    width: '100%',
    boxShadow: '0 20px 60px rgba(15,23,42,0.35)',
    boxSizing: 'border-box',
    margin: 16,
  },
  modalTitle: {
    fontSize: '1rem',
    fontWeight: 700,
    marginBottom: 6,
    color: '#111827',
  },
  modalText: {
    fontSize: '0.8rem',
    color: '#4b5563',
    marginBottom: 8,
  },
  modalTextSmall: {
    fontSize: '0.78rem',
    color: '#4b5563',
    marginBottom: 10,
  },
  modalField: {
    marginBottom: 10,
  },
  modalLabel: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#374151',
    marginBottom: 4,
    display: 'block',
  },
  modalInput: {
    width: '100%',
    borderRadius: 10,
    border: '1px solid #d1d5db',
    padding: '7px 9px',
    fontSize: '0.8rem',
    boxSizing: 'border-box',
  },
  modalHint: {
    fontSize: '0.7rem',
    color: '#6b7280',
    marginTop: 2,
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  btnGhost: {
    background: 'transparent',
    border: '1px solid #d1d5db',
    borderRadius: 999,
    padding: '7px 13px',
    fontSize: '0.8rem',
    cursor: 'pointer',
    color: '#374151',
  },
  btnApproveLg: {
    background: '#22c55e',
    color: '#022c22',
    border: 'none',
    padding: '7px 13px',
    borderRadius: 999,
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
};
