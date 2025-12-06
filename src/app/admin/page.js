'use client';

import { useEffect, useMemo, useState } from 'react';
import { db } from '../../firebaseConfig';
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import WeeklyAssignments from '../admin/WeeklyAssignments';
import ManageBasicData from "../admin/ManageBasicData";
import ManageAssignments from "../admin/ManageAssignments";
import HistorialPage from '../historial/page';
import ManageAdmins from "../admin/ManageAdmins";


export default function AdminPanel() {
  const [operators, setOperators] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [weeklyAssignments, setWeeklyAssignments] = useState([]);
  const [selectedOperator, setSelectedOperator] = useState('');
  const [selectedEquipment, setSelectedEquipment] = useState('');
  const [activity, setActivity] = useState('');
  const [location, setLocation] = useState('');
  const [solicitadoPor, setSolicitadoPor] = useState('');
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('nueva');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // 🔹 NUEVO: detectar si es móvil
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

  // ---------- Cargar datos ----------
  useEffect(() => {
    const unsubOps = onSnapshot(collection(db, 'operators'), (snap) =>
      setOperators(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );

    const unsubEquip = onSnapshot(collection(db, 'equipment'), (snap) =>
      setEquipment(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );

    const unsubWeekly = onSnapshot(collection(db, 'weeklyAssignments'), (snap) =>
      setWeeklyAssignments(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );

    const q = query(collection(db, 'assignments'), orderBy('createdAt', 'desc'));
    const unsubAssign = onSnapshot(q, (snap) => {
      setAssignments(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    return () => {
      unsubOps();
      unsubEquip();
      unsubWeekly();
      unsubAssign();
    };
  }, []);

  // ---------- Mapas ----------
  const operatorMap = useMemo(() => {
    const m = {};
    operators.forEach(
      (o) =>
        (m[o.id] = `${o.name || 'Sin nombre'}${
          o.codigo ? ` (${o.codigo})` : ''
        }`)
    );
    return m;
  }, [operators]);

  const equipmentMap = useMemo(() => {
    const m = {};
    equipment.forEach(
      (e) =>
        (m[e.id] = `${e.name || 'Equipo'}${e.codigo ? ` (${e.codigo})` : ''}`)
    );
    return m;
  }, [equipment]);

  // ---------- 🔹 Filtro por rango de fechas y estado ----------
  const assignmentsFiltered = useMemo(() => {
    let filtered = assignments;

    if (activeTab !== 'todas' && activeTab !== 'nueva' && activeTab !== 'gestion' && activeTab !== 'equipos' && activeTab !== 'catalogos') {
      filtered = filtered.filter(a => a.status === activeTab);
    }

    if (startDate || endDate) {
      const start = startDate ? new Date(`${startDate}T00:00:00-05:00`) : new Date('1900-01-01');
      const end = endDate ? new Date(`${endDate}T23:59:59-05:00`) : new Date('2999-12-31');

      filtered = filtered.filter((a) => {
        if (!a.createdAt?.toDate) return false;
        const dt = a.createdAt.toDate();
        const local = new Date(dt.toLocaleString('en-US', { timeZone: 'America/Bogota' }));
        return local >= start && local <= end;
      });
    }

    return filtered;
  }, [assignments, activeTab, startDate, endDate]);

  // ---------- Estadísticas ----------
  const stats = useMemo(() => ({
    total: assignments.length,
    pendientes: assignments.filter(a => a.status === 'pendiente').length,
    enProgreso: assignments.filter(a => a.status === 'en_progreso').length,
    pausadas: assignments.filter(a => a.status === 'pausado').length,
    finalizadas: assignments.filter(a => a.status === 'finalizado').length,
  }), [assignments]);

  // ---------- Lógica Operador → Equipo ----------
  useEffect(() => {
    if (!selectedOperator) {
      setSelectedEquipment('');
      return;
    }

    const hoy = new Date();
    const asignacionActiva = weeklyAssignments.find((a) => {
      const desde = a.fechaInicio?.toDate ? a.fechaInicio.toDate() : new Date(a.fechaInicio);
      const hasta = a.fechaFin?.toDate ? a.fechaFin.toDate() : new Date(a.fechaFin);
      return (
        a.operadorId === selectedOperator &&
        hoy >= desde &&
        hoy <= hasta &&
        a.estado === 'activo'
      );
    });

    if (asignacionActiva) {
      setSelectedEquipment(asignacionActiva.equipoId);
    } else {
      setSelectedEquipment('');
    }
  }, [selectedOperator, weeklyAssignments]);

  // ---------- Equipos disponibles ----------
  const equiposDisponibles = equipment.filter((eq) => {
    const hoy = new Date();
    const ocupado = weeklyAssignments.some((a) => {
      const desde = a.fechaInicio?.toDate ? a.fechaInicio.toDate() : new Date(a.fechaInicio);
      const hasta = a.fechaFin?.toDate ? a.fechaFin.toDate() : new Date(a.fechaFin);
      return hoy >= desde && hoy <= hasta && a.equipoId === eq.id && a.estado === 'activo';
    });
    return !ocupado;
  });

  // ---------- Crear asignación ----------
  const handleCreateAssignment = async (e) => {
    e.preventDefault();
    setError('');

    if (!selectedOperator || !activity.trim() || !location.trim() || !solicitadoPor.trim()) {
      setError('Completa operador, actividad, lugar y solicitado por.');
      return;
    }

    await addDoc(collection(db, 'assignments'), {
      operatorId: selectedOperator,
      equipmentId: selectedEquipment || null,
      activity: activity.trim(),
      location: location.trim(),
      solicitadoPor: solicitadoPor.trim(),
      status: 'pendiente',
      createdAt: serverTimestamp(),
      startTime: null,
      endTime: null,
      durationMinutes: null,
      evidences: [],
    });

    setActivity('');
    setLocation('');
    setSolicitadoPor('');
    setSelectedOperator('');
    setSelectedEquipment('');
  };

  // 🔹 NUEVO: Exportar CSV (SOLO EXPORTACIÓN) ----------
  const handleExportCSV = async () => {
    if (assignmentsFiltered.length === 0) {
      alert("No hay asignaciones para exportar.");
      return;
    }

    try {
      const header = ["Fecha", "Operador", "Equipo", "Actividad", "Solicitado por", "Lugar", "Estado", "Inicio", "Fin", "Duración (min)", "Notas"];
      const rows = assignmentsFiltered.map((a) => {
        const opName = operatorMap[a.operatorId] || a.operatorId || "";
        const eqName = equipmentMap[a.equipmentId] || a.equipmentId || "";
        const dateStr = a.createdAt?.toDate ? a.createdAt.toDate().toLocaleDateString("es-CO", { timeZone: "America/Bogota" }) : "";
        const startStr = a.startTime?.toDate ? a.startTime.toDate().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", timeZone: "America/Bogota" }) : "";
        const endStr = a.endTime?.toDate ? a.endTime.toDate().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", timeZone: "America/Bogota" }) : "";
        const evidences = a.evidences && Array.isArray(a.evidences) ? a.evidences.map((ev) => (ev.type === "text" ? ev.content : ev.url)).join(" | ") : "";

        return [
          dateStr,
          opName,
          eqName,
          a.activity || "",
          a.solicitadoPor || "",
          a.location || "",
          a.status || "",
          startStr,
          endStr,
          a.durationMinutes ?? "",
          evidences
        ];
      });

      const csvContent = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
      const fileName = `asignaciones_${new Date().toLocaleDateString("es-CO").replace(/\//g, "-")}.csv`;

      // Solo descarga local
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);

      alert("✅ CSV exportado exitosamente");

    } catch (err) {
      console.error("Error al exportar:", err);
      alert("⚠️ Error al exportar el archivo.");
    }
  };

  // 🔹 NUEVO: Función para enviar por correo manualmente
  const handleSendEmail = async () => {
    if (assignmentsFiltered.length === 0) {
      alert("No hay asignaciones para enviar por correo.");
      return;
    }

    try {
      const header = ["Fecha", "Operador", "Equipo", "Actividad", "Solicitado por", "Lugar", "Estado", "Inicio", "Fin", "Duración (min)", "Notas"];
      const rows = assignmentsFiltered.map((a) => {
        const opName = operatorMap[a.operatorId] || a.operatorId || "";
        const eqName = equipmentMap[a.equipmentId] || a.equipmentId || "";
        const dateStr = a.createdAt?.toDate ? a.createdAt.toDate().toLocaleDateString("es-CO", { timeZone: "America/Bogota" }) : "";
        const startStr = a.startTime?.toDate ? a.startTime.toDate().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", timeZone: "America/Bogota" }) : "";
        const endStr = a.endTime?.toDate ? a.endTime.toDate().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", timeZone: "America/Bogota" }) : "";
        const evidences = a.evidences && Array.isArray(a.evidences) ? a.evidences.map((ev) => (ev.type === "text" ? ev.content : ev.url)).join(" | ") : "";

        return [
          dateStr,
          opName,
          eqName,
          a.activity || "",
          a.solicitadoPor || "",
          a.location || "",
          a.status || "",
          startStr,
          endStr,
          a.durationMinutes ?? "",
          evidences
        ];
      });

      const csvContent = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
      const fileName = `asignaciones_${new Date().toLocaleDateString("es-CO").replace(/\//g, "-")}.csv`;

      await sendEmailWithAttachment(fileName, csvContent, 'manual');

    } catch (err) {
      console.error("Error al enviar por correo:", err);
      alert("⚠️ Error al enviar por correo.");
    }
  };

  // 🔹 NUEVO: Función modificada para enviar correo
  const sendEmailWithAttachment = async (fileName, csvContent, type = 'manual') => {
  try {
    const response = await fetch('/api/sendReport', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName, csvContent, type }),
    });

    const result = await response.json();

    if (result.success) {
      console.log(`✅ Correo ${type} enviado exitosamente`);
      if (type === 'manual') {
        alert("✅ Reporte enviado por correo exitosamente");
      }
    } else {
      console.error(`❌ Error enviando correo ${type}:`, result.error);
      if (type === 'manual') {
        alert("❌ Error enviando por correo: " + (result.error || 'Error desconocido'));
      }
    }
  } catch (error) {
    console.error(`❌ Error en envío de correo ${type}:`, error);
    if (type === 'manual') {
      alert("❌ Error de conexión al enviar correo: " + error.message);
    }
  }
};


  // 🔹 NUEVO: Envío Automático Diario ----------
  useEffect(() => {
    const sendDailyEmail = async () => {
      try {
        // Obtener todas las asignaciones del día actual
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

        const dailyAssignments = assignments.filter((a) => {
          if (!a.createdAt?.toDate) return false;
          const assignmentDate = a.createdAt.toDate();
          return assignmentDate >= startOfDay && assignmentDate <= endOfDay;
        });

        if (dailyAssignments.length === 0) {
          console.log('📭 No hay asignaciones para enviar hoy');
          return;
        }

        // Generar CSV
        const header = ["Fecha", "Operador", "Equipo", "Actividad", "Solicitado por", "Lugar", "Estado", "Inicio", "Fin", "Duración (min)", "Notas"];
        const rows = dailyAssignments.map((a) => {
          const opName = operatorMap[a.operatorId] || a.operatorId || "";
          const eqName = equipmentMap[a.equipmentId] || a.equipmentId || "";
          const dateStr = a.createdAt?.toDate ? a.createdAt.toDate().toLocaleDateString("es-CO", { timeZone: "America/Bogota" }) : "";
          const startStr = a.startTime?.toDate ? a.startTime.toDate().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", timeZone: "America/Bogota" }) : "";
          const endStr = a.endTime?.toDate ? a.endTime.toDate().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", timeZone: "America/Bogota" }) : "";
          const evidences = a.evidences && Array.isArray(a.evidences) ? a.evidences.map((ev) => (ev.type === "text" ? ev.content : ev.url)).join(" | ") : "";

          return [
            dateStr,
            opName,
            eqName,
            a.activity || "",
            a.solicitadoPor || "",
            a.location || "",
            a.status || "",
            startStr,
            endStr,
            a.durationMinutes ?? "",
            evidences
          ];
        });

        const csvContent = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
        const fileName = `reporte_diario_${today.toLocaleDateString("es-CO").replace(/\//g, "-")}.csv`;

        // Enviar por correo
        await sendEmailWithAttachment(fileName, csvContent, 'daily');
        console.log('📧 Reporte diario enviado automáticamente');
        
      } catch (error) {
        console.error('❌ Error en envío automático:', error);
      }
    };

    const setupDailyEmail = () => {
      const now = new Date();
      const targetTime = new Date();
      targetTime.setHours(18, 0, 0, 0); // 6:00 PM

      // Si ya pasó las 6 PM hoy, programar para mañana
      if (now > targetTime) {
        targetTime.setDate(targetTime.getDate() + 1);
      }

      const timeUntilTarget = targetTime.getTime() - now.getTime();

      console.log(`⏰ Próximo envío automático programado para: ${targetTime}`);

      // Programar el primer envío
      const initialTimer = setTimeout(() => {
        sendDailyEmail();
        
        // Programar envíos cada 24 horas
        setInterval(sendDailyEmail, 24 * 60 * 60 * 1000);
      }, timeUntilTarget);

      return () => clearTimeout(initialTimer);
    };

    // Solo configurar en el cliente
    if (typeof window !== 'undefined') {
      const timer = setupDailyEmail();
      return () => clearTimeout(timer);
    }
  }, [assignments, operatorMap, equipmentMap]);

  // ---------- Helpers ----------
  const formatTime = (ts) => {
    if (!ts) return '-';
    const d = ts.toDate ? ts.toDate() : ts;
    return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' });
  };

  const formatDate = (ts) => {
    if (!ts) return '-';
    const d = ts.toDate ? ts.toDate() : ts;
    return d.toLocaleDateString('es-CO', { timeZone: 'America/Bogota' });
  };

  const formatDuration = (minutes) => {
    if (minutes == null) return '-';
    if (minutes < 60) return `${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m === 0 ? `${h} h` : `${h} h ${m} min`;
  };

  const getStatusConfig = (status) => {
    const configs = {
      pendiente: { label: 'Pendiente', color: '#f59e0b', icon: '⏳', bgColor: '#fef3c7' },
      en_progreso: { label: 'En Progreso', color: '#10b981', icon: '▶️', bgColor: '#d1fae5' },
      pausado: { label: 'Pausado', color: '#ef4444', icon: '⏸️', bgColor: '#fee2e2' },
      finalizado: { label: 'Finalizado', color: '#6b7280', icon: '✅', bgColor: '#f3f4f6' }
    };
    return configs[status] || { label: status, color: '#6b7280', icon: '📝', bgColor: '#f3f4f6' };
  };

  // ---------- Renderizado condicional por tab ----------
  const renderTabContent = () => {
    switch (activeTab) {
      case 'nueva':
        return (
          <>
            {/* Nueva Asignación Diaria */}
            <section style={{ ...styles.card, ...(isMobile ? styles.cardMobile : {}) }}>
              <div style={{ ...styles.cardHeader, ...(isMobile ? styles.cardHeaderMobile : {}) }}>
                <h2 style={styles.cardTitle}>➕ Crear Asignación Rápida</h2>
                <div style={styles.cardBadge}>Diaria</div>
              </div>

              {error && <div style={styles.error}>{error}</div>}

              <form
                onSubmit={handleCreateAssignment}
                style={{ ...styles.formGrid, ...(isMobile ? styles.formGridMobile : {}) }}
              >
                <div style={styles.formGroup}>
                  <label style={styles.label}>👤 Operador *</label>
                  <select
                    value={selectedOperator}
                    onChange={(e) => setSelectedOperator(e.target.value)}
                    style={styles.select}
                    required
                  >
                    <option value="">Selecciona un operador</option>
                    {operators.map((op) => (
                      <option key={op.id} value={op.id}>
                        {op.name} {op.codigo ? `(${op.codigo})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>👥 Solicitado por *</label>
                  <input
                    type="text"
                    value={solicitadoPor}
                    onChange={(e) => setSolicitadoPor(e.target.value)}
                    placeholder="Ej: Juan Pérez, Almacén, Proveedor XYZ..."
                    style={styles.input}
                    required
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>📋 Actividad *</label>
                  <input
                    type="text"
                    value={activity}
                    onChange={(e) => setActivity(e.target.value)}
                    placeholder="Ej: Descargue de proveedor, Traslado de material..."
                    style={styles.input}
                    required
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>🚜 Equipo</label>
                  <select
                    value={selectedEquipment}
                    onChange={(e) => setSelectedEquipment(e.target.value)}
                    style={styles.select}
                    disabled={!!selectedEquipment}
                  >
                    <option value="">
                      {selectedEquipment ? 'Asignado automáticamente' : 'Selecciona un equipo (opcional)'}
                    </option>
                    {equiposDisponibles.map((eq) => (
                      <option key={eq.id} value={eq.id}>
                        {eq.name} {eq.codigo ? `(${eq.codigo})` : ''}
                      </option>
                    ))}
                  </select>
                  {selectedEquipment && (
                    <div style={styles.autoAssigned}>
                      ✅ Equipo asignado automáticamente
                    </div>
                  )}
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>📍 Lugar *</label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Ej: Patio planta, Bodega 3, Muelle de carga..."
                    style={styles.input}
                    required
                  />
                </div>

                <div
                  style={{
                    ...styles.formActions,
                    ...(isMobile ? styles.formActionsMobile : {}),
                  }}
                >
                  <button type="submit" style={styles.btnPrimary}>
                    ✅ Crear Asignación
                  </button>
                </div>
              </form>
            </section>

            {/* Panel de Asignaciones */}
            <section style={{ ...styles.card, ...(isMobile ? styles.cardMobile : {}) }}>
              <div
                style={{
                  ...styles.panelHeader,
                  ...(isMobile ? styles.panelHeaderMobile : {}),
                }}
              >
                <div>
                  <h2 style={styles.cardTitle}>📊 Lista de Asignaciones</h2>
                  <p style={styles.cardSubtitle}>
                    {assignmentsFiltered.length} asignaciones encontradas
                    {startDate || endDate ? ' (con filtros aplicados)' : ''}
                  </p>
                </div>
                <div
                  style={{
                    ...styles.controls,
                    ...(isMobile ? styles.controlsMobile : {}),
                  }}
                >
                  <div
                    style={{
                      ...styles.filters,
                      ...(isMobile ? styles.filtersMobile : {}),
                    }}
                  >
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      style={styles.dateInput}
                      placeholder="Desde"
                    />
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      style={styles.dateInput}
                      placeholder="Hasta"
                    />
                    {/* 🔹 NUEVO: Botones separados */}
                    <button onClick={handleExportCSV} style={styles.btnExport}>
                      📥 Exportar CSV
                    </button>
                    <button onClick={handleSendEmail} style={styles.btnEmail}>
                      📧 Enviar por Correo
                    </button>
                  </div>
                </div>
              </div>

              {/* Tabs de Estado */}
              <div style={styles.tabs}>
                {[
                  { id: 'todas', label: 'Todas', count: stats.total },
                  { id: 'pendiente', label: 'Pendientes', count: stats.pendientes },
                  { id: 'en_progreso', label: 'En Progreso', count: stats.enProgreso },
                  { id: 'pausado', label: 'Pausadas', count: stats.pausadas },
                  { id: 'finalizado', label: 'Finalizadas', count: stats.finalizadas }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      ...styles.tab,
                      ...(activeTab === tab.id ? styles.tabActive : {}),
                    }}
                  >
                    {tab.label}
                    <span style={styles.tabCount}>{tab.count}</span>
                  </button>
                ))}
              </div>

              {loading ? (
                <div style={styles.loading}>
                  <div style={styles.spinner}></div>
                  <p>Cargando asignaciones...</p>
                </div>
              ) : assignmentsFiltered.length === 0 ? (
                <div style={styles.emptyState}>
                  <div style={styles.emptyIcon}>📝</div>
                  <h3>No hay asignaciones {activeTab !== 'todas' ? `en estado ${activeTab}` : ''}</h3>
                  <p>Cuando se creen nuevas asignaciones, aparecerán aquí.</p>
                </div>
              ) : (
                <div
                  style={{
                    ...styles.tableContainer,
                    ...(isMobile ? styles.tableContainerMobile : {}),
                  }}
                >
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        {['Fecha', 'Operador', 'Equipo', 'Actividad', 'Solicitado por', 'Lugar', 'Estado', 'Inicio', 'Fin', 'Duración', 'Notas'].map((t) => (
                          <th key={t} style={styles.th}>{t}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {assignmentsFiltered.map((a) => {
                        const statusConfig = getStatusConfig(a.status);
                        return (
                          <tr key={a.id} style={styles.tr}>
                            <td style={styles.td}>
                              <div style={styles.dateCell}>{formatDate(a.createdAt)}</div>
                            </td>
                            <td style={styles.td}>
                              <div style={styles.operatorCell}>
                                <span style={styles.operatorName}>{operatorMap[a.operatorId] || '-'}</span>
                              </div>
                            </td>
                            <td style={styles.td}>
                              <div style={styles.equipmentCell}>{equipmentMap[a.equipmentId] || '-'}</div>
                            </td>
                            <td style={styles.td}>
                              <div style={styles.activityCell}>{a.activity}</div>
                            </td>
                            <td style={styles.td}>
                              <div style={styles.solicitadoCell}>
                                <span style={styles.solicitadoText}>{a.solicitadoPor || '-'}</span>
                              </div>
                            </td>
                            <td style={styles.td}>
                              <div style={styles.locationCell}>📍 {a.location}</div>
                            </td>
                            <td style={styles.td}>
                              <div style={{
                                ...styles.statusBadge,
                                backgroundColor: statusConfig.bgColor,
                                color: statusConfig.color
                              }}>
                                {statusConfig.icon} {statusConfig.label}
                              </div>
                            </td>
                            <td style={styles.td}>
                              <div style={styles.timeCell}>{formatTime(a.startTime)}</div>
                            </td>
                            <td style={styles.td}>
                              <div style={styles.timeCell}>{formatTime(a.endTime)}</div>
                            </td>
                            <td style={styles.td}>
                              <div style={styles.durationCell}>{formatDuration(a.durationMinutes)}</div>
                            </td>
                            <td style={styles.td}>
                              <div style={styles.notesCell}>
                                {a.evidences?.length > 0 ? (
                                  <div style={styles.evidences}>
                                    {a.evidences.slice(0, 2).map((ev, i) => (
                                      <div key={i} style={styles.evidenceItem}>
                                        {ev.type === 'photo' ? (
                                          <img src={ev.url} alt="Evidencia" style={styles.evidenceImage} />
                                        ) : ev.type === 'audio' ? (
                                          <audio controls src={ev.url} style={styles.audioPlayer} />
                                        ) : (
                                          <div style={styles.textEvidence}>📝 {ev.content.substring(0, 30)}...</div>
                                        )}
                                      </div>
                                    ))}
                                    {a.evidences.length > 2 && (
                                      <div style={styles.moreEvidences}>+{a.evidences.length - 2} más</div>
                                    )}
                                  </div>
                                ) : (
                                  <span style={styles.noEvidence}>—</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        );

      case 'gestion':
        return <ManageAssignments />;

      case 'equipos':
        return <WeeklyAssignments />;

      case 'catalogos':
        return <ManageBasicData />;
        
      case 'admins':          // 👈 NUEVO
        return <ManageAdmins />;

      case 'historial':
        return (
          <div style={{ ...styles.card, ...(isMobile ? styles.cardMobile : {}) }}>
            <div style={{ ...styles.cardHeader, ...(isMobile ? styles.cardHeaderMobile : {}) }}>
              <div>
                <h2 style={styles.cardTitle}>📊 Historial</h2>
                <p style={styles.cardSubtitle}>
                  Filtros avanzados para análisis de datos históricos
                </p>
              </div>
              <button
                onClick={() => setActiveTab('nueva')}
                style={styles.btnVolver}
              >
                ← Volver al Panel
              </button>
            </div>
            <HistorialPage />
          </div>
        );

      default:
        return null;
    }
  };

  // ---------- UI ----------
  return (
    <main style={{ ...styles.page, ...(isMobile ? styles.pageMobile : {}) }}>
      <div style={{ ...styles.container, ...(isMobile ? styles.containerMobile : {}) }}>

        {/* Header Moderno */}
        <header style={{ ...styles.header, ...(isMobile ? styles.headerMobile : {}) }}>
          <div>
            <h1 style={styles.title}>🚀 Panel de Control</h1>
            <p style={styles.subtitle}>Gestión integral de operadores, equipos y asignaciones</p>
          </div>
          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <div style={styles.statNumber}>{stats.total}</div>
              <div style={styles.statLabel}>Total</div>
            </div>
            <div style={{ ...styles.statCard, borderLeft: '3px solid #f59e0b' }}>
              <div style={styles.statNumber}>{stats.pendientes}</div>
              <div style={styles.statLabel}>Pendientes</div>
            </div>
            <div style={{ ...styles.statCard, borderLeft: '3px solid #10b981' }}>
              <div style={styles.statNumber}>{stats.enProgreso}</div>
              <div style={styles.statLabel}>En Progreso</div>
            </div>
            <div style={{ ...styles.statCard, borderLeft: '3px solid #ef4444' }}>
              <div style={styles.statNumber}>{stats.pausadas}</div>
              <div style={styles.statLabel}>Pausadas</div>
            </div>
          </div>
        </header>

        {/* Navegación Principal */}
        <nav style={{ ...styles.mainNav, ...(isMobile ? styles.mainNavMobile : {}) }}>
          {[
            { id: 'nueva', label: '➕ Asignaciones' },
            { id: 'gestion', label: '📋 Gestionar Asignaciones' },
            { id: 'equipos', label: '🚜 Asignación de Equipos' },
            { id: 'catalogos', label: '👥 Crear Operadores/Equipos' },
            { id: 'admins', label: '🛡️ Administradores' }, // 👈 NUEVO
            { id: 'historial', label: '📊 Historial' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                ...styles.navTab,
                ...(activeTab === tab.id ? styles.navTabActive : {}),
                ...(isMobile ? styles.navTabMobile : {}),
              }}
            >
              <span style={styles.navLabel}>{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* Contenido de la Tab Activa */}
        {renderTabContent()}

      </div>
    </main>
  );
}

// ---------- ESTILOS MODERNOS ----------
const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '24px',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  pageMobile: {
    padding: '12px',
  },
  container: {
    maxWidth: '1400px',
    margin: '0 auto',
  },
  containerMobile: {
    maxWidth: '100%',
  },
  header: {
    marginBottom: '32px',
  },
  headerMobile: {
    marginBottom: '20px',
  },
  title: {
    fontSize: '2.5rem',
    fontWeight: '800',
    color: 'white',
    margin: '0 0 8px 0',
    background: 'linear-gradient(45deg, #fff, #f0f0f0)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  subtitle: {
    fontSize: '1.1rem',
    color: 'rgba(255,255,255,0.8)',
    margin: '0',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginTop: '24px',
  },
  statCard: {
    background: 'rgba(255,255,255,0.1)',
    backdropFilter: 'blur(10px)',
    padding: '20px',
    borderRadius: '16px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid rgba(255,255,255,0.2)',
    textAlign: 'center',
  },
  statNumber: {
    fontSize: '2rem',
    fontWeight: '800',
    color: 'white',
    lineHeight: '1',
    marginBottom: '4px',
  },
  statLabel: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },
  mainNav: {
    display: 'flex',
    background: 'white',
    padding: '12px',
    borderRadius: '16px',
    marginBottom: '24px',
    gap: '8px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
    flexWrap: 'wrap',
  },
  mainNavMobile: {
    flexDirection: 'column',
  },
  navTab: {
    flex: '1',
    padding: '16px 20px',
    border: 'none',
    background: 'transparent',
    borderRadius: '12px',
    fontSize: '0.875rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#6b7280',
    minWidth: '200px',
  },
  navTabMobile: {
    minWidth: '100%',
    width: '100%',
  },
  navTabActive: {
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    color: 'white',
    boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
    transform: 'translateY(-2px)',
  },
  navLabel: {
    textAlign: 'center',
    lineHeight: '1.2',
  },
  card: {
    background: 'white',
    padding: '28px',
    borderRadius: '20px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
    marginBottom: '24px',
    backdropFilter: 'blur(10px)',
  },
  cardMobile: {
    padding: '20px',
    borderRadius: '16px',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
  },
  cardHeaderMobile: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '12px',
  },
  cardTitle: {
    fontSize: '1.5rem',
    fontWeight: '700',
    color: '#1f2937',
    margin: '0',
  },
  cardSubtitle: {
    fontSize: '0.875rem',
    color: '#6b7280',
    margin: '4px 0 0 0',
  },
  cardBadge: {
    background: 'linear-gradient(135deg, #10b981, #059669)',
    color: 'white',
    padding: '6px 12px',
    borderRadius: '20px',
    fontSize: '0.75rem',
    fontWeight: '600',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '20px',
  },
  formGridMobile: {
    gridTemplateColumns: '1fr',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
  },
  label: {
    fontSize: '0.875rem',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '8px',
  },
  input: {
    padding: '14px 16px',
    borderRadius: '12px',
    border: '2px solid #e5e7eb',
    fontSize: '0.875rem',
    transition: 'all 0.2s ease',
    backgroundColor: 'white',
  },
  select: {
    padding: '14px 16px',
    borderRadius: '12px',
    border: '2px solid #e5e7eb',
    fontSize: '0.875rem',
    transition: 'all 0.2s ease',
    backgroundColor: 'white',
  },
  formActions: {
    gridColumn: '1 / -1',
    textAlign: 'right',
    marginTop: '8px',
  },
  formActionsMobile: {
    marginTop: '16px',
  },
  btnPrimary: {
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    color: 'white',
    border: 'none',
    padding: '14px 28px',
    borderRadius: '12px',
    fontSize: '0.875rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
  },
  autoAssigned: {
    fontSize: '0.75rem',
    color: '#059669',
    marginTop: '4px',
    fontStyle: 'italic',
  },
  panelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '24px',
    flexWrap: 'wrap',
    gap: '16px',
  },
  panelHeaderMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  controls: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
  },
  controlsMobile: {
    width: '100%',
    justifyContent: 'flex-start',
  },
  filters: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
  },
  filtersMobile: {
    flexWrap: 'wrap',
    width: '100%',
  },
  dateInput: {
    padding: '10px 12px',
    borderRadius: '8px',
    border: '2px solid #e5e7eb',
    fontSize: '0.875rem',
  },
  btnExport: {
    background: 'linear-gradient(135deg, #059669, #047857)',
    color: 'white',
    border: 'none',
    padding: '10px 16px',
    borderRadius: '8px',
    fontSize: '0.875rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  // 🔹 NUEVO: Estilo para botón de email
  btnEmail: {
    background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
    color: 'white',
    border: 'none',
    padding: '10px 16px',
    borderRadius: '8px',
    fontSize: '0.875rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  tabs: {
    display: 'flex',
    background: '#f8fafc',
    padding: '8px',
    borderRadius: '12px',
    marginBottom: '24px',
    gap: '4px',
    overflowX: 'auto',
  },
  tab: {
    flex: '1',
    padding: '12px 16px',
    border: 'none',
    background: 'transparent',
    borderRadius: '8px',
    fontSize: '0.875rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    color: '#6b7280',
    whiteSpace: 'nowrap',
  },
  tabActive: {
    background: 'white',
    color: '#1f2937',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  tabCount: {
    background: '#e5e7eb',
    color: '#374151',
    padding: '2px 8px',
    borderRadius: '12px',
    fontSize: '0.75rem',
    fontWeight: '600',
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '60px 20px',
    color: '#6b7280',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #e5e7eb',
    borderLeft: '4px solid #667eea',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginBottom: '16px',
  },
  emptyState: {
    textAlign: 'center',
    padding: '80px 20px',
    color: '#6b7280',
  },
  emptyIcon: {
    fontSize: '4rem',
    marginBottom: '16px',
    opacity: '0.5',
  },
  tableContainer: {
    overflowX: 'auto',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
  },
  tableContainerMobile: {
    maxWidth: '100vw',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.875rem',
    minWidth: '1200px',
  },
  th: {
    textAlign: 'left',
    padding: '16px',
    background: '#f8fafc',
    color: '#374151',
    fontWeight: '600',
    borderBottom: '1px solid #e5e7eb',
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  tr: {
    transition: 'background-color 0.2s ease',
    borderBottom: '1px solid #f3f4f6',
  },
  td: {
    padding: '16px',
    verticalAlign: 'top',
    color: '#1f2937',
  },
  dateCell: {
    fontSize: '0.75rem',
    color: '#6b7280',
    fontWeight: '500',
  },
  operatorCell: {
    display: 'flex',
    flexDirection: 'column',
  },
  operatorName: {
    fontWeight: '600',
    color: '#1f2937',
  },
  equipmentCell: {
    color: '#374151',
    fontWeight: '500',
  },
  activityCell: {
    fontWeight: '600',
    color: '#1f2937',
  },
  solicitadoCell: {
    maxWidth: '150px',
  },
  solicitadoText: {
    fontSize: '0.875rem',
    color: '#4b5563',
    fontWeight: '500',
  },
  locationCell: {
    color: '#6b7280',
    fontSize: '0.75rem',
  },
  statusBadge: {
    padding: '6px 12px',
    borderRadius: '20px',
    fontSize: '0.75rem',
    fontWeight: '600',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    whiteSpace: 'nowrap',
  },
  timeCell: {
    fontSize: '0.75rem',
    color: '#6b7280',
    fontWeight: '500',
  },
  durationCell: {
    fontSize: '0.75rem',
    color: '#059669',
    fontWeight: '600',
  },
  notesCell: {
    maxWidth: '200px',
  },
  evidences: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  evidenceItem: {
    display: 'flex',
    alignItems: 'center',
  },
  evidenceImage: {
    width: '40px',
    height: '40px',
    borderRadius: '8px',
    objectFit: 'cover',
  },
  audioPlayer: {
    width: '120px',
    height: '32px',
  },
  textEvidence: {
    background: '#f3f4f6',
    padding: '6px 8px',
    borderRadius: '6px',
    fontSize: '0.75rem',
    color: '#374151',
  },
  moreEvidences: {
    fontSize: '0.75rem',
    color: '#6b7280',
    fontStyle: 'italic',
  },
  noEvidence: {
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  error: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#dc2626',
    padding: '12px 16px',
    borderRadius: '12px',
    marginBottom: '16px',
    fontSize: '0.875rem',
  },
  btnVolver: {
    background: '#6b7280',
    color: 'white',
    border: 'none',
    padding: '10px 16px',
    borderRadius: '8px',
    fontSize: '0.875rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    whiteSpace: 'nowrap'
  }
};