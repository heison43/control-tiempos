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
  doc,
  updateDoc,
} from 'firebase/firestore';
import WeeklyAssignments from '../admin/WeeklyAssignments';
import ManageBasicData from '../admin/ManageBasicData';
import ManageAssignments from '../admin/ManageAssignments';
import HistorialPage from '../historial/page';
import ManageAdmins from '../admin/ManageAdmins';
import ManageEquipmentLoans from '../admin/ManageEquipmentLoans';
// ✅ cambia esta línea en src/app/admin/page.js
import { useIsMobile } from '../../hooks/useIsMobile'

import NotificationsManager from '../../components/NotificationsManager'





export default function AdminPanel() {
  const [operators, setOperators] = useState([]);
const [equipment, setEquipment] = useState([]);
const [weeklyAssignments, setWeeklyAssignments] = useState([]);

// 🔹 Ahora soportamos selección múltiple de operadores
const [selectedOperators, setSelectedOperators] = useState([]);

// Equipo manual (solo se usa cuando hay 1 operador seleccionado)
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
  const [cedulaSolicitante, setCedulaSolicitante] = useState('');
  const [centroCosto, setCentroCosto] = useState('');
  const [telefonoSolicitante, setTelefonoSolicitante] = useState('');
  const [areaSolicitante, setAreaSolicitante] = useState('');


    const [linkedRequest, setLinkedRequest] = useState(null); // solicitud usada para crear asignación

  // paginación de la tabla de asignaciones
  const [pageSize, setPageSize] = useState(20); // filas por página (5,10,20,30,50)
  const [currentPage, setCurrentPage] = useState(1);


  // vínculo opcional con la solicitud pública usada para crear la asignación
  const [linkedRequestId, setLinkedRequestId] = useState(null);
  const [linkedRequestCreatedAt, setLinkedRequestCreatedAt] = useState(null);



  // solicitudes públicas
  const [requests, setRequests] = useState([]);
  const [requestFilter, setRequestFilter] = useState('pending'); // pending | approved | rejected | all
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const [updatingRequestId, setUpdatingRequestId] = useState(null);

  // detectar móvil
    const isMobile = useIsMobile(); // 👈 ahora viene del hook


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

    const qReq = query(
      collection(db, 'assignmentRequests'),
      orderBy('createdAt', 'desc')
    );
    const unsubRequests = onSnapshot(qReq, (snap) => {
      setRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubOps();
      unsubEquip();
      unsubWeekly();
      unsubAssign();
      unsubRequests();
    };
  }, []);

  // ---------- Mapas ----------
  const operatorMap = useMemo(() => {
    const m = {};
    operators.forEach((o) => {
      m[o.id] = `${o.name || 'Sin nombre'}${o.codigo ? ` (${o.codigo})` : ''}`;
    });
    return m;
  }, [operators]);

  const equipmentMap = useMemo(() => {
    const m = {};
    equipment.forEach((e) => {
      m[e.id] = `${e.name || 'Equipo'}${e.codigo ? ` (${e.codigo})` : ''}`;
    });
    return m;
  }, [equipment]);

  // ---------- Filtro por rango de fechas y estado ----------
    // ---------- Filtro por rango de fechas y estado ----------
  const assignmentsFiltered = useMemo(() => {
    let filtered = assignments;

    if (
  activeTab !== 'todas' &&
  activeTab !== 'nueva' &&
  activeTab !== 'gestion' &&
  activeTab !== 'equipos' &&
  activeTab !== 'prestamos' &&      //  NUEVO
  activeTab !== 'catalogos' &&
  activeTab !== 'solicitudes' &&
  activeTab !== 'admins' &&
  activeTab !== 'historial'
) {
  filtered = filtered.filter((a) => a.status === activeTab);
}


    if (startDate || endDate) {
      const start = startDate
        ? new Date(`${startDate}T00:00:00-05:00`)
        : new Date('1900-01-01');
      const end = endDate
        ? new Date(`${endDate}T23:59:59-05:00`)
        : new Date('2999-12-31');

      filtered = filtered.filter((a) => {
        if (!a.createdAt?.toDate) return false;
        const dt = a.createdAt.toDate();
        const local = new Date(
          dt.toLocaleString('en-US', { timeZone: 'America/Bogota' })
        );
        return local >= start && local <= end;
      });
    }

    return filtered;
  }, [assignments, activeTab, startDate, endDate]);

  // ---------- Paginación de la tabla de asignaciones ----------
  // Reiniciar a página 1 cuando cambian filtros o pestaña
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, startDate, endDate]);

  // Asignaciones paginadas
  const paginatedAssignments = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return assignmentsFiltered.slice(startIndex, startIndex + pageSize);
  }, [assignmentsFiltered, currentPage, pageSize]);

  const totalPages = useMemo(
    () =>
      assignmentsFiltered.length === 0
        ? 1
        : Math.ceil(assignmentsFiltered.length / pageSize),
    [assignmentsFiltered.length, pageSize]
  );

  // ---------- Estadísticas ----------
  const stats = useMemo(
    () => ({
      total: assignments.length,
      pendientes: assignments.filter((a) => a.status === 'pendiente').length,
      enProgreso: assignments.filter((a) => a.status === 'en_progreso').length,
      pausadas: assignments.filter((a) => a.status === 'pausado').length,
      finalizadas: assignments.filter((a) => a.status === 'finalizado').length,
    }),
    [assignments]
  );

  // ---------- Solicitudes públicas: filtros y selección ----------
  const filteredRequests = useMemo(
    () =>
      requests.filter((r) =>
        requestFilter === 'all' ? true : r.status === requestFilter
      ),
    [requests, requestFilter]
  );

  const selectedRequest = useMemo(
    () =>
      filteredRequests.find((r) => r.id === selectedRequestId) ||
      filteredRequests[0] ||
      null,
    [filteredRequests, selectedRequestId]
  );

    // ---------- Mapa: cuántas asignaciones tiene cada solicitud ----------
  const requestAssignmentInfo = useMemo(() => {
    const map = {};

    assignments.forEach((a) => {
      if (a.linkedRequestId) {
        map[a.linkedRequestId] = (map[a.linkedRequestId] || 0) + 1;
      }
    });

    return map;
  }, [assignments]);


    // ---------- Estadísticas de solicitudes ----------
  const requestStats = useMemo(
    () => ({
      total: requests.length,
      pending: requests.filter((r) => r.status === 'pending').length,
      approved: requests.filter((r) => r.status === 'approved').length,
      rejected: requests.filter((r) => r.status === 'rejected').length,
    }),
    [requests]
  );

  // ---------- Exportar CSV de solicitudes ----------
  const buildCsvFromRequests = (list) => {
    const header = [
  'Código',
  'Fecha creación',
  'Estado',
  'Solicitante',
  'Documento',
  'Teléfono',          //  NUEVO
  'Área',
  'Centro de costos',
  'Lugar',
  'Actividad',
  'Mensaje respuesta',
];


    const rows = list.map((r) => {
      const createdStr = r.createdAt?.toDate
        ? r.createdAt
            .toDate()
            .toLocaleString('es-CO', { timeZone: 'America/Bogota' })
        : '';

          return [
  r.trackingCode || r.code || '',
  createdStr,
  r.status || 'pending',
  r.requesterName || '',
  r.requesterId || '',
  r.contactPhone || '',                             //  NUEVO
  r.requesterArea || r.area || '',
  r.costCenter || '',
  r.location || '',
  r.activity || '',
  r.responseMessage || '',
];


    });

    return [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'))
      .join('\n');
  };

  const handleExportRequestsCSV = () => {
    if (!filteredRequests.length) {
      alert('No hay solicitudes para exportar con el filtro actual.');
      return;
    }

    try {
      const csvContent = buildCsvFromRequests(filteredRequests);
      const fileName = `solicitudes_${new Date()
        .toLocaleDateString('es-CO')
        .replace(/\//g, '-')}.csv`;

      const blob = new Blob([csvContent], {
        type: 'text/csv;charset=utf-8;',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);

      alert('✅ Solicitudes exportadas exitosamente');
    } catch (err) {
      console.error('Error al exportar solicitudes:', err);
      alert('⚠️ Error al exportar las solicitudes.');
    }
  };


  const handleChangeRequestStatus = async (req, newStatus) => {
    const actionLabel = newStatus === 'approved' ? 'aprobar' : 'rechazar';

    let defaultMsg =
      newStatus === 'approved'
        ? 'Solicitud aprobada. Se programará la asignación del equipo.'
        : 'Solicitud rechazada.';

    const msg = window.prompt(
      `Escribe un mensaje para el solicitante (${actionLabel}):`,
      defaultMsg
    );
    if (msg === null) return;

    try {
      setUpdatingRequestId(req.id);
      const ref = doc(db, 'assignmentRequests', req.id);
      await updateDoc(ref, {
        status: newStatus,
        responseMessage: msg || defaultMsg,
        processedAt: serverTimestamp(),
      });
    } catch (e) {
      console.error('Error actualizando solicitud:', e);
      alert('No fue posible actualizar la solicitud. Intenta de nuevo.');
    } finally {
      setUpdatingRequestId(null);
    }
  };

      const handleUseRequestToCreateAssignment = (req) => {
  // Nombre del solicitante
  setSolicitadoPor(req.requesterName || '');

  // Actividad y lugar
  setActivity(req.activity || '');
  setLocation(req.location || '');

  // Cédula, centro de costo, teléfono y área desde la solicitud
  setCedulaSolicitante(req.requesterId || '');
  setCentroCosto(req.costCenter || '');
  setTelefonoSolicitante(req.contactPhone || '');
  setAreaSolicitante(req.requesterArea || req.area || '');

  // Guardar datos de la solicitud para enlazarla a la asignación
  setLinkedRequest({
    id: req.id,
    code: req.trackingCode || req.code || null,
    createdAt: req.createdAt || null,
  });

  // Cambiar a la pestaña de Asignación Rápida
  setActiveTab('nueva');
};



  // ---------- Lógica Operador → Equipo ----------
// Si hay SOLO 1 operador seleccionado, autollenamos su equipo.
// Con 0 o más de 1 operadores, limpiamos el equipo manual
// (en ese caso se usará el equipo asignado a cada operador al crear las asignaciones).
useEffect(() => {
  if (selectedOperators.length !== 1) {
    setSelectedEquipment('');
    return;
  }

  const operadorId = selectedOperators[0];
  const hoy = new Date();

  const asignacionActiva = weeklyAssignments.find((a) => {
    const desde = a.fechaInicio?.toDate
      ? a.fechaInicio.toDate()
      : new Date(a.fechaInicio);
    const hasta = a.fechaFin?.toDate
      ? a.fechaFin.toDate()
      : new Date(a.fechaFin);

    return (
      a.operadorId === operadorId &&
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
}, [selectedOperators, weeklyAssignments]);


  // ---------- Equipos disponibles ----------
  const equiposDisponibles = equipment.filter((eq) => {
    const hoy = new Date();
    const ocupado = weeklyAssignments.some((a) => {
      const desde = a.fechaInicio?.toDate
        ? a.fechaInicio.toDate()
        : new Date(a.fechaInicio);
      const hasta = a.fechaFin?.toDate
        ? a.fechaFin.toDate()
        : new Date(a.fechaFin);
      return (
        hoy >= desde && hoy <= hasta && a.equipoId === eq.id && a.estado === 'activo'
      );
    });
    return !ocupado;
  });

  // ---------- Cambio de operadores seleccionados (select múltiple) ----------
const handleOperatorSelectChange = (e) => {
  const selected = Array.from(e.target.selectedOptions).map((opt) => opt.value);
  setSelectedOperators(selected);
};


    // ---------- Crear asignación (multi-operador) ----------
  const handleCreateAssignment = async (e) => {
    e.preventDefault();
    setError('');

    if (
      selectedOperators.length === 0 ||
      !activity.trim() ||
      !location.trim() ||
      !solicitadoPor.trim()
    ) {
      setError(
        'Selecciona al menos un operador y completa actividad, lugar y solicitado por.'
      );
      return;
    }

    if (selectedOperators.length > 3) {
      setError('Máximo 3 operadores por asignación rápida.');
      return;
    }

    try {
      const createdIds = [];

      for (const operadorId of selectedOperators) {
        // Para cada operador determinamos el equipo que le corresponde:

        let finalEquipmentId = null;

        // Caso 1: solo hay un operador y el admin eligió equipo manual
        if (selectedOperators.length === 1 && selectedEquipment) {
          finalEquipmentId = selectedEquipment;
        } else {
          // Caso 2: varios operadores (o uno sin equipo manual) →
          // buscamos su equipo según la programación semanal
          const hoy = new Date();
          const asignacionActiva = weeklyAssignments.find((a) => {
            const desde = a.fechaInicio?.toDate
              ? a.fechaInicio.toDate()
              : new Date(a.fechaInicio);
            const hasta = a.fechaFin?.toDate
              ? a.fechaFin.toDate()
              : new Date(a.fechaFin);

            return (
              a.operadorId === operadorId &&
              hoy >= desde &&
              hoy <= hasta &&
              a.estado === 'activo'
            );
          });

          finalEquipmentId = asignacionActiva ? asignacionActiva.equipoId : null;
        }

        // Timestamp de creación (cada asignación tendrá su propio serverTimestamp)
        const nowTs = serverTimestamp();

        const data = {
          operatorId: operadorId,
          equipmentId: finalEquipmentId,
          activity: activity.trim(),
          location: location.trim(),
          solicitadoPor: solicitadoPor.trim(),
          cedulaSolicitante: cedulaSolicitante.trim() || null,
          centroCosto: centroCosto.trim() || null,
          telefonoSolicitante: telefonoSolicitante.trim() || null,
          areaSolicitante: areaSolicitante.trim() || null,
          status: 'pendiente',
          createdAt: nowTs,
          startTime: null,
          endTime: null,
          durationMinutes: null,
          evidences: [],
        };

        // Enlace con la solicitud pública (si viene desde "Usar para crear asignación")
        if (linkedRequest) {
          data.linkedRequestId = linkedRequest.id;
          data.requestCode = linkedRequest.code || null;
          data.requestCreatedAt = linkedRequest.createdAt || null;
        } else {
          data.linkedRequestId = null;
          data.requestCode = null;
          data.requestCreatedAt = nowTs;
        }

        const createdRef = await addDoc(collection(db, 'assignments'), data);
        createdIds.push(createdRef.id);

        // 🔔 NUEVO: notificar al operador que se creó una asignación para él
        try {
          const op = operators.find((o) => o.id === operadorId);
          const operatorName =
            op?.name || operatorMap[operadorId] || 'Operador';

          await fetch('/api/notify-operator-new-assignment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              assignmentId: createdRef.id,
              // 👇 este nombre debe coincidir con el campo que guardas en operatorPushTokens
              operatorId: operadorId,
              operatorName,
              activity: data.activity,
              location: data.location,
            }),
          });
        } catch (pushErr) {
          console.error(
            '[PUSH OP] Error llamando a notify-operator-new-assignment:',
            pushErr
          );
          // No rompemos la creación de la asignación si falla el push
        }
      }

      console.log('✅ Asignaciones creadas:', createdIds);

      // Limpiar formulario después de crear todas
      setActivity('');
      setLocation('');
      setSolicitadoPor('');
      setCedulaSolicitante('');
      setCentroCosto('');
      setTelefonoSolicitante('');
      setAreaSolicitante('');
      setSelectedOperators([]);   // 👈 limpio array
      setSelectedEquipment('');
      setLinkedRequest(null);
    } catch (err) {
      console.error('Error creando asignaciones:', err);
      setError('No se pudo crear la asignación. Intenta de nuevo.');
    }
  };






  // ---------- Exportar CSV ----------
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
      const opName = operatorMap[a.operatorId] || a.operatorId || '';
      const eqName = equipmentMap[a.equipmentId] || a.equipmentId || '';

      // timestamp de solicitud: si no existe, usamos createdAt
      const reqTs = a.requestCreatedAt?.toDate
        ? a.requestCreatedAt.toDate()
        : a.createdAt?.toDate
        ? a.createdAt.toDate()
        : null;

      const createdTs = a.createdAt?.toDate ? a.createdAt.toDate() : null;

      const reqDateStr = reqTs
        ? reqTs.toLocaleDateString('es-CO', {
            timeZone: 'America/Bogota',
          })
        : '';
      const reqTimeStr = reqTs
        ? reqTs.toLocaleTimeString('es-CO', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'America/Bogota',
          })
        : '';

      const createdDateStr = createdTs
        ? createdTs.toLocaleDateString('es-CO', {
            timeZone: 'America/Bogota',
          })
        : '';
      const createdTimeStr = createdTs
        ? createdTs.toLocaleTimeString('es-CO', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'America/Bogota',
          })
        : '';

      const startStr = a.startTime?.toDate
        ? a.startTime
            .toDate()
            .toLocaleTimeString('es-CO', {
              hour: '2-digit',
              minute: '2-digit',
              timeZone: 'America/Bogota',
            })
        : '';
      const endStr = a.endTime?.toDate
        ? a.endTime
            .toDate()
            .toLocaleTimeString('es-CO', {
              hour: '2-digit',
              minute: '2-digit',
              timeZone: 'America/Bogota',
            })
        : '';

      const evidences =
        a.evidences && Array.isArray(a.evidences)
          ? a.evidences
              .map((ev) => (ev.type === 'text' ? ev.content : ev.url))
              .join(' | ')
          : '';

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
  a.durationMinutes ?? '',
  evidences,
];

    });

    return [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'))
      .join('\n');
  };



  const handleExportCSV = () => {
    if (assignmentsFiltered.length === 0) {
      alert('No hay asignaciones para exportar.');
      return;
    }

    try {
      const csvContent = buildCsvFromAssignments(assignmentsFiltered);
      const fileName = `asignaciones_${new Date()
        .toLocaleDateString('es-CO')
        .replace(/\//g, '-')}.csv`;

      const blob = new Blob([csvContent], {
        type: 'text/csv;charset=utf-8;',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);

      alert('✅ CSV exportado exitosamente');
    } catch (err) {
      console.error('Error al exportar:', err);
      alert('⚠️ Error al exportar el archivo.');
    }
  };

  // ---------- Enviar por correo ----------
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
          alert('✅ Reporte enviado por correo exitosamente');
        }
      } else {
        console.error(`❌ Error enviando correo ${type}:`, result.error);
        if (type === 'manual') {
          alert(
            '❌ Error enviando por correo: ' +
              (result.error || 'Error desconocido')
          );
        }
      }
    } catch (error) {
      console.error(`❌ Error en envío de correo ${type}:`, error);
      if (type === 'manual') {
        alert(
          '❌ Error de conexión al enviar correo: ' +
            (error && error.message ? error.message : '')
        );
      }
    }
  };

  const handleSendEmail = async () => {
    if (assignmentsFiltered.length === 0) {
      alert('No hay asignaciones para enviar por correo.');
      return;
    }

    try {
      const csvContent = buildCsvFromAssignments(assignmentsFiltered);
      const fileName = `asignaciones_${new Date()
        .toLocaleDateString('es-CO')
        .replace(/\//g, '-')}.csv`;

      await sendEmailWithAttachment(fileName, csvContent, 'manual');
    } catch (err) {
      console.error('Error al enviar por correo:', err);
      alert('⚠️ Error al enviar por correo.');
    }
  };

  // ---------- Envío Automático Diario ----------
  useEffect(() => {
    const sendDailyEmail = async () => {
      try {
        const today = new Date();
        const startOfDay = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
          0,
          0,
          0
        );
        const endOfDay = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
          23,
          59,
          59
        );

        const dailyAssignments = assignments.filter((a) => {
          if (!a.createdAt?.toDate) return false;
          const assignmentDate = a.createdAt.toDate();
          return assignmentDate >= startOfDay && assignmentDate <= endOfDay;
        });

        if (dailyAssignments.length === 0) {
          console.log('📭 No hay asignaciones para enviar hoy');
          return;
        }

        const csvContent = buildCsvFromAssignments(dailyAssignments);
        const fileName = `reporte_diario_${today
          .toLocaleDateString('es-CO')
          .replace(/\//g, '-')}.csv`;

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

      if (now > targetTime) {
        targetTime.setDate(targetTime.getDate() + 1);
      }

      const timeUntilTarget = targetTime.getTime() - now.getTime();
      console.log(`⏰ Próximo envío automático programado para: ${targetTime}`);

      const initialTimer = setTimeout(() => {
        sendDailyEmail();
        setInterval(sendDailyEmail, 24 * 60 * 60 * 1000);
      }, timeUntilTarget);

      return initialTimer;
    };

    if (typeof window !== 'undefined') {
      const timerId = setupDailyEmail();
      return () => clearTimeout(timerId);
    }
  }, [assignments, operatorMap, equipmentMap]);

  // ---------- Helpers ----------
  const formatTime = (ts) => {
    if (!ts) return '-';
    const d = ts.toDate ? ts.toDate() : ts;
    return d.toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Bogota',
    });
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
      pendiente: {
        label: 'Pendiente',
        color: '#f59e0b',
        icon: '⏳',
        bgColor: '#fef3c7',
      },
      en_progreso: {
        label: 'En Progreso',
        color: '#10b981',
        icon: '▶️',
        bgColor: '#d1fae5',
      },
      pausado: {
        label: 'Pausado',
        color: '#ef4444',
        icon: '⏸️',
        bgColor: '#fee2e2',
      },
      finalizado: {
        label: 'Finalizado',
        color: '#6b7280',
        icon: '✅',
        bgColor: '#f3f4f6',
      },
    };
    return (
      configs[status] || {
        label: status,
        color: '#6b7280',
        icon: '📝',
        bgColor: '#f3f4f6',
      }
    );
  };

  // ---------- Render Tabs ----------
  const renderTabContent = () => {
    switch (activeTab) {
      case 'nueva':
        return (
          <>
            {/* Nueva asignación */}
            <section
              style={{ ...styles.card, ...(isMobile ? styles.cardMobile : {}) }}
            >
              <div
                style={{
                  ...styles.cardHeader,
                  ...(isMobile ? styles.cardHeaderMobile : {}),
                }}
              >
                <h2 style={styles.cardTitle}>➕ Crear Asignación Rápida</h2>
                <div style={styles.cardBadge}>Diaria</div>
              </div>

              {error && <div style={styles.error}>{error}</div>}

              <form
                onSubmit={handleCreateAssignment}
                style={{
                  ...styles.formGrid,
                  ...(isMobile ? styles.formGridMobile : {}),
                }}
              >
                <div style={styles.formGroup}>
  <label style={styles.label}>👤 Operador(es) *</label>
  <select
    multiple
    value={selectedOperators}
    onChange={handleOperatorSelectChange}
    style={{ ...styles.select, height: '110px' }}
    required
  >
    {operators.map((op) => (
      <option key={op.id} value={op.id}>
        {op.name} {op.codigo ? `(${op.codigo})` : ''}
      </option>
    ))}
  </select>
  <p
    style={{
      fontSize: '0.75rem',
      color: '#6b7280',
      marginTop: '4px',
    }}
  >
    Puedes seleccionar 1, 2 o hasta 3 operadores (Ctrl + clic / Shift + clic).
  </p>
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
  <label style={styles.label}>🪪 Cédula solicitante</label>
  <input
    type="text"
    value={cedulaSolicitante}
    onChange={(e) => setCedulaSolicitante(e.target.value)}
    placeholder="Ej: 123456789"
    style={styles.input}
  />
</div>

<div style={styles.formGroup}>
  <label style={styles.label}>📞 Teléfono solicitante</label>
  <input
    type="text"
    value={telefonoSolicitante}
    onChange={(e) => setTelefonoSolicitante(e.target.value)}
    placeholder="Ej: 3001234567"
    style={styles.input}
  />
</div>

<div style={styles.formGroup}>
  <label style={styles.label}>🏷 Centro de costos</label>
  <input
    type="text"
    value={centroCosto}
    onChange={(e) => setCentroCosto(e.target.value)}
    placeholder="Ej: H016000H03"
    style={styles.input}
  />
</div>

<div style={styles.formGroup}>
  <label style={styles.label}>🏢 Área solicitante</label>
  <input
    type="text"
    value={areaSolicitante}
    onChange={(e) => setAreaSolicitante(e.target.value)}
    placeholder="Ej: Obras civiles, Mantenimiento..."
    style={styles.input}
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
    // Con más de 1 operador NO se puede elegir equipo manual.
    disabled={selectedOperators.length !== 1 || !!selectedEquipment}
  >
    <option value="">
      {selectedOperators.length > 1
        ? 'Se usará el equipo asignado a cada operador'
        : selectedEquipment
        ? 'Asignado automáticamente'
        : 'Selecciona un equipo (opcional)'}
    </option>
    {equiposDisponibles.map((eq) => (
      <option key={eq.id} value={eq.id}>
        {eq.name} {eq.codigo ? `(${eq.codigo})` : ''}
      </option>
    ))}
  </select>

  {selectedOperators.length > 1 && (
    <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '4px' }}>
      Con varios operadores se usará automáticamente el equipo asignado
      a cada uno en la programación semanal.
    </p>
  )}

  {selectedOperators.length === 1 && selectedEquipment && (
    <div style={styles.autoAssigned}>
      ✅ Equipo asignado automáticamente desde la programación semanal
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
            <section
              style={{ ...styles.card, ...(isMobile ? styles.cardMobile : {}) }}
            >
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
                  {
                    id: 'pendiente',
                    label: 'Pendientes',
                    count: stats.pendientes,
                  },
                  {
                    id: 'en_progreso',
                    label: 'En Progreso',
                    count: stats.enProgreso,
                  },
                  { id: 'pausado', label: 'Pausadas', count: stats.pausadas },
                  {
                    id: 'finalizado',
                    label: 'Finalizadas',
                    count: stats.finalizadas,
                  },
                ].map((tab) => (
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
                  <h3>
                    No hay asignaciones{' '}
                    {activeTab !== 'todas' ? `en estado ${activeTab}` : ''}
                  </h3>
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
    {[
      'Fecha solicitud',
      'Hora solicitud',
      'Fecha creación',
      'Hora creación',
      'Operador',
      'Equipo',
      'Actividad',
      'Solicitado por',
      'Teléfono',
      'Cédula',
      'Área',
      'Centro de costos',
      'Lugar',
      'Estado',
      'Código solicitud',
      'Inicio',
      'Fin',
      'Duración',
      'Notas',
    ].map((t) => (
      <th key={t} style={styles.th}>
        {t}
      </th>
    ))}
  </tr>
</thead>



                                        <tbody>
                      {paginatedAssignments.map((a) => {
                        const statusConfig = getStatusConfig(a.status);

                        // timestamp de solicitud (si no hay, usamos createdAt)
                        const requestTs = a.requestCreatedAt || a.createdAt;

                        return (
                          <tr key={a.id} style={styles.tr}>
                            {/* Fecha solicitud */}
                            <td style={styles.td}>
                              <div style={styles.dateCell}>
                                {formatDate(requestTs)}
                              </div>
                            </td>

                            {/* Hora solicitud */}
                            <td style={styles.td}>
                              <div style={styles.timeCell}>
                                {formatTime(requestTs)}
                              </div>
                            </td>

                            {/* Fecha creación */}
                            <td style={styles.td}>
                              <div style={styles.dateCell}>
                                {formatDate(a.createdAt)}
                              </div>
                            </td>

                            {/* Hora creación */}
                            <td style={styles.td}>
                              <div style={styles.timeCell}>
                                {formatTime(a.createdAt)}
                              </div>
                            </td>

                            {/* Operador */}
                            <td style={styles.td}>
                              <div style={styles.operatorCell}>
                                <span style={styles.operatorName}>
                                  {operatorMap[a.operatorId] || '-'}
                                </span>
                              </div>
                            </td>

                            {/* Equipo */}
                            <td style={styles.td}>
                              <div style={styles.equipmentCell}>
                                {equipmentMap[a.equipmentId] || '-'}
                              </div>
                            </td>

                            {/* Actividad */}
                            <td style={styles.td}>
                              <div style={styles.activityCell}>
                                {a.activity}
                              </div>
                            </td>

                            {/* Solicitado por */}
<td style={styles.td}>
  <div style={styles.solicitadoCell}>
    <span style={styles.solicitadoText}>
      {a.solicitadoPor || '-'}
    </span>
  </div>
</td>

{/* Teléfono solicitante */}
<td style={styles.td}>
  <div style={styles.solicitadoCell}>
    <span style={styles.solicitadoText}>
      {a.telefonoSolicitante || '—'}
    </span>
  </div>
</td>

{/* Cédula solicitante */}
<td style={styles.td}>
  <div style={styles.solicitadoCell}>
    <span style={styles.solicitadoText}>
      {a.cedulaSolicitante || '—'}
    </span>
  </div>
</td>

{/* Área solicitante */}
<td style={styles.td}>
  <div style={styles.solicitadoCell}>
    <span style={styles.solicitadoText}>
      {a.areaSolicitante || '—'}
    </span>
  </div>
</td>

{/* Centro de costos */}
<td style={styles.td}>
  <div style={styles.solicitadoCell}>
    <span style={styles.solicitadoText}>
      {a.centroCosto || '—'}
    </span>
  </div>
</td>


                            {/* Lugar */}
                            <td style={styles.td}>
                              <div style={styles.locationCell}>
                                📍 {a.location}
                              </div>
                            </td>

                            {/* Estado */}
                            <td style={styles.td}>
                              <div
                                style={{
                                  ...styles.statusBadge,
                                  backgroundColor: statusConfig.bgColor,
                                  color: statusConfig.color,
                                }}
                              >
                                {statusConfig.icon} {statusConfig.label}
                              </div>
                            </td>

                            {/* Código solicitud */}
                            <td style={styles.td}>
                              <div style={styles.solicitadoCell}>
                                <span style={styles.solicitadoText}>
                                  {a.requestCode || '—'}
                                </span>
                              </div>
                            </td>

                            {/* Inicio */}
                            <td style={styles.td}>
                              <div style={styles.timeCell}>
                                {formatTime(a.startTime)}
                              </div>
                            </td>

                            {/* Fin */}
                            <td style={styles.td}>
                              <div style={styles.timeCell}>
                                {formatTime(a.endTime)}
                              </div>
                            </td>

                            {/* Duración */}
                            <td style={styles.td}>
                              <div style={styles.durationCell}>
                                {formatDuration(a.durationMinutes)}
                              </div>
                            </td>

                            {/* Notas / evidencias */}
                            <td style={styles.td}>
                              <div style={styles.notesCell}>
                                {a.evidences?.length > 0 ? (
                                  <div style={styles.evidences}>
                                    {a.evidences.slice(0, 2).map((ev, i) => (
                                      <div key={i} style={styles.evidenceItem}>
                                        {ev.type === 'photo' ? (
                                          <img
                                            src={ev.url}
                                            alt="Evidencia"
                                            style={styles.evidenceImage}
                                          />
                                        ) : ev.type === 'audio' ? (
                                          <audio
                                            controls
                                            src={ev.url}
                                            style={styles.audioPlayer}
                                          />
                                        ) : (
                                          <div style={styles.textEvidence}>
                                            📝
                                            {` ${ev.content.substring(0, 30)}...`}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                    {a.evidences.length > 2 && (
                                      <div style={styles.moreEvidences}>
                                        +{a.evidences.length - 2} más
                                      </div>
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
                                      <div style={styles.paginationBar}>
                      <div style={styles.paginationInfo}>
                        {assignmentsFiltered.length === 0
                          ? 'Sin asignaciones'
                          : `Mostrando ${
                              (currentPage - 1) * pageSize +
                              1
                            } - ${Math.min(
                              currentPage * pageSize,
                              assignmentsFiltered.length
                            )} de ${assignmentsFiltered.length}`}
                      </div>

                      <div style={styles.paginationControls}>
                        <label style={styles.paginationLabel}>
                          Filas por página:{' '}
                          <select
                            value={pageSize}
                            onChange={(e) => {
                              setPageSize(Number(e.target.value));
                              setCurrentPage(1);
                            }}
                            style={styles.paginationSelect}
                          >
                            {[5, 10, 20, 30, 50].map((n) => (
                              <option key={n} value={n}>
                                {n}
                              </option>
                            ))}
                          </select>
                        </label>

                        <div style={styles.paginationButtons}>
                          <button
                            type="button"
                            onClick={() =>
                              setCurrentPage((p) => Math.max(1, p - 1))
                            }
                            disabled={currentPage === 1}
                            style={styles.paginationButton}
                          >
                            ‹
                          </button>

                          {Array.from(
                            { length: totalPages },
                            (_, i) => i + 1
                          ).map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setCurrentPage(p)}
                              style={{
                                ...styles.paginationButton,
                                ...(currentPage === p
                                  ? styles.paginationButtonActive
                                  : {}),
                              }}
                            >
                              {p}
                            </button>
                          ))}

                          <button
                            type="button"
                            onClick={() =>
                              setCurrentPage((p) =>
                                Math.min(totalPages, p + 1)
                              )
                            }
                            disabled={currentPage === totalPages}
                            style={styles.paginationButton}
                          >
                            ›
                          </button>
                        </div>
                      </div>
                    </div>


                </div>
              )}
            </section>
          </>
        );

                case 'solicitudes': {
      // cuántas asignaciones tiene la solicitud seleccionada
      const assignedCountForSelected =
        selectedRequest && requestAssignmentInfo[selectedRequest.id]
          ? requestAssignmentInfo[selectedRequest.id]
          : 0;

      return (
        <section
          style={{ ...styles.card, ...(isMobile ? styles.cardMobile : {}) }}
        >
          <div
            style={{
              ...styles.cardHeader,
              ...(isMobile ? styles.cardHeaderMobile : {}),
            }}
          >
            <div style={styles.requestHeaderLeft}>
              <h2 style={styles.cardTitle}>📨 Solicitudes de Asignación</h2>
              <p style={styles.cardSubtitle}>
                Revisa y aprueba las solicitudes enviadas desde el formulario
                público. Usa los datos para crear una nueva asignación y mantén
                trazabilidad de cada caso.
              </p>

              {/* chips de resumen */}
              <div style={styles.requestSummaryChips}>
                <div
                  style={{
                    ...styles.requestSummaryChip,
                    background: 'rgba(148,163,184,0.15)',
                    color: '#0f172a',
                  }}
                >
                  📌 Total: <strong>{requestStats.total}</strong>
                </div>
                <div
                  style={{
                    ...styles.requestSummaryChip,
                    background: 'rgba(245,158,11,0.16)',
                    color: '#b45309',
                  }}
                >
                  ⏳ Pendientes: <strong>{requestStats.pending}</strong>
                </div>
                <div
                  style={{
                    ...styles.requestSummaryChip,
                    background: 'rgba(16,185,129,0.18)',
                    color: '#047857',
                  }}
                >
                  ✅ Aprobadas: <strong>{requestStats.approved}</strong>
                </div>
                <div
                  style={{
                    ...styles.requestSummaryChip,
                    background: 'rgba(248,113,113,0.16)',
                    color: '#b91c1c',
                  }}
                >
                  ❌ Rechazadas: <strong>{requestStats.rejected}</strong>
                </div>
              </div>
            </div>

            <div style={styles.requestHeaderRight}>
              <button
                type="button"
                onClick={handleExportRequestsCSV}
                style={styles.btnExportRequests}
              >
                📥 Exportar CSV
              </button>
            </div>
          </div>

          {/* Filtros de estado */}
          <div
            style={{
              ...styles.requestFiltersBar,
              ...(isMobile ? styles.requestFiltersBarMobile : {}),
            }}
          >
            {[
              { id: 'pending', label: 'Pendientes' },
              { id: 'approved', label: 'Aprobadas' },
              { id: 'rejected', label: 'Rechazadas' },
              { id: 'all', label: 'Todas' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setRequestFilter(f.id)}
                style={{
                  ...styles.requestFilterButton,
                  ...(requestFilter === f.id
                    ? styles.requestFilterButtonActive
                    : {}),
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div
            style={{
              ...styles.requestGrid,
              ...(isMobile ? styles.requestGridMobile : {}),
            }}
          >
            {/* LISTA IZQUIERDA */}
            <div
              style={{
                ...styles.requestList,
                ...(isMobile ? styles.requestListMobile : {}),
              }}
            >
              {filteredRequests.length === 0 ? (
                <p style={styles.requestEmpty}>
                  No hay solicitudes para este filtro.
                </p>
              ) : (
                filteredRequests.map((r) => {
                  const assignedCount =
                    requestAssignmentInfo[r.id] || 0;
                  const hasAssignments = assignedCount > 0;

                  return (
                    <button
                      key={r.id}
                      onClick={() => setSelectedRequestId(r.id)}
                      style={{
                        ...styles.requestItem,
                        ...(selectedRequest &&
                        selectedRequest.id === r.id
                          ? styles.requestItemActive
                          : {}),
                      }}
                    >
                      <div style={styles.requestCode}>
                        {r.trackingCode || r.code || 'SIN-CÓDIGO'}
                      </div>

                      <div style={styles.requestName}>
                        {r.requesterName || 'Sin nombre'}
                      </div>

                      <div style={styles.requestActivity}>
                        {r.activity && r.activity.length > 60
                          ? r.activity.slice(0, 60) + '...'
                          : r.activity || 'Sin actividad'}
                      </div>

                      {/* estado de asignación */}
                      <div style={styles.requestAssignStatusRow}>
                        <span
                          style={{
                            ...styles.requestAssignStatus,
                            ...(hasAssignments
                              ? styles.requestAssignStatusAssigned
                              : styles.requestAssignStatusPending),
                          }}
                        >
                          {hasAssignments
                            ? assignedCount === 1
                              ? '1 asignación creada'
                              : `${assignedCount} asignaciones`
                            : 'Sin asignación'}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* DETALLE DERECHA */}
            <div
              style={{
                ...styles.requestDetail,
                ...(isMobile ? styles.requestDetailMobile : {}),
              }}
            >
              {selectedRequest ? (
                <>
                  <div style={styles.requestDetailHeader}>
                    <div>
                      <div style={styles.requestDetailLabel}>
                        Código de seguimiento
                      </div>
                      <div style={styles.requestDetailCode}>
                        {selectedRequest.trackingCode ||
                          selectedRequest.code ||
                          'SIN-CÓDIGO'}
                      </div>
                    </div>

                    {/* estado de la solicitud + estado de asignación */}
                    <div style={styles.requestHeaderStatusGroup}>
                      <div
                        style={styles.requestStatusPill(
                          selectedRequest.status || 'pending'
                        )}
                      >
                        {selectedRequest.status === 'approved'
                          ? 'Aprobada'
                          : selectedRequest.status === 'rejected'
                          ? 'Rechazada'
                          : 'Pendiente'}
                      </div>

                      <div
                        style={styles.requestAssignStatusPill(
                          assignedCountForSelected > 0
                        )}
                      >
                        {assignedCountForSelected > 0
                          ? assignedCountForSelected === 1
                            ? 'Asignación creada'
                            : `${assignedCountForSelected} asignaciones`
                          : 'Sin asignación'}
                      </div>
                    </div>
                  </div>

                  <div style={styles.requestDetailBody}>
                    <div>
                      <div style={styles.requestDetailItemLabel}>
                        Solicitante
                      </div>
                      <div style={styles.requestDetailItemValue}>
                        {selectedRequest.requesterName || '—'}
                        {selectedRequest.requesterId
                          ? ` • C.C. ${selectedRequest.requesterId}`
                          : ''}
                      </div>
                    </div>

                    <div>
                      <div style={styles.requestDetailItemLabel}>
                        Teléfono
                      </div>
                      <div style={styles.requestDetailItemValue}>
                        {selectedRequest.contactPhone || '—'}
                      </div>
                    </div>

                    <div>
                      <div style={styles.requestDetailItemLabel}>Área</div>
                      <div style={styles.requestDetailItemValue}>
                        {selectedRequest.requesterArea ||
                          selectedRequest.area ||
                          '—'}
                      </div>
                    </div>

                    <div>
                      <div style={styles.requestDetailItemLabel}>
                        Centro de costos
                      </div>
                      <div style={styles.requestDetailItemValue}>
                        {selectedRequest.costCenter || '—'}
                      </div>
                    </div>

                    <div>
                      <div style={styles.requestDetailItemLabel}>Lugar</div>
                      <div style={styles.requestDetailItemValue}>
                        {selectedRequest.location || '—'}
                      </div>
                    </div>

                    <div style={{ gridColumn: '1 / -1' }}>
                      <div style={styles.requestDetailItemLabel}>
                        Actividad solicitada
                      </div>
                      <div style={styles.requestDetailItemValue}>
                        {selectedRequest.activity || '—'}
                      </div>
                    </div>
                  </div>

                  {selectedRequest.responseMessage && (
                    <div style={styles.requestDetailMessageBox}>
                      <div style={styles.requestDetailItemLabel}>
                        Mensaje enviado al solicitante
                      </div>
                      <div style={styles.requestDetailItemValue}>
                        {selectedRequest.responseMessage}
                      </div>
                    </div>
                  )}

                  <div style={styles.requestDetailActions}>
                    <button
                      type="button"
                      onClick={() =>
                        handleUseRequestToCreateAssignment(selectedRequest)
                      }
                      style={styles.requestUseBtn}
                    >
                      ➕ Usar para crear asignación
                    </button>

                    {selectedRequest.status === 'pending' && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            handleChangeRequestStatus(
                              selectedRequest,
                              'approved'
                            )
                          }
                          disabled={
                            updatingRequestId === selectedRequest.id
                          }
                          style={styles.requestApproveBtn}
                        >
                          {updatingRequestId === selectedRequest.id
                            ? 'Actualizando...'
                            : '✅ Aprobar'}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleChangeRequestStatus(
                              selectedRequest,
                              'rejected'
                            )
                          }
                          disabled={
                            updatingRequestId === selectedRequest.id
                          }
                          style={styles.requestRejectBtn}
                        >
                          ❌ Rechazar
                        </button>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <p style={styles.requestEmpty}>
                  Selecciona una solicitud del listado para ver los detalles.
                </p>
              )}
            </div>
          </div>
        </section>
      );
    }


    case 'prestamos':
      return (
        <section
          style={{ ...styles.card, ...(isMobile ? styles.cardMobile : {}) }}
        >
          <div
            style={{
              ...styles.cardHeader,
              ...(isMobile ? styles.cardHeaderMobile : {}),
              marginBottom: 16,
            }}
          >
            <div>
              <h2 style={styles.cardTitle}>🚛 Préstamos de equipo</h2>
              <p style={styles.cardSubtitle}>
                Gestiona solicitudes de préstamo: aprobación, entrega,
                devolución y registro histórico.
              </p>
            </div>
          </div>

          {/* Aquí dentro ya se pinta tu módulo de préstamos */}
          <ManageEquipmentLoans />
        </section>
      );

      case 'gestion':
        return <ManageAssignments />;

      case 'equipos':
        return <WeeklyAssignments />;

      case 'catalogos':
        return <ManageBasicData />;

      case 'admins':
        return <ManageAdmins />;

      case 'historial':
        return (
          <div
            style={{ ...styles.card, ...(isMobile ? styles.cardMobile : {}) }}
          >
            <div
              style={{
                ...styles.cardHeader,
                ...(isMobile ? styles.cardHeaderMobile : {}),
              }}
            >
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
      <div
        style={{
          ...styles.container,
          ...(isMobile ? styles.containerMobile : {}),
        }}
      >
        <header
          style={{ ...styles.header, ...(isMobile ? styles.headerMobile : {}) }}
        >
          <div>
            <h1 style={styles.title}>🚀 Gestión de Equipos</h1>
            <p style={styles.subtitle}>
              Gestión integral de operadores, equipos y asignaciones
            </p>
          </div>
          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <div style={styles.statNumber}>{stats.total}</div>
              <div style={styles.statLabel}>Total</div>
            </div>
            <div
              style={{
                ...styles.statCard,
                borderLeft: '3px solid #f59e0b',
              }}
            >
              <div style={styles.statNumber}>{stats.pendientes}</div>
              <div style={styles.statLabel}>Pendientes</div>
            </div>
            <div
              style={{
                ...styles.statCard,
                borderLeft: '3px solid #10b981',
              }}
            >
              <div style={styles.statNumber}>{stats.enProgreso}</div>
              <div style={styles.statLabel}>En Progreso</div>
            </div>
            <div
              style={{
                ...styles.statCard,
                borderLeft: '3px solid #ef4444',
              }}
            >
              <div style={styles.statNumber}>{stats.pausadas}</div>
              <div style={styles.statLabel}>Pausadas</div>
            </div>
          </div>
        </header>


{/* 🔔 BLOQUE DE NOTIFICACIONES PARA ADMIN */}
      <section style={styles.notificationsContainer}>
        <NotificationsManager role="admin" />
      </section>


        <nav
          style={{ ...styles.mainNav, ...(isMobile ? styles.mainNavMobile : {}) }}
        >
          {[
            { id: 'nueva', label: '➕ Asignaciones' },
            { id: 'solicitudes', label: '📨 Solicitudes' },
              { id: 'prestamos', label: '🚛 Préstamo de equipos' },
            { id: 'gestion', label: '📋 Gestionar Asignaciones' },
            { id: 'equipos', label: '🚜 Asignación de Equipos' },
            { id: 'catalogos', label: '👥 Crear Operadores/Equipos' },
            { id: 'admins', label: '🛡️ Administradores' },
            { id: 'historial', label: '📊 Historial' },
          ].map((tab) => (
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

        {renderTabContent()}
      </div>
    </main>
  );
}

// ---------- ESTILOS ----------
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
    flex: 1,
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
    flex: 1,
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
    opacity: 0.5,
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
    whiteSpace: 'nowrap',
  },

  // ------- estilos de solicitudes -------
  requestGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1.7fr)',
    gap: '16px',
    marginTop: '8px',
  },
  requestList: {
    background: '#f9fafb',
    borderRadius: '16px',
    padding: '8px',
    maxHeight: '420px',
    overflowY: 'auto',
  },
  requestItem: {
    width: '100%',
    border: 'none',
    textAlign: 'left',
    padding: '10px 12px',
    borderRadius: '12px',
    background: 'transparent',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    marginBottom: '4px',
  },
  requestItemActive: {
    background: 'rgba(59,130,246,0.08)',
    boxShadow: '0 0 0 1px rgba(59,130,246,0.4)',
  },
  requestCode: {
    fontFamily: 'monospace',
    fontSize: '0.75rem',
    letterSpacing: '0.3em',
    textTransform: 'uppercase',
    color: '#2563eb',
    marginBottom: '4px',
  },
  requestName: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#111827',
  },
  requestActivity: {
    fontSize: '0.75rem',
    color: '#6b7280',
    marginTop: '2px',
  },
  requestDetail: {
    borderRadius: '16px',
    border: '1px solid #e5e7eb',
    padding: '16px 18px',
    minHeight: '260px',
    background: '#f9fafb',
  },
  requestDetailHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
    gap: '12px',
  },
  requestDetailLabel: {
    fontSize: '0.7rem',
    textTransform: 'uppercase',
    letterSpacing: '0.14em',
    color: '#6b7280',
  },
  requestDetailCode: {
    fontFamily: 'monospace',
    fontSize: '0.9rem',
    letterSpacing: '0.35em',
    marginTop: '4px',
    color: '#0f172a',
  },
  requestStatusPill: (status) => ({
    padding: '6px 12px',
    borderRadius: '999px',
    fontSize: '0.75rem',
    fontWeight: 600,
    background:
      status === 'approved'
        ? 'rgba(16,185,129,0.12)'
        : status === 'rejected'
        ? 'rgba(239,68,68,0.12)'
        : 'rgba(245,158,11,0.12)',
    color:
      status === 'approved'
        ? '#059669'
        : status === 'rejected'
        ? '#b91c1c'
        : '#b45309',
  }),
  requestDetailBody: {
    fontSize: '0.8rem',
    color: '#111827',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '8px 16px',
    marginTop: '8px',
    marginBottom: '16px',
  },
  requestDetailItemLabel: {
    fontSize: '0.7rem',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    color: '#6b7280',
  },
  requestDetailItemValue: {
    fontSize: '0.8rem',
    color: '#111827',
    marginTop: '2px',
  },
  requestDetailMessageBox: {
    marginTop: '6px',
    padding: '8px 10px',
    borderRadius: '10px',
    background: '#e5e7eb',
    fontSize: '0.8rem',
    color: '#111827',
  },
  requestDetailActions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginTop: '14px',
  },
  requestUseBtn: {
    background: '#0ea5e9',
    color: 'white',
    border: 'none',
    padding: '8px 14px',
    borderRadius: '999px',
    fontSize: '0.75rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  requestApproveBtn: {
    background: '#22c55e',
    color: '#022c22',
    border: 'none',
    padding: '8px 14px',
    borderRadius: '999px',
    fontSize: '0.75rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  requestRejectBtn: {
    background: '#ef4444',
    color: 'white',
    border: 'none',
    padding: '8px 14px',
    borderRadius: '999px',
    fontSize: '0.75rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  requestEmpty: {
    fontSize: '0.8rem',
    color: '#6b7280',
    padding: '8px 4px',
  },
  requestFiltersBar: {
    display: 'flex',
    gap: '8px',
    marginBottom: '16px',
    flexWrap: 'wrap',
  },
  requestFilterButton: {
    padding: '8px 16px',
    borderRadius: '999px',
    borderWidth: 1,            // 👈 en vez de "border: '1px solid #e5e7eb'"
    borderStyle: 'solid',
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
    color: '#374151',
    transition: 'all 0.2s ease',
  },
  requestFilterButtonActive: {
    borderColor: '#3b82f6',    // 👈 solo cambiamos color, NO usamos "border"
    backgroundColor: '#eff6ff',
    color: '#1d4ed8',
  },

    requestHeaderLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  requestHeaderRight: {
    display: 'flex',
    alignItems: 'flex-start',
  },
  btnExportRequests: {
    background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
    color: 'white',
    border: 'none',
    padding: '10px 18px',
    borderRadius: '999px',
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(59,130,246,0.4)',
    transition: 'transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s',
  },
  requestSummaryChips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginTop: '8px',
  },
  requestSummaryChip: {
    padding: '6px 12px',
    borderRadius: '999px',
    fontSize: '0.75rem',
    fontWeight: 600,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
  },

    // ------- versión mobile de solicitudes -------

  requestGridMobile: {
    gridTemplateColumns: '1fr',   // lista arriba, detalle abajo
  },

  requestListMobile: {
    maxHeight: '220px',           // lista scrolleable pero que no ocupe todo
    marginBottom: '12px',
  },

  requestDetailMobile: {
    minHeight: 'auto',
  },

  requestFiltersBarMobile: {
    width: '100%',
    overflowX: 'auto',
    paddingBottom: '4px',
  },
  paginationBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 16px',
    borderTop: '1px solid #e5e7eb',
    backgroundColor: '#f9fafb',
    gap: '12px',
  },
  paginationInfo: {
    fontSize: '0.8rem',
    color: '#6b7280',
  },
  paginationControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  paginationLabel: {
    fontSize: '0.8rem',
    color: '#4b5563',
  },
  paginationSelect: {
    marginLeft: '6px',
    padding: '4px 8px',
    borderRadius: '6px',
    border: '1px solid #d1d5db',
    fontSize: '0.8rem',
  },
  paginationButtons: {
    display: 'flex',
    gap: '4px',
  },
  paginationButton: {
  minWidth: '28px',
  height: '28px',
  borderRadius: '6px',
  borderWidth: 1,            // ✅ siempre mismos props
  borderStyle: 'solid',
  borderColor: '#e5e7eb',
  backgroundColor: 'white',
  fontSize: '0.75rem',
  cursor: 'pointer',
},
paginationButtonActive: {
  backgroundColor: '#3b82f6',
  color: 'white',
  borderColor: '#2563eb',    // ✅ solo se sobreescribe color
},

  // chip en la lista de solicitudes (izquierda)
  requestAssignStatusRow: {
    marginTop: 4,
  },
  requestAssignStatus: {
    fontSize: '0.7rem',
    borderRadius: '999px',
    padding: '3px 8px',
    fontWeight: 600,
    display: 'inline-block',
  },
  requestAssignStatusAssigned: {
    backgroundColor: 'rgba(16,185,129,0.15)',
    color: '#047857',
  },
  requestAssignStatusPending: {
    backgroundColor: 'rgba(148,163,184,0.18)',
    color: '#4b5563',
  },

  // grupo de pills en el header del detalle
  requestHeaderStatusGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },

  // pill de estado de asignación en el detalle derecho
  requestAssignStatusPill: (hasAssignments) => ({
    padding: '6px 12px',
    borderRadius: '999px',
    fontSize: '0.75rem',
    fontWeight: 600,
    background: hasAssignments
      ? 'rgba(16,185,129,0.12)'
      : 'rgba(148,163,184,0.18)',
    color: hasAssignments ? '#047857' : '#4b5563',
  }),
 notificationsContainer: {
    maxWidth: '360px',
    marginBottom: '16px',
    padding: '10px 14px',
    borderRadius: '12px',
    background: 'rgba(255,255,255,0.12)',
    border: '1px solid rgba(255,255,255,0.4)',
    backdropFilter: 'blur(8px)',
  },
};
