'use client';

import { useEffect, useMemo, useState } from 'react';
import { db } from '../../firebaseConfig';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';

/*
  =========================
  Helpers de formato / fecha
  =========================
*/

// Convierte Timestamp de Firestore o Date/string a Date nativo
function toDateObj(ts) {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  return new Date(ts);
}

// Formato solo fecha (dd/mm/aaaa)
function formatDate(ts) {
  const d = toDateObj(ts);
  if (!d || isNaN(d)) return '-';
  return d.toLocaleDateString('es-CO', { timeZone: 'America/Bogota' });
}

// Formato solo hora (hh:mm)
function formatTime(ts) {
  const d = toDateObj(ts);
  if (!d || isNaN(d)) return '-';
  return d.toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Bogota',
  });
}

// Fecha + hora (para mostrar en CSV / textos)
function formatDateTime(ts) {
  const d = toDateObj(ts);
  if (!d || isNaN(d)) return '';
  const date = formatDate(d);
  const time = formatTime(d);
  return `${date} ${time}`;
}

// Diferencia en minutos entre dos timestamps
function diffMinutes(start, end) {
  const s = toDateObj(start);
  const e = toDateObj(end);
  if (!s || !e || isNaN(s) || isNaN(e)) return 0;
  return Math.max(0, Math.round((e.getTime() - s.getTime()) / 60000));
}

// YYYY-MM-DD para inputs type="date"
function toISODate(d) {
  const date = d instanceof Date ? d : new Date(d);
  return date.toISOString().slice(0, 10);
}

