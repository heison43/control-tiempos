'use client';

import { useEffect, useState } from 'react';
import { db } from '../../firebaseConfig';
import {
  addDoc,
  collection,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  orderBy,
  deleteDoc,
  doc,
} from 'firebase/firestore';

export default function WeeklyAssignments() {
  const [operadores, setOperadores] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [asignaciones, setAsignaciones] = useState([]);

  const [operador, setOperador] = useState('');
  const [equipo, setEquipo] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [turno, setTurno] = useState('día');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Cargar operadores y equipos
  useEffect(() => {
    const cargarDatos = async () => {
      const opsSnap = await getDocs(collection(db, 'operators'));
      const eqSnap = await getDocs(collection(db, 'equipment'));
      setOperadores(opsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setEquipos(eqSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    };
    cargarDatos();
  }, []);

  // Escuchar asignaciones en tiempo real
  useEffect(() => {
    const q = query(collection(db, 'weeklyAssignments'), orderBy('fechaInicio', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setAsignaciones(
        snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      );
    });
    return () => unsub();
  }, []);

  // Guardar nueva asignación
  const handleGuardar = async (e) => {
    e.preventDefault();
    if (!operador || !equipo || !fechaInicio || !fechaFin) {
      setError('Completa todos los campos');
      return;
    }

    try {
      setLoading(true);
      await addDoc(collection(db, 'weeklyAssignments'), {
        operadorId: operador,
        equipoId: equipo,
        fechaInicio: new Date(fechaInicio),
        fechaFin: new Date(fechaFin),
        turno,
        estado: 'activo',
        creadoEn: serverTimestamp(),
      });
      setError('');
      setOperador('');
      setEquipo('');
      setFechaInicio('');
      setFechaFin('');
    } catch (err) {
      console.error(err);
      setError('No se pudo guardar la asignación.');
    } finally {
      setLoading(false);
    }
  };

  const handleEliminar = async (id) => {
    if (!confirm('¿Eliminar esta asignación?')) return;
    await deleteDoc(doc(db, 'weeklyAssignments', id));
  };

  const formatDate = (d) =>
    d?.toDate ? d.toDate().toLocaleDateString('es-CO') : '-';

  return (
    <section
      style={{
        background: '#fff',
        padding: 20,
        borderRadius: 16,
        boxShadow: '0 1px 5px rgba(0,0,0,0.1)',
        marginBottom: 28,
      }}
    >
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>
        Asignaciones de equipos
      </h2>
      <p style={{ color: '#666', marginBottom: 16 }}>
        Define qué operador utilizará cada equipo durante un rango de fechas o turno.
      </p>

      {error && <p style={{ color: '#b91c1c' }}>{error}</p>}

      <form
        onSubmit={handleGuardar}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <select
          value={operador}
          onChange={(e) => setOperador(e.target.value)}
          style={input}
        >
          <option value="">Selecciona operador</option>
          {operadores.map((op) => (
            <option key={op.id} value={op.id}>
              {op.name} ({op.codigo})
            </option>
          ))}
        </select>

        <select
          value={equipo}
          onChange={(e) => setEquipo(e.target.value)}
          style={input}
        >
          <option value="">Selecciona equipo</option>
          {equipos.map((eq) => (
            <option key={eq.id} value={eq.id}>
              {eq.name} ({eq.codigo})
            </option>
          ))}
        </select>

        <input
          type="date"
          value={fechaInicio}
          onChange={(e) => setFechaInicio(e.target.value)}
          style={input}
        />
        <input
          type="date"
          value={fechaFin}
          onChange={(e) => setFechaFin(e.target.value)}
          style={input}
        />

        <select
          value={turno}
          onChange={(e) => setTurno(e.target.value)}
          style={input}
        >
          <option value="día">Turno día</option>
          <option value="noche">Turno noche</option>
        </select>

        <button
          type="submit"
          disabled={loading}
          style={{
            background: '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: 999,
            padding: '10px 16px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {loading ? 'Guardando...' : 'Guardar asignación'}
        </button>
      </form>

      {/* Tabla */}
      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 14,
          }}
        >
          <thead style={{ background: '#f9fafb' }}>
            <tr>
              <th style={th}>Operador</th>
              <th style={th}>Equipo</th>
              <th style={th}>Turno</th>
              <th style={th}>Desde</th>
              <th style={th}>Hasta</th>
              <th style={th}>Estado</th>
              <th style={th}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {asignaciones.map((a) => (
              <tr key={a.id}>
                <td style={td}>
                  {operadores.find((o) => o.id === a.operadorId)?.name ||
                    '—'}
                </td>
                <td style={td}>
                  {equipos.find((e) => e.id === a.equipoId)?.name || '—'}
                </td>
                <td style={td}>{a.turno}</td>
                <td style={td}>{formatDate(a.fechaInicio)}</td>
                <td style={td}>{formatDate(a.fechaFin)}</td>
                <td style={td}>
                  <span
                    style={{
                      background:
                        a.estado === 'activo' ? '#dcfce7' : '#fef2f2',
                      color: a.estado === 'activo' ? '#16a34a' : '#dc2626',
                      padding: '2px 8px',
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  >
                    {a.estado}
                  </span>
                </td>
                <td style={td}>
                  <button
                    onClick={() => handleEliminar(a.id)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#dc2626',
                      cursor: 'pointer',
                    }}
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const input = {
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid #ddd',
  width: '100%',
};

const th = {
  textAlign: 'left',
  padding: '8px',
  borderBottom: '1px solid #e5e7eb',
};

const td = {
  padding: '8px',
  borderBottom: '1px solid #f3f4f6',
};
