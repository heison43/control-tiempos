'use client';

import { useEffect, useState, useMemo } from 'react';
import { db } from '../../firebaseConfig';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';

// ---------- Helpers ----------
function formatDate(d) {
  if (!d) return '-';
  const date = d.toDate ? d.toDate() : new Date(d);
  return date.toLocaleDateString('es-CO');
}

function formatTime(d) {
  if (!d) return '-';
  const date = d.toDate ? d.toDate() : new Date(d);
  return date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

function diffMinutes(start, end) {
  if (!start || !end) return 0;
  const s = (start.toDate ? start.toDate() : new Date(start)).getTime();
  const e = (end.toDate ? end.toDate() : new Date(end)).getTime();
  return Math.max(0, Math.round((e - s) / 60000));
}

function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

function formatDateTime(date, compare) {
  if (!date) return '-';
  const d1 = date.toDate ? date.toDate() : new Date(date);
  const d2 = compare?.toDate ? compare.toDate() : new Date(compare);
  const sameDay = d1.toDateString() === d2.toDateString();
  return sameDay ? formatTime(date) : `${formatDate(date)} ${formatTime(date)}`;
}

// ---------- Estilos base + mobile ----------
const mainStyle = {
  background: '#f8fafc',
  minHeight: '100vh',
  padding: '32px 24px',
  fontFamily: 'system-ui, -apple-system, sans-serif',
};

const mainStyleMobile = {
  padding: '16px 12px',
};

const containerStyle = {
  maxWidth: 1400,
  margin: '0 auto',
};

const containerStyleMobile = {
  maxWidth: '100%',
};

const filtrosBottomRowStyle = {
  display: 'flex',
  gap: 12,
  alignItems: 'center',
  justifyContent: 'space-between',
};

const filtrosBottomRowMobile = {
  flexDirection: 'column',
  alignItems: 'stretch',
  gap: 16,
};

const filtrosButtonsRowStyle = {
  display: 'flex',
  gap: 12,
};

const filtrosButtonsRowMobile = {
  flexWrap: 'wrap',
  width: '100%',
  justifyContent: 'flex-end',
};

const resumenGridStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 24,
  marginBottom: 32,
};

const resumenGridMobile = {
  gridTemplateColumns: '1fr',
};

const detalleTableWrapperStyle = {
  overflowX: 'auto',
};

const detalleTableWrapperMobile = {
  maxWidth: '100vw',
};

const btnBlockMobile = {
  width: '100%',
  justifyContent: 'center',
  textAlign: 'center',
};

// ⭐ NUEVO: grid principal de filtros
const filtrosGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: 16,
  marginBottom: 16,
};

const filtrosGridMobile = {
  gridTemplateColumns: '1fr',
};

// ⭐ NUEVO: contenedor de la caja de búsqueda
const busquedaFieldStyle = {
  gridColumn: 'span 2',
};

const busquedaFieldMobile = {
  gridColumn: 'span 1',
};