// Formato “1 h 20 min / 45 min”
function formatDuration(minutes) {
  if (minutes == null) return '—';
  const m = Number(minutes);
  if (Number.isNaN(m)) return '—';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h} h` : `${h} h ${rest} min`;
}

/*
  =========================
  Estilos base (similar al panel pero versión Historial)
  =========================
*/

const styles = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#f3f4ff',
    padding: '24px',
    fontFamily: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  },
  pageMobile: {
    padding: '12px',
  },
  container: {
    maxWidth: 1400,
    margin: '0 auto',
  },
  containerMobile: {
    maxWidth: '100%',
  },

  // Header principal
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: '2rem',
    fontWeight: 800,
    color: '#0f172a',
    margin: 0,
  },
  subtitle: {
    marginTop: 4,
    fontSize: '0.95rem',
    color: '#64748b',
  },

  // KPIs de arriba
  kpiGrid: {
    marginTop: 20,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 16,
  },
  kpiCard: {
    borderRadius: 16,
    padding: '14px 16px',
    background: 'linear-gradient(135deg, #eef2ff, #e0f2fe)',
    border: '1px solid #e5e7eb',
  },
  kpiLabel: {
    fontSize: '0.8rem',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    color: '#6b7280',
    marginBottom: 6,
  },
  kpiValue: {
    fontSize: '1.5rem',
    fontWeight: 800,
    color: '#111827',
  },
  kpiHelper: {
    fontSize: '0.75rem',
    color: '#6b7280',
    marginTop: 4,
  },

  // Card genérico
  card: {
    background: '#ffffff',
    borderRadius: 20,
    padding: 24,
    boxShadow: '0 10px 30px rgba(15,23,42,0.08)',
    border: '1px solid #e5e7eb',
    marginBottom: 24,
  },
  cardMobile: {
    padding: 18,
    borderRadius: 16,
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  cardTitle: {
    fontSize: '1.1rem',
    fontWeight: 700,
    color: '#0f172a',
    margin: 0,
  },
  cardSubtitle: {
    fontSize: '0.8rem',
    color: '#6b7280',
    marginTop: 4,
  },

  // Grid de filtros
  filtrosGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 16,
  },
  filtrosGridMobile: {
    gridTemplateColumns: '1fr',
  },
  label: {
    display: 'block',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#374151',
    marginBottom: 4,
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid #d1d5db',
    fontSize: '0.85rem',
    backgroundColor: '#ffffff',
  },
  select: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid #d1d5db',
    fontSize: '0.85rem',
    backgroundColor: '#ffffff',
  },

  // Chips de rango rápido
  quickRangesRow: {
    marginTop: 14,
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quickRangesLeft: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  quickLabel: {
    fontSize: '0.8rem',
    color: '#6b7280',
  },
  quickBtn: {
    padding: '6px 10px',
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    fontSize: '0.8rem',
    cursor: 'pointer',
    color: '#374151',
  },
  quickBtnActive: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
    color: '#1d4ed8',
  },

  // Botones filtros
  filtrosActions: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    marginTop: 10,
  },
  pillInfo: {
    fontSize: '0.8rem',
    color: '#6b7280',
  },
  btnPrimary: {
    padding: '10px 18px',
    borderRadius: 999,
    border: 'none',
    background:
      'linear-gradient(135deg, #2563eb, #4f46e5)',
    color: '#ffffff',
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnSecondary: {
    padding: '10px 16px',
    borderRadius: 999,
    border: 'none',
    backgroundColor: '#6b7280',
    color: '#ffffff',
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnSuccess: {
    padding: '10px 16px',
    borderRadius: 999,
    border: 'none',
    backgroundColor: '#10b981',
    color: '#ffffff',
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
  },

  // Resúmenes
  resumenGrid: {
    display: 'grid',
    gridTemplateColumns: '2fr 2fr 1.2fr',
    gap: 20,
  },
  resumenGridMobile: {
    gridTemplateColumns: '1fr',
  },
  tableResumen: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.8rem',
  },
  thResumen: {
    textAlign: 'left',
    padding: '8px 6px',
    borderBottom: '1px solid #e5e7eb',
    fontWeight: 600,
    color: '#4b5563',
    backgroundColor: '#f9fafb',
  },
  trResumen: {
    borderBottom: '1px solid #f3f4f6',
  },
  tdResumen: {
    padding: '8px 6px',
    color: '#111827',
  },

  // Tabla detalle
  tableWrapper: {
    overflowX: 'auto',
    borderRadius: 14,
    border: '1px solid #e5e7eb',
  },
  tableWrapperMobile: {
    maxWidth: '100vw',
  },
  tableDetalle: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.8rem',
    minWidth: 1250,
  },
  thDetalle: {
    textAlign: 'left',
    padding: '10px 8px',
    borderBottom: '1px solid #e5e7eb',
    backgroundColor: '#f9fafb',
    color: '#4b5563',
    fontWeight: 600,
    fontSize: '0.72rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    whiteSpace: 'nowrap',
  },
  trDetalle: {
    borderBottom: '1px solid #f3f4f6',
  },
  tdDetalle: {
    padding: '10px 8px',
    verticalAlign: 'top',
    color: '#111827',
    whiteSpace: 'nowrap',
  },

  // Badges / estados
  statusBadge: {
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: '0.72rem',
    fontWeight: 600,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
  },

  // Evidencias
  evidencesBox: {
    maxWidth: 220,
  },
  evidenceTag: {
    display: 'inline-block',
    padding: '2px 6px',
    borderRadius: 999,
    fontSize: '0.7rem',
    backgroundColor: '#e5e7eb',
    color: '#374151',
    marginRight: 4,
    marginBottom: 2,
  },
  evidencesMore: {
    fontSize: '0.7rem',
    fontStyle: 'italic',
    color: '#6b7280',
  },

  // Empty / error
  empty: {
    textAlign: 'center',
    padding: '40px 16px',
    color: '#6b7280',
  },
  emptyIcon: {
    fontSize: '2rem',
    marginBottom: 8,
  },
  errorBox: {
    marginTop: 12,
    padding: '10px 12px',
    borderRadius: 10,
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#b91c1c',
    fontSize: '0.8rem',
  },
};

/*
  =========================
  Componente principal
  =========================
*/

export default function HistorialPage() {
  // --------- Estado de filtros ----------
  const hoy = new Date();
  const hace7 = new Date();
  hace7.setDate(hoy.getDate() - 7);

  const [desde, setDesde] = useState(toISODate(hace7));
  const [hasta, setHasta] = useState(toISODate(hoy));
  const [fechaBase, setFechaBase] = useState('solicitud'); // 'solicitud' | 'creacion'
  const [operadorFiltro, setOperadorFiltro] = useState('todos');
  const [equipoFiltro, setEquipoFiltro] = useState('todos');
  const [estadoFiltro, setEstadoFiltro] = useState('todos');
  const [origenFiltro, setOrigenFiltro] = useState('todos'); // todos | con_solicitud | sin_solicitud
  const [evidenciaFiltro, setEvidenciaFiltro] = useState('todos'); // todos | con | sin
  const [busqueda, setBusqueda] = useState('');

  // --------- Datos ----------
  const [asignaciones, setAsignaciones] = useState([]);
  const [operadores, setOperadores] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  // Detección simple de móvil
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      if (typeof window !== 'undefined') {
        setIsMobile(window.innerWidth <= 768);
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // --------- Cargar catálogos de operadores / equipos ----------
  useEffect(() => {
    const cargarCatalogos = async () => {
      try {
        const opsSnap = await getDocs(collection(db, 'operators'));
        const eqSnap = await getDocs(collection(db, 'equipment'));
        setOperadores(opsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setEquipos(eqSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error(e);
      }
    };
    cargarCatalogos();
  }, []);

  // --------- Cargar historial desde Firestore ----------
  const cargarHistorial = async () => {
    setCargando(true);
    setError('');
    try {
      const q = query(collection(db, 'assignments'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const registros = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setAsignaciones(registros);
    } catch (e) {
      console.error(e);
      setError('Error consultando el historial. Intenta nuevamente.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarHistorial();
  }, []);

  // --------- Mapas rápidos de nombres ----------
  const operadorMap = useMemo(() => {
    const map = {};
    operadores.forEach((o) => {
      map[o.id] = `${o.name || 'Sin nombre'}${o.codigo ? ` (${o.codigo})` : ''}`;
    });
    return map;
  }, [operadores]);

  const equipoMap = useMemo(() => {
    const map = {};
    equipos.forEach((e) => {
      map[e.id] = `${e.name || 'Equipo'}${e.codigo ? ` (${e.codigo})` : ''}`;
    });
    return map;
  }, [equipos]);

  // --------- Aplicar filtros en memoria ----------
  const asignacionesFiltradas = useMemo(() => {
    const dDesde = new Date(`${desde}T00:00:00-05:00`);
    const dHasta = new Date(`${hasta}T23:59:59-05:00`);

    return asignaciones.filter((a) => {
      // 1. Filtro por fecha base (solicitud / creación)
      const baseTs =
        fechaBase === 'solicitud'
          ? a.requestCreatedAt || a.createdAt
          : a.createdAt;
      const baseDate = toDateObj(baseTs);
      if (!baseDate || isNaN(baseDate)) return false;
      if (baseDate < dDesde || baseDate > dHasta) return false;

      // 2. Filtro por operador
      if (operadorFiltro !== 'todos' && a.operatorId !== operadorFiltro) {
        return false;
      }

      // 3. Filtro por equipo
      if (equipoFiltro !== 'todos' && a.equipmentId !== equipoFiltro) {
        return false;
      }

      // 4. Filtro por estado
      if (estadoFiltro !== 'todos' && a.status !== estadoFiltro) {
        return false;
      }

      // 5. Filtro por origen (con / sin solicitud enlazada)
      if (origenFiltro === 'con_solicitud' && !a.linkedRequestId) {
        return false;
      }
      if (origenFiltro === 'sin_solicitud' && a.linkedRequestId) {
        return false;
      }

      // 6. Filtro por evidencias
      const tieneEvidencias = Array.isArray(a.evidences) && a.evidences.length > 0;
      if (evidenciaFiltro === 'con' && !tieneEvidencias) return false;
      if (evidenciaFiltro === 'sin' && tieneEvidencias) return false;

      // 7. Búsqueda de texto libre
      if (busqueda.trim()) {
        const text = busqueda.toLowerCase();
        const cadena = [
          operadorMap[a.operatorId] || '',
          equipoMap[a.equipmentId] || '',
          a.activity || '',
          a.solicitadoPor || '',
          a.location || '',
          a.requestCode || '',
          a.centroCosto || '',
          a.areaSolicitante || '',
          a.telefonoSolicitante || '',
          a.cedulaSolicitante || '',
        ]
          .join(' ')
          .toLowerCase();

        if (!cadena.includes(text)) return false;
      }

      return true;
    });
  }, [
    asignaciones,
    desde,
    hasta,
    fechaBase,
    operadorFiltro,
    equipoFiltro,
    estadoFiltro,
    origenFiltro,
    evidenciaFiltro,
    busqueda,
    operadorMap,
    equipoMap,
  ]);

  // --------- Resúmenes y métricas globales ----------
  const resumenPorOperador = useMemo(() => {
    const map = new Map();

    asignacionesFiltradas.forEach((a) => {
      const key = a.operatorId || 'sin-operador';
      if (!map.has(key)) {
        map.set(key, {
          operador: operadorMap[a.operatorId] || 'Sin operador',
          total: 0,
          finalizadas: 0,
          enProgreso: 0,
          pausadas: 0,
          minutos: 0,
        });
      }

      const item = map.get(key);
      item.total += 1;

      if (a.status === 'finalizado') {
        item.finalizadas += 1;
        const mins =
          a.durationMinutes != null
            ? a.durationMinutes
            : diffMinutes(a.startTime, a.endTime);
        item.minutos += mins;
      } else if (a.status === 'en_progreso') {
        item.enProgreso += 1;
      } else if (a.status === 'pausado') {
        item.pausadas += 1;
      }
    });

    return Array.from(map.values());
  }, [asignacionesFiltradas, operadorMap]);

  const resumenPorEquipo = useMemo(() => {
    const map = new Map();

    asignacionesFiltradas.forEach((a) => {
      const key = a.equipmentId || 'sin-equipo';
      if (!map.has(key)) {
        map.set(key, {
          equipo: equipoMap[a.equipmentId] || 'Sin equipo',
          total: 0,
          minutos: 0,
        });
      }
      const item = map.get(key);
      item.total += 1;
      if (a.status === 'finalizado') {
        const mins =
          a.durationMinutes != null
            ? a.durationMinutes
            : diffMinutes(a.startTime, a.endTime);
        item.minutos += mins;
      }
    });

    return Array.from(map.values());
  }, [asignacionesFiltradas, equipoMap]);

  const resumenEstados = useMemo(() => {
    const base = {
      pendiente: 0,
      en_progreso: 0,
      pausado: 0,
      finalizado: 0,
    };
    asignacionesFiltradas.forEach((a) => {
      if (base[a.status] == null) base[a.status] = 0;
      base[a.status] += 1;
    });
    return base;
  }, [asignacionesFiltradas]);

  const metricas = useMemo(() => {
    const total = asignacionesFiltradas.length;
    let finalizadas = 0;
    let minutosFinalizadas = 0;

    asignacionesFiltradas.forEach((a) => {
      if (a.status === 'finalizado') {
        finalizadas += 1;
        const mins =
          a.durationMinutes != null
            ? a.durationMinutes
            : diffMinutes(a.startTime, a.endTime);
        minutosFinalizadas += mins;
      }
    });

    const horasFinalizadas = minutosFinalizadas / 60;
    const promMinutos =
      finalizadas > 0 ? Math.round(minutosFinalizadas / finalizadas) : 0;

    return {
      total,
      finalizadas,
      horasFinalizadas,
      promMinutos,
    };
  }, [asignacionesFiltradas]);

  // --------- Exportar CSV con formato “pro” ----------
  const buildCsvFromAssignments = (list) => {
    const header = [
      'Fecha solicitud',
      'Hora solicitud',
      'Fecha creación',
      'Hora creación',
      'Operador',
      'Equipo',
      'Actividad',
      'Solicitado por',
      'Teléfono solicitante',
      'Cédula solicitante',
      'Área solicitante',
      'Centro de costos',
      'Lugar',
      'Estado',
      'Código solicitud',
      'Inicio',
      'Fin',
      'Duración (min)',
      'Notas',
    ];

    const rows = list.map((a) => {
      const opName = operadorMap[a.operatorId] || a.operatorId || '';
      const eqName = equipoMap[a.equipmentId] || a.equipmentId || '';

      const reqTs = a.requestCreatedAt || a.createdAt;
      const createdTs = a.createdAt || null;

      const reqDateStr = formatDate(reqTs) || '';
      const reqTimeStr = formatTime(reqTs) || '';
      const createdDateStr = formatDate(createdTs) || '';
      const createdTimeStr = formatTime(createdTs) || '';

      const startStr = formatTime(a.startTime) || '';
      const endStr = formatTime(a.endTime) || '';

      const evidences =
        a.evidences && Array.isArray(a.evidences)
          ? a.evidences
              .map((ev) => (ev.type === 'text' ? ev.content : ev.url))
              .join(' | ')
          : '';

      const dur =
        a.durationMinutes != null
          ? a.durationMinutes
          : diffMinutes(a.startTime, a.endTime);

      return [
        reqDateStr,
        reqTimeStr,
        createdDateStr,
        createdTimeStr,
        opName,
        eqName,
        a.activity || '',
        a.solicitadoPor || '',
        a.telefonoSolicitante || '',
        a.cedulaSolicitante || '',
        a.areaSolicitante || '',
        a.centroCosto || '',
        a.location || '',
        a.status || '',
        a.requestCode || '',
        startStr,
        endStr,
        dur ?? '',
        evidences,
      ];
    });

    return [header, ...rows]
      .map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';'))
      .join('\n');
  };

  const handleExportCsv = () => {
    if (!asignacionesFiltradas.length) return;
    const csv = buildCsvFromAssignments(asignacionesFiltradas);
    const fileName = `historial_asignaciones_${new Date()
      .toLocaleDateString('es-CO')
      .replace(/\//g, '-')}.csv`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  // --------- Rango rápido (chips) ----------
  const handleQuickRange = (type) => {
    const now = new Date();
    if (type === 'hoy') {
      const iso = toISODate(now);
      setDesde(iso);
      setHasta(iso);
      return;
    }
    if (type === '7d') {
      const d = new Date();
      d.setDate(now.getDate() - 7);
      setDesde(toISODate(d));
      setHasta(toISODate(now));
      return;
    }
    if (type === 'mes') {
      const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);
      const finMes = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setDesde(toISODate(inicioMes));
      setHasta(toISODate(finMes));
      return;
    }
    if (type === 'anio') {
      const inicio = new Date(now.getFullYear(), 0, 1);
      const fin = new Date(now.getFullYear(), 11, 31);
      setDesde(toISODate(inicio));
      setHasta(toISODate(fin));
      return;
    }
  };

  // --------- Resetear filtros ----------
  const handleResetFiltros = () => {
    const hoy = new Date();
    const h7 = new Date();
    h7.setDate(hoy.getDate() - 7);

    setDesde(toISODate(h7));
    setHasta(toISODate(hoy));
    setFechaBase('solicitud');
    setOperadorFiltro('todos');
    setEquipoFiltro('todos');
    setEstadoFiltro('todos');
    setOrigenFiltro('todos');
    setEvidenciaFiltro('todos');
    setBusqueda('');
  };

  // --------- Helper estilos de estado ----------
  const getStatusStyle = (status) => {
    switch (status) {
      case 'pendiente':
        return { bg: '#fef3c7', color: '#92400e', icon: '⏳', label: 'Pendiente' };
      case 'en_progreso':
        return { bg: '#d1fae5', color: '#047857', icon: '▶️', label: 'En progreso' };
      case 'pausado':
        return { bg: '#fee2e2', color: '#b91c1c', icon: '⏸️', label: 'Pausado' };
      case 'finalizado':
        return { bg: '#e5e7eb', color: '#4b5563', icon: '✅', label: 'Finalizado' };
      default:
        return { bg: '#e5e7eb', color: '#4b5563', icon: '📝', label: status || '—' };
    }
  };

  /*
    ================
    Render
    ================
  */

  return (
    <main style={{ ...styles.page, ...(isMobile ? styles.pageMobile : {}) }}>
      <div style={{ ...styles.container, ...(isMobile ? styles.containerMobile : {}) }}>
        {/* HEADER */}
        <header style={styles.header}>
          <h1 style={styles.title}>Historial de asignaciones</h1>
          <p style={styles.subtitle}>
            Analiza el desempeño histórico por operador, equipo, estado y tiempos. Usa los
            filtros avanzados para encontrar patrones y exporta la información a CSV.
          </p>

          {/* KPIs globales */}
          <div style={styles.kpiGrid}>
            <div style={styles.kpiCard}>
              <div style={styles.kpiLabel}>Asignaciones (filtro actual)</div>
              <div style={styles.kpiValue}>{metricas.total}</div>
              <div style={styles.kpiHelper}>Registros dentro del rango y filtros aplicados.</div>
            </div>
            <div style={styles.kpiCard}>
              <div style={styles.kpiLabel}>Finalizadas</div>
              <div style={styles.kpiValue}>{metricas.finalizadas}</div>
              <div style={styles.kpiHelper}>
                {metricas.total > 0
                  ? `${Math.round(
                      (metricas.finalizadas / metricas.total) * 100
                    )}% del total`
                  : 'Sin datos'}
              </div>
            </div>
            <div style={styles.kpiCard}>
              <div style={styles.kpiLabel}>Horas registradas</div>
              <div style={styles.kpiValue}>{metricas.horasFinalizadas.toFixed(2)}h</div>
              <div style={styles.kpiHelper}>Sólo asignaciones finalizadas.</div>
            </div>
            <div style={styles.kpiCard}>
              <div style={styles.kpiLabel}>Duración promedio</div>
              <div style={styles.kpiValue}>{formatDuration(metricas.promMinutos)}</div>
              <div style={styles.kpiHelper}>Por asignación finalizada.</div>
            </div>
          </div>
        </header>

        {/* FILTROS */}
        <section
          style={{
            ...styles.card,
            ...(isMobile ? styles.cardMobile : {}),
          }}
        >
          <div style={styles.cardHeader}>
            <div>
              <h2 style={styles.cardTitle}>Filtros avanzados</h2>
              <p style={styles.cardSubtitle}>
                Combina rango de fechas, operador, equipo, estado, origen y evidencias. La
                búsqueda aplica sobre actividad, solicitante, lugar, código de solicitud, etc.
              </p>
            </div>
            <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
              {asignacionesFiltradas.length} registros encontrados
            </div>
          </div>

          {/* Grid de filtros principales */}
          <div
            style={{
              ...styles.filtrosGrid,
              ...(isMobile ? styles.filtrosGridMobile : {}),
            }}
          >
            {/* Fecha desde */}
            <div>
              <label style={styles.label}>Desde</label>
              <input
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                style={styles.input}
              />
            </div>

            {/* Fecha hasta */}
            <div>
              <label style={styles.label}>Hasta</label>
              <input
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                style={styles.input}
              />
            </div>

            {/* Tipo de fecha base */}
            <div>
              <label style={styles.label}>Tipo de fecha</label>
              <select
                style={styles.select}
                value={fechaBase}
                onChange={(e) => setFechaBase(e.target.value)}
              >
                <option value="solicitud">Fecha de solicitud</option>
                <option value="creacion">Fecha de creación de la asignación</option>
              </select>
            </div>

            {/* Operador */}
            <div>
              <label style={styles.label}>Operador</label>
              <select
                style={styles.select}
                value={operadorFiltro}
                onChange={(e) => setOperadorFiltro(e.target.value)}
              >
                <option value="todos">Todos los operadores</option>
                {operadores.map((op) => (
                  <option key={op.id} value={op.id}>
                    {op.name} {op.codigo ? `(${op.codigo})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Equipo */}
            <div>
              <label style={styles.label}>Equipo</label>
              <select
                style={styles.select}
                value={equipoFiltro}
                onChange={(e) => setEquipoFiltro(e.target.value)}
              >
                <option value="todos">Todos los equipos</option>
                {equipos.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.name} {eq.codigo ? `(${eq.codigo})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Estado */}
            <div>
              <label style={styles.label}>Estado</label>
              <select
                style={styles.select}
                value={estadoFiltro}
                onChange={(e) => setEstadoFiltro(e.target.value)}
              >
                <option value="todos">Todos los estados</option>
                <option value="pendiente">Pendiente</option>
                <option value="en_progreso">En progreso</option>
                <option value="pausado">Pausado</option>
                <option value="finalizado">Finalizado</option>
              </select>
            </div>

            {/* Origen */}
            <div>
              <label style={styles.label}>Origen</label>
              <select
                style={styles.select}
                value={origenFiltro}
                onChange={(e) => setOrigenFiltro(e.target.value)}
              >
                <option value="todos">Todas</option>
                <option value="con_solicitud">Con solicitud enlazada</option>
                <option value="sin_solicitud">Creadas desde el panel</option>
              </select>
            </div>

            {/* Evidencias */}
            <div>
              <label style={styles.label}>Evidencias</label>
              <select
                style={styles.select}
                value={evidenciaFiltro}
                onChange={(e) => setEvidenciaFiltro(e.target.value)}
              >
                <option value="todos">Con y sin evidencias</option>
                <option value="con">Sólo con evidencias</option>
                <option value="sin">Sólo sin evidencias</option>
              </select>
            </div>

            {/* Búsqueda libre */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={styles.label}>Búsqueda</label>
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Ej: ICO, Telehandler, Juan Pérez, patio almacén, H016000H03, código de solicitud..."
                style={styles.input}
              />
            </div>
          </div>

          {/* Rango rápido + acciones */}
          <div style={styles.quickRangesRow}>
            <div style={styles.quickRangesLeft}>
              <span style={styles.quickLabel}>Rangos rápidos:</span>
              <button
                type="button"
                onClick={() => handleQuickRange('hoy')}
                style={styles.quickBtn}
              >
                Hoy
              </button>
              <button
                type="button"
                onClick={() => handleQuickRange('7d')}
                style={{ ...styles.quickBtn, ...styles.quickBtnActive }}
              >
                Últimos 7 días
              </button>
              <button
                type="button"
                onClick={() => handleQuickRange('mes')}
                style={styles.quickBtn}
              >
                Mes actual
              </button>
              <button
                type="button"
                onClick={() => handleQuickRange('anio')}
                style={styles.quickBtn}
              >
                Año actual
              </button>
            </div>

            <div style={styles.filtrosActions}>
              <span style={styles.pillInfo}>
                {asignacionesFiltradas.length} registros después de aplicar filtros
              </span>
              <button type="button" style={styles.btnSecondary} onClick={handleResetFiltros}>
                Limpiar filtros
              </button>
              <button type="button" style={styles.btnPrimary} onClick={cargarHistorial}>
                {cargando ? 'Actualizando...' : 'Actualizar datos'}
              </button>
              <button
                type="button"
                style={styles.btnSuccess}
                onClick={handleExportCsv}
                disabled={!asignacionesFiltradas.length}
              >
                📊 Exportar CSV
              </button>
            </div>
          </div>

          {error && <div style={styles.errorBox}>{error}</div>}
        </section>

        {/* RESÚMENES */}
        <section
          style={{
            ...styles.card,
            ...(isMobile ? styles.cardMobile : {}),
          }}
        >
          <div style={styles.cardHeader}>
            <div>
              <h2 style={styles.cardTitle}>Resúmenes inteligentes</h2>
              <p style={styles.cardSubtitle}>
                Visualiza cómo se distribuyen las asignaciones por operador, equipo y estado
                con los filtros actuales.
              </p>
            </div>
          </div>

          <div
            style={{
              ...styles.resumenGrid,
              ...(isMobile ? styles.resumenGridMobile : {}),
            }}
          >
            {/* Resumen por operador */}
            <div>
              <h3 style={{ ...styles.cardTitle, fontSize: '0.95rem', marginBottom: 8 }}>
                👷‍♂️ Resumen por operador
              </h3>
              {resumenPorOperador.length === 0 ? (
                <div style={styles.empty}>
                  <div style={styles.emptyIcon}>📊</div>
                  <div style={{ fontSize: '0.8rem' }}>No hay datos para este filtro.</div>
                </div>
              ) : (
                <table style={styles.tableResumen}>
                  <thead>
                    <tr>
                      <th style={styles.thResumen}>Operador</th>
                      <th style={styles.thResumen}>Asign.</th>
                      <th style={styles.thResumen}>Finaliz.</th>
                      <th style={styles.thResumen}>En prog.</th>
                      <th style={styles.thResumen}>Pausadas</th>
                      <th style={styles.thResumen}>Horas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumenPorOperador.map((r, idx) => (
                      <tr key={idx} style={styles.trResumen}>
                        <td style={styles.tdResumen}>{r.operador}</td>
                        <td style={styles.tdResumen}>{r.total}</td>
                        <td style={{ ...styles.tdResumen, color: '#16a34a' }}>
                          {r.finalizadas}
                        </td>
                        <td style={{ ...styles.tdResumen, color: '#f59e0b' }}>
                          {r.enProgreso}
                        </td>
                        <td style={{ ...styles.tdResumen, color: '#ef4444' }}>
                          {r.pausadas}
                        </td>
                        <td style={styles.tdResumen}>
                          {(r.minutos / 60).toFixed(2)}h
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Resumen por equipo */}
            <div>
              <h3 style={{ ...styles.cardTitle, fontSize: '0.95rem', marginBottom: 8 }}>
                🚜 Resumen por equipo
              </h3>
              {resumenPorEquipo.length === 0 ? (
                <div style={styles.empty}>
                  <div style={styles.emptyIcon}>📊</div>
                  <div style={{ fontSize: '0.8rem' }}>No hay datos para este filtro.</div>
                </div>
              ) : (
                <table style={styles.tableResumen}>
                  <thead>
                    <tr>
                      <th style={styles.thResumen}>Equipo</th>
                      <th style={styles.thResumen}>Asign.</th>
                      <th style={styles.thResumen}>Horas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumenPorEquipo.map((r, idx) => (
                      <tr key={idx} style={styles.trResumen}>
                        <td style={styles.tdResumen}>{r.equipo}</td>
                        <td style={styles.tdResumen}>{r.total}</td>
                        <td style={styles.tdResumen}>
                          {(r.minutos / 60).toFixed(2)}h
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Resumen por estado */}
            <div>
              <h3 style={{ ...styles.cardTitle, fontSize: '0.95rem', marginBottom: 8 }}>
                🟢 Resumen por estado
              </h3>
              <table style={styles.tableResumen}>
                <tbody>
                  <tr style={styles.trResumen}>
                    <td style={styles.tdResumen}>Pendientes</td>
                    <td style={{ ...styles.tdResumen, color: '#b45309' }}>
                      {resumenEstados.pendiente || 0}
                    </td>
                  </tr>
                  <tr style={styles.trResumen}>
                    <td style={styles.tdResumen}>En progreso</td>
                    <td style={{ ...styles.tdResumen, color: '#059669' }}>
                      {resumenEstados.en_progreso || 0}
                    </td>
                  </tr>
                  <tr style={styles.trResumen}>
                    <td style={styles.tdResumen}>Pausadas</td>
                    <td style={{ ...styles.tdResumen, color: '#dc2626' }}>
                      {resumenEstados.pausado || 0}
                    </td>
                  </tr>
                  <tr style={styles.trResumen}>
                    <td style={styles.tdResumen}>Finalizadas</td>
                    <td style={{ ...styles.tdResumen, color: '#4b5563' }}>
                      {resumenEstados.finalizado || 0}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* DETALLE DE ASIGNACIONES */}
        <section
          style={{
            ...styles.card,
            ...(isMobile ? styles.cardMobile : {}),
          }}
        >
          <div style={styles.cardHeader}>
            <div>
              <h2 style={styles.cardTitle}>Detalle de asignaciones</h2>
              <p style={styles.cardSubtitle}>
                Esta tabla refleja exactamente los filtros que tienes arriba. Úsala para
                auditorías, trazabilidad y análisis fino.
              </p>
            </div>
          </div>

          {cargando ? (
            <div style={styles.empty}>
              <div style={styles.emptyIcon}>⏳</div>
              <div style={{ fontSize: '0.8rem' }}>Cargando historial...</div>
            </div>
          ) : asignacionesFiltradas.length === 0 ? (
            <div style={styles.empty}>
              <div style={styles.emptyIcon}>📭</div>
              <div style={{ fontSize: '0.8rem' }}>
                No se encontraron registros con los filtros aplicados.
              </div>
            </div>
          ) : (
            <div
              style={{
                ...styles.tableWrapper,
                ...(isMobile ? styles.tableWrapperMobile : {}),
              }}
            >
              <table style={styles.tableDetalle}>
                <thead>
                  <tr>
                    <th style={styles.thDetalle}>F. Solicitud</th>
                    <th style={styles.thDetalle}>H. Solicitud</th>
                    <th style={styles.thDetalle}>F. Creación</th>
                    <th style={styles.thDetalle}>H. Creación</th>
                    <th style={styles.thDetalle}>Operador</th>
                    <th style={styles.thDetalle}>Equipo</th>
                    <th style={styles.thDetalle}>Actividad</th>
                    <th style={styles.thDetalle}>Solicitado por</th>
                    <th style={styles.thDetalle}>Teléfono</th>
                    <th style={styles.thDetalle}>Cédula</th>
                    <th style={styles.thDetalle}>Área</th>
                    <th style={styles.thDetalle}>Centro costo</th>
                    <th style={styles.thDetalle}>Lugar</th>
                    <th style={styles.thDetalle}>Estado</th>
                    <th style={styles.thDetalle}>Código</th>
                    <th style={styles.thDetalle}>Inicio</th>
                    <th style={styles.thDetalle}>Fin</th>
                    <th style={styles.thDetalle}>Duración</th>
                    <th style={styles.thDetalle}>Evidencias</th>
                  </tr>
                </thead>
                <tbody>
                  {asignacionesFiltradas.map((a) => {
                    const reqTs = a.requestCreatedAt || a.createdAt;
                    const statusCfg = getStatusStyle(a.status);
                    const durMin =
                      a.durationMinutes != null
                        ? a.durationMinutes
                        : diffMinutes(a.startTime, a.endTime);

                    return (
                      <tr key={a.id} style={styles.trDetalle}>
                        <td style={styles.tdDetalle}>{formatDate(reqTs)}</td>
                        <td style={styles.tdDetalle}>{formatTime(reqTs)}</td>
                        <td style={styles.tdDetalle}>{formatDate(a.createdAt)}</td>
                        <td style={styles.tdDetalle}>{formatTime(a.createdAt)}</td>
                        <td style={styles.tdDetalle}>
                          {operadorMap[a.operatorId] || '—'}
                        </td>
                        <td style={styles.tdDetalle}>
                          {equipoMap[a.equipmentId] || '—'}
                        </td>
                        <td style={styles.tdDetalle}>{a.activity || '—'}</td>
                        <td style={styles.tdDetalle}>{a.solicitadoPor || '—'}</td>
                        <td style={styles.tdDetalle}>
                          {a.telefonoSolicitante || '—'}
                        </td>
                        <td style={styles.tdDetalle}>
                          {a.cedulaSolicitante || '—'}
                        </td>
                        <td style={styles.tdDetalle}>
                          {a.areaSolicitante || '—'}
                        </td>
                        <td style={styles.tdDetalle}>
                          {a.centroCosto || '—'}
                        </td>
                        <td style={styles.tdDetalle}>{a.location || '—'}</td>
                        <td style={styles.tdDetalle}>
                          <span
                            style={{
                              ...styles.statusBadge,
                              backgroundColor: statusCfg.bg,
                              color: statusCfg.color,
                            }}
                          >
                            {statusCfg.icon} {statusCfg.label}
                          </span>
                        </td>
                        <td style={styles.tdDetalle}>{a.requestCode || '—'}</td>
                        <td style={styles.tdDetalle}>{formatTime(a.startTime)}</td>
                        <td style={styles.tdDetalle}>{formatTime(a.endTime)}</td>
                        <td style={styles.tdDetalle}>{formatDuration(durMin)}</td>
                        <td style={{ ...styles.tdDetalle, ...styles.evidencesBox }}>
                          {a.evidences && a.evidences.length > 0 ? (
                            <>
                              {a.evidences.slice(0, 3).map((ev, idx) => (
                                <span key={idx} style={styles.evidenceTag}>
                                  {ev.type === 'photo'
                                    ? '📷 Foto'
                                    : ev.type === 'audio'
                                    ? '🎙 Audio'
                                    : '📝 Nota'}
                                </span>
                              ))}
                              {a.evidences.length > 3 && (
                                <div style={styles.evidencesMore}>
                                  +{a.evidences.length - 3} más
                                </div>
                              )}
                            </>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                              Sin evidencias
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