// ---------- Componente principal ----------
export default function HistorialPage() {
  const hoy = new Date();
  const hace7 = new Date();
  hace7.setDate(hoy.getDate() - 7);

  const [desde, setDesde] = useState(toISODate(hace7));
  const [hasta, setHasta] = useState(toISODate(hoy));
  const [operadorFiltro, setOperadorFiltro] = useState('todos');
  const [equipoFiltro, setEquipoFiltro] = useState('todos');
  const [estadoFiltro, setEstadoFiltro] = useState('todos');
  const [busqueda, setBusqueda] = useState('');

  const [asignaciones, setAsignaciones] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  const [operadores, setOperadores] = useState([]);
  const [equipos, setEquipos] = useState([]);

  // 🔹 Detectar mobile
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

  // ----- Cargar catálogos -----
  useEffect(() => {
    const cargarCatalogos = async () => {
      try {
        const opsSnap = await getDocs(collection(db, 'operators'));
        const eqSnap = await getDocs(collection(db, 'equipment'));
        setOperadores(opsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setEquipos(eqSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error(err);
      }
    };
    cargarCatalogos();
  }, []);

  // ----- Cargar asignaciones -----
  const handleAplicarFiltros = async () => {
    setCargando(true);
    setError('');
    try {
      const q = query(collection(db, 'assignments'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const registros = snap.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
        };
      });
      setAsignaciones(registros);
    } catch (err) {
      console.error(err);
      setError('Error consultando historial');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    handleAplicarFiltros();
  }, []);

  // ----- Mapas -----
  const operadorMap = useMemo(() => {
    const map = {};
    operadores.forEach((o) => (map[o.id] = `${o.name} (${o.codigo})`));
    return map;
  }, [operadores]);
  
  const equipoMap = useMemo(() => {
    const map = {};
    equipos.forEach((e) => (map[e.id] = `${e.name} (${e.codigo})`));
    return map;
  }, [equipos]);

  // ----- Filtrado -----
  const asignacionesFiltradas = useMemo(() => {
    const dDesde = new Date(desde);
    const dHasta = new Date(hasta);
    dHasta.setHours(23, 59, 59, 999);
    
    return asignaciones.filter((a) => {
      const fecha = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
      if (fecha < dDesde || fecha > dHasta) return false;
      if (operadorFiltro !== 'todos' && a.operatorId !== operadorFiltro) return false;
      if (equipoFiltro !== 'todos' && a.equipmentId !== equipoFiltro) return false;
      if (estadoFiltro !== 'todos' && a.status !== estadoFiltro) return false;
      if (busqueda.trim()) {
        const texto = busqueda.toLowerCase();
        const cadena = `${operadorMap[a.operatorId] || ''} ${equipoMap[a.equipmentId] || ''} ${
          a.activity || ''
        } ${a.location || ''} ${a.solicitadoPor || ''}`.toLowerCase();
        return cadena.includes(texto);
      }
      return true;
    });
  }, [asignaciones, desde, hasta, operadorFiltro, equipoFiltro, estadoFiltro, busqueda, operadorMap, equipoMap]);

  // ----- Resúmenes -----
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
          minutos: 0,
        });
      }
      const item = map.get(key);
      item.total++;
      if (a.status === 'finalizado') {
        item.finalizadas++;
        item.minutos += diffMinutes(a.startTime, a.endTime);
      } else if (a.status === 'en_progreso') {
        item.enProgreso++;
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
      item.total++;
      if (a.status === 'finalizado') {
        item.minutos += diffMinutes(a.startTime, a.endTime);
      }
    });
    return Array.from(map.values());
  }, [asignacionesFiltradas, equipoMap]);

  // ----- CSV -----
  const handleExportarCsv = () => {
    if (!asignacionesFiltradas.length) return;
    const header = ['Fecha', 'Operador', 'Equipo', 'Actividad', 'Solicitado por', 'Lugar', 'Estado', 'Inicio', 'Fin', 'Minutos'];
    const rows = asignacionesFiltradas.map((a) => [
      formatDate(a.createdAt),
      operadorMap[a.operatorId] || '',
      equipoMap[a.equipmentId] || '',
      a.activity || '',
      a.solicitadoPor || '',
      a.location || '',
      a.status || '',
      formatDateTime(a.startTime, a.endTime),
      formatDateTime(a.endTime, a.startTime),
      diffMinutes(a.startTime, a.endTime),
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';'))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `historial_${desde}_a_${hasta}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // ----- Resetear filtros -----
  const handleResetFiltros = () => {
    const hoy = new Date();
    const hace7 = new Date();
    hace7.setDate(hoy.getDate() - 7);
    
    setDesde(toISODate(hace7));
    setHasta(toISODate(hoy));
    setOperadorFiltro('todos');
    setEquipoFiltro('todos');
    setEstadoFiltro('todos');
    setBusqueda('');
  };

  // ---------- UI ----------
  return (
    <main style={{ ...mainStyle, ...(isMobile ? mainStyleMobile : {}) }}>
      <div style={{ ...containerStyle, ...(isMobile ? containerStyleMobile : {}) }}>
        {/* HEADER */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8, color: '#1e293b' }}>
            Historial de asignaciones
          </h1>
          <p style={{ color: '#64748b', fontSize: 16, margin: 0 }}>
            Filtra por rango de fechas, operador, equipo o estado. Exporta la información o revisa resúmenes.
          </p>
        </div>

        {/* FILTROS */}
        <section
          style={{
            background: '#fff',
            borderRadius: 12,
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            padding: 24,
            marginBottom: 32,
            border: '1px solid #e2e8f0',
          }}
        >
          {/* ⭐ filtrosGrid con versión mobile */}
          <div
            style={{
              ...filtrosGridStyle,
              ...(isMobile ? filtrosGridMobile : {}),
            }}
          >
            <div>
              <label style={labelStyle}>Desde</label>
              <input 
                type="date" 
                value={desde} 
                onChange={(e) => setDesde(e.target.value)} 
                style={inputStyle} 
              />
            </div>
            <div>
              <label style={labelStyle}>Hasta</label>
              <input 
                type="date" 
                value={hasta} 
                onChange={(e) => setHasta(e.target.value)} 
                style={inputStyle} 
              />
            </div>
            <div>
              <label style={labelStyle}>Operador</label>
              <select value={operadorFiltro} onChange={(e) => setOperadorFiltro(e.target.value)} style={inputStyle}>
                <option value="todos">Todos los operadores</option>
                {operadores.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} ({o.codigo})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Equipo</label>
              <select value={equipoFiltro} onChange={(e) => setEquipoFiltro(e.target.value)} style={inputStyle}>
                <option value="todos">Todos los equipos</option>
                {equipos.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} ({e.codigo})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Estado</label>
              <select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)} style={inputStyle}>
                <option value="todos">Todos los estados</option>
                <option value="pendiente">Pendiente</option>
                <option value="en_progreso">En progreso</option>
                <option value="finalizado">Finalizado</option>
              </select>
            </div>

            {/* ⭐ caja de búsqueda adaptada */}
            <div
              style={{
                ...busquedaFieldStyle,
                ...(isMobile ? busquedaFieldMobile : {}),
              }}
            >
              <label style={labelStyle}>Búsqueda</label>
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Ej: ICO, Telehandler, concentrado, Juan Pérez..."
                style={inputStyle}
              />
            </div>
          </div>

          <div
            style={{
              ...filtrosBottomRowStyle,
              ...(isMobile ? filtrosBottomRowMobile : {}),
            }}
          >
            <div style={{ color: '#64748b', fontSize: 14 }}>
              {asignacionesFiltradas.length} registros encontrados
            </div>
            <div
              style={{
                ...filtrosButtonsRowStyle,
                ...(isMobile ? filtrosButtonsRowMobile : {}),
              }}
            >
              <button
                onClick={handleResetFiltros}
                style={{ ...btnSecondary, ...(isMobile ? btnBlockMobile : {}) }}
              >
                Limpiar filtros
              </button>
              <button
                onClick={handleAplicarFiltros}
                style={{ ...btnPrimary, ...(isMobile ? btnBlockMobile : {}) }}
                disabled={cargando}
              >
                {cargando ? '⌛ Cargando...' : '🔍 Aplicar filtros'}
              </button>
              <button
                onClick={handleExportarCsv}
                style={{ ...btnSuccess, ...(isMobile ? btnBlockMobile : {}) }}
                disabled={!asignacionesFiltradas.length}
              >
                📊 Exportar CSV
              </button>
            </div>
          </div>

          {error && (
            <div
              style={{
                marginTop: 16,
                padding: 12,
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 8,
                color: '#dc2626',
              }}
            >
              {error}
            </div>
          )}
        </section>

        {/* RESÚMENES */}
        <div
          style={{
            ...resumenGridStyle,
            ...(isMobile ? resumenGridMobile : {}),
          }}
        >
          <Card title="📈 Resumen por operador">
            {resumenPorOperador.length === 0 ? (
              <EmptyState message="No hay datos para mostrar" />
            ) : (
              <TableResumen
                headers={['Operador', 'Asign.', 'Finaliz.', 'En prog.', 'Horas']}
                rows={resumenPorOperador.map((r) => [
                  r.operador,
                  <span key="total" style={{ fontWeight: 600 }}>{r.total}</span>,
                  <span key="finalizadas" style={{ color: r.finalizadas > 0 ? '#10b981' : '#64748b' }}>{r.finalizadas}</span>,
                  <span key="progreso" style={{ color: r.enProgreso > 0 ? '#f59e0b' : '#64748b' }}>{r.enProgreso}</span>,
                  <span key="horas" style={{ fontWeight: 500, color: '#1e293b' }}>{(r.minutos / 60).toFixed(2)}h</span>,
                ])}
              />
            )}
          </Card>

          <Card title="🔄 Resumen por equipo">
            {resumenPorEquipo.length === 0 ? (
              <EmptyState message="No hay datos para mostrar" />
            ) : (
              <TableResumen
                headers={['Equipo', 'Asign.', 'Horas']}
                rows={resumenPorEquipo.map((r) => [
                  r.equipo,
                  <span key="total" style={{ fontWeight: 600 }}>{r.total}</span>,
                  <span key="horas" style={{ fontWeight: 500, color: '#1e293b' }}>{(r.minutos / 60).toFixed(2)}h</span>,
                ])}
              />
            )}
          </Card>
        </div>

        {/* DETALLE */}
        <Card title="📋 Detalle de asignaciones">
          {asignacionesFiltradas.length === 0 ? (
            <EmptyState message="No se encontraron registros con los filtros aplicados" />
          ) : (
            <div
              style={{
                ...detalleTableWrapperStyle,
                ...(isMobile ? detalleTableWrapperMobile : {}),
              }}
            >
              <TableDetalle
                headers={['Fecha', 'Operador', 'Equipo', 'Actividad', 'Solicitado por', 'Lugar', 'Estado', 'Inicio', 'Fin', 'Min']}
                rows={asignacionesFiltradas.map((a) => [
                  formatDate(a.createdAt),
                  operadorMap[a.operatorId] || '-',
                  equipoMap[a.equipmentId] || '-',
                  a.activity || '-',
                  a.solicitadoPor || '-',
                  a.location || '-',
                  <StatusBadge key={a.id} status={a.status} />,
                  formatDateTime(a.startTime, a.endTime),
                  formatDateTime(a.endTime, a.startTime),
                  <span key="min" style={{ fontWeight: 500 }}>{diffMinutes(a.startTime, a.endTime)}</span>,
                ])}
              />
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}

// ---------- Componentes de estilo ----------
const labelStyle = {
  display: 'block',
  fontSize: 14,
  fontWeight: 500,
  color: '#374151',
  marginBottom: 4,
};

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid #d1d5db',
  background: '#fff',
  fontSize: 14,
  transition: 'all 0.2s',
};

const btnPrimary = {
  padding: '10px 20px',
  background: '#3b82f6',
  color: 'white',
  border: 'none',
  borderRadius: 8,
  fontWeight: 600,
  cursor: 'pointer',
  fontSize: 14,
  transition: 'all 0.2s',
};

const btnSecondary = {
  padding: '10px 20px',
  background: '#6b7280',
  color: 'white',
  border: 'none',
  borderRadius: 8,
  fontWeight: 600,
  cursor: 'pointer',
  fontSize: 14,
  transition: 'all 0.2s',
};

const btnSuccess = {
  padding: '10px 20px',
  background: '#10b981',
  color: 'white',
  border: 'none',
  borderRadius: 8,
  fontWeight: 600,
  cursor: 'pointer',
  fontSize: 14,
  transition: 'all 0.2s',
};

function Card({ title, children }) {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 12,
        padding: 24,
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        border: '1px solid #e2e8f0',
        height: 'fit-content',
      }}
    >
      <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, color: '#1e293b' }}>{title}</h3>
      {children}
    </div>
  );
}

function TableResumen({ headers, rows }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
      <thead>
        <tr style={{ background: '#f8fafc' }}>
          {headers.map((h) => (
            <th key={h} style={{ padding: '12px 8px', borderBottom: '1px solid #e2e8f0', fontWeight: 600, color: '#475569', textAlign: 'left' }}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} style={{ borderBottom: i < rows.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
            {r.map((v, j) => (
              <td key={j} style={{ padding: '12px 8px' }}>
                {v}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TableDetalle({ headers, rows }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 1100 }}>
      <thead>
        <tr style={{ background: '#f8fafc' }}>
          {headers.map((h) => (
            <th key={h} style={{ padding: '12px 8px', borderBottom: '1px solid #e2e8f0', fontWeight: 600, color: '#475569', textAlign: 'left' }}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} style={{ borderBottom: i < rows.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
            {r.map((v, j) => (
              <td key={j} style={{ padding: '12px 8px', whiteSpace: 'nowrap' }}>
                {v}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function StatusBadge({ status }) {
  const styles = {
    pendiente: { background: '#fef3c7', color: '#92400e' },
    en_progreso: { background: '#dbeafe', color: '#1e40af' },
    finalizado: { background: '#d1fae5', color: '#065f46' },
  };

  const statusText = {
    pendiente: 'Pendiente',
    en_progreso: 'En progreso',
    finalizado: 'Finalizado',
  };

  const style = styles[status] || { background: '#f3f4f6', color: '#374151' };

  return (
    <span
      style={{
        padding: '4px 8px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 500,
        ...style,
      }}
    >
      {statusText[status] || status}
    </span>
  );
}

function EmptyState({ message }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
      <p style={{ margin: 0, fontSize: 14 }}>{message}</p>
    </div>
  );
}
