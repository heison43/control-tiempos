'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from '../../firebaseConfig'
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  updateDoc,
  serverTimestamp,
  arrayUnion,
  getDoc,
  getDocs,          // 👈 IMPORT NUEVO
} from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { useIsMobile } from '../../hooks/useIsMobile'
import OperatorNotificationsManager from '../../components/OperatorNotificationsManager'




/**
 * WRAPPER: verifica que el usuario logueado tenga rol "operator"
 * y obtiene su operatorId. Si todo está bien, renderiza el panel.
 */
export default function OperatorPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [operatorId, setOperatorId] = useState(null)
  const [operatorLabel, setOperatorLabel] = useState('')

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (!user) {
          // No hay sesión -> volver al login
          router.push('/')
          return
        }

        const userRef = doc(db, 'users', user.email)
        const snap = await getDoc(userRef)

        if (!snap.exists()) {
          console.warn('Usuario en auth pero no en colección users')
          router.push('/')
          return
        }

        const data = snap.data()

        if (data.isActive === false || data.role !== 'operator') {
          console.warn('Usuario sin rol de operador o inactivo')
          router.push('/')
          return
        }

        if (!data.operatorId) {
          console.warn('Usuario operator sin operatorId configurado')
          setOperatorId(null)
          setOperatorLabel('')
          setLoading(false)
          return
        }

        setOperatorId(data.operatorId)

        // Traer nombre/código del operador para mostrarlo en la cabecera
        try {
          const opSnap = await getDoc(doc(db, 'operators', data.operatorId))
          if (opSnap.exists()) {
            const op = opSnap.data()
            const label = `${op.name || 'Operador'}${
              op.codigo ? ` (${op.codigo})` : ''
            }`
            setOperatorLabel(label)
          }
        } catch (err) {
          console.error('Error leyendo operador vinculado:', err)
        }

        setLoading(false)
      } catch (err) {
        console.error('Error verificando permisos de operador:', err)
        router.push('/')
      }
    })

    return () => unsubscribe()
  }, [router])

  if (loading) {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >
        <p style={{ fontSize: '1.1rem' }}>Verificando permisos de operador...</p>
      </main>
    )
  }

  if (!operatorId) {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
          padding: '20px',
          textAlign: 'center',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>
            No se encontró tu operador configurado
          </h1>
          <p style={{ fontSize: '0.95rem', opacity: 0.9 }}>
            Tu cuenta está autorizada, pero no tiene un operador vinculado.
            Contacta al administrador para que asocie tu correo a un operador.
          </p>
        </div>
      </main>
    )
  }

  return <OperatorPanel operatorId={operatorId} operatorLabel={operatorLabel} />
}

/* ------------------------------------------------------------------ */
/*  PANEL DEL OPERADOR                                                */
/* ------------------------------------------------------------------ */

function OperatorPanel({ operatorId, operatorLabel }) {
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [selectedAssignment, setSelectedAssignment] = useState(null)
  const [noteText, setNoteText] = useState('')
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('activas')

  const isMobile = useIsMobile()   // 👈 AHORA VIENE DEL HOOK


  // -------- helper para sincronizar estado con assignmentRequests -----

  async function updateRequestExecutionStatus(assignment, newExecutionStatus) {
    try {
      if (!assignment) {
        console.warn('Sin assignment para actualizar executionStatus')
        return
      }

      let reqRef = null

      // 1) Si tenemos requestId, lo usamos directo
      if (assignment.requestId) {
        reqRef = doc(db, 'assignmentRequests', assignment.requestId)
      } else {
        // 2) Si no hay requestId, buscamos por código de seguimiento
        const candidateCode =
          assignment.requestCode ||
          assignment.trackingCode ||
          assignment.code ||
          assignment.tracking_code

        if (candidateCode) {
          const q = query(
            collection(db, 'assignmentRequests'),
            where('trackingCode', '==', candidateCode) // 👈 en solicitudes el campo se llama trackingCode
          )
          const snap = await getDocs(q)
          if (!snap.empty) {
            reqRef = snap.docs[0].ref
          } else {
            console.warn(
              'No se encontró assignmentRequest con trackingCode:',
              candidateCode
            )
          }
        }
      }

      if (!reqRef) {
        console.warn(
          'No se pudo determinar la solicitud asociada para sincronizar executionStatus'
        )
        return
      }

      await updateDoc(reqRef, {
        executionStatus: newExecutionStatus, // 'pending' | 'in_progress' | 'paused' | 'completed'
        updatedAt: serverTimestamp(),
      })
    } catch (err) {
      console.error(
        'Error sincronizando estado de ejecución en assignmentRequests:',
        err
      )
    }
  }

  // -------- Cargar asignaciones del operador logueado --------
  useEffect(() => {
    if (!operatorId) {
      setAssignments([])
      return
    }

    setLoading(true)
    setError('')

    let statusFilter = ['pendiente', 'en_progreso', 'pausado']

    if (activeTab === 'finalizadas') {
      statusFilter = ['finalizado']
    } else if (activeTab === 'todas') {
      statusFilter = ['pendiente', 'en_progreso', 'pausado', 'finalizado']
    }

    const q = query(
      collection(db, 'assignments'),
      where('operatorId', '==', operatorId),
      where('status', 'in', statusFilter)
    )

    const unsub = onSnapshot(
      q,
      (snap) => {
        setAssignments(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        setLoading(false)
      },
      (err) => {
        console.error(err)
        setError('Error cargando asignaciones.')
        setLoading(false)
      }
    )

    return () => unsub()
  }, [operatorId, activeTab])

  // -------- Estadísticas actualizadas --------
  const stats = {
    pendientes: assignments.filter((a) => a.status === 'pendiente').length,
    enProgreso: assignments.filter((a) => a.status === 'en_progreso').length,
    pausadas: assignments.filter((a) => a.status === 'pausado').length,
    finalizadas: assignments.filter((a) => a.status === 'finalizado').length,
    total: assignments.length,
  }

  // -------- Acciones principales --------
  const handleStart = async (id) => {
    try {
      const refDoc = doc(db, 'assignments', id)
      await updateDoc(refDoc, {
        status: 'en_progreso',
        startTime: serverTimestamp(),
      })

      const assignment = assignments.find((a) => a.id === id)
      await updateRequestExecutionStatus(assignment, 'in_progress') // 👈 sincroniza con solicitud
    } catch {
      setError('No se pudo iniciar la actividad.')
    }
  }

  const handlePause = async (id) => {
    try {
      const refDoc = doc(db, 'assignments', id)
      await updateDoc(refDoc, {
        status: 'pausado',
        pausedAt: serverTimestamp(),
      })

      const assignment = assignments.find((a) => a.id === id)
      await updateRequestExecutionStatus(assignment, 'paused') // 👈
    } catch {
      setError('No se pudo pausar la actividad.')
    }
  }

  const handleResume = async (id) => {
    try {
      const refDoc = doc(db, 'assignments', id)
      await updateDoc(refDoc, {
        status: 'en_progreso',
        resumedAt: serverTimestamp(),
      })

      const assignment = assignments.find((a) => a.id === id)
      await updateRequestExecutionStatus(assignment, 'in_progress') // 👈
    } catch {
      setError('No se pudo reanudar la actividad.')
    }
  }

  const handleFinish = async (assignment) => {
    try {
      const refDoc = doc(db, 'assignments', assignment.id)
      const end = new Date()
      let durationMinutes = null

      if (assignment.startTime?.toDate) {
        const start = assignment.startTime.toDate()
        const diff = (end.getTime() - start.getTime()) / 60000
        durationMinutes = Math.round(diff)
      }

      await updateDoc(refDoc, {
        status: 'finalizado',
        endTime: end,
        durationMinutes,
      })

      await updateRequestExecutionStatus(assignment, 'completed') // 👈
    } catch {
      setError('No se pudo finalizar la actividad.')
    }
  }

  // -------- Notas --------
  const openNoteModal = (assignment) => {
    setSelectedAssignment(assignment)
    setNoteText('')
    setShowNoteModal(true)
  }

  const handleSaveNote = async () => {
    if (!selectedAssignment || !noteText.trim()) return
    setSaving(true)
    try {
      const refDoc = doc(db, 'assignments', selectedAssignment.id)
      const noteData = {
        type: 'text',
        content: noteText.trim(),
        createdAt: new Date(),
      }

      await updateDoc(refDoc, {
        evidences: arrayUnion(noteData),
      })

      setShowNoteModal(false)
      setNoteText('')
    } catch (err) {
      console.error(err)
      setError('Error guardando nota.')
    } finally {
      setSaving(false)
    }
  }

  const formatTime = (ts) => {
    if (!ts) return '-'
    const d = ts.toDate ? ts.toDate() : ts
    return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
  }

  const getStatusColor = (status) => {
    const colors = {
      pendiente: '#f59e0b',
      en_progreso: '#10b981',
      pausado: '#ef4444',
      finalizado: '#6b7280',
    }
    return colors[status] || '#6b7280'
  }

  const getStatusIcon = (status) => {
    const icons = {
      pendiente: '⏳',
      en_progreso: '▶️',
      pausado: '⏸️',
      finalizado: '✅',
    }
    return icons[status] || '📝'
  }

 // -------- Render --------
return (
  <>
    <style jsx global>{`
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    `}</style>

    <main style={{ ...styles.page, ...(isMobile ? responsiveStyles.page : {}) }}>

      <div
        style={{ ...styles.container, ...(isMobile ? responsiveStyles.container : {}) }}
      >
        {/* Header Moderno */}
        <header
          style={{ ...styles.header, ...(isMobile ? responsiveStyles.header : {}) }}
        >
          <div>
            <h1 style={styles.title}>Panel de Operador</h1>
            <p style={styles.subtitle}>
              Controla tus actividades, tiempos y registros
            </p>
          </div>
          <div style={{ ...styles.stats, ...(isMobile ? responsiveStyles.stats : {}) }}>
  <div
    style={{
      ...styles.statCard,
      borderLeftWidth: 3,
      borderLeftStyle: 'solid',
      borderLeftColor: '#f59e0b',
    }}
  >
    <span style={styles.statNumber}>{stats.pendientes}</span>
    <span style={styles.statLabel}>Pendientes</span>
  </div>

  <div
    style={{
      ...styles.statCard,
      borderLeftWidth: 3,
      borderLeftStyle: 'solid',
      borderLeftColor: '#10b981',
    }}
  >
    <span style={styles.statNumber}>{stats.enProgreso}</span>
    <span style={styles.statLabel}>En Progreso</span>
  </div>

  <div
    style={{
      ...styles.statCard,
      borderLeftWidth: 3,
      borderLeftStyle: 'solid',
      borderLeftColor: '#ef4444',
    }}
  >
    <span style={styles.statNumber}>{stats.pausadas}</span>
    <span style={styles.statLabel}>Pausadas</span>
  </div>

  <div
    style={{
      ...styles.statCard,
      borderLeftWidth: 3,
      borderLeftStyle: 'solid',
      borderLeftColor: '#6b7280',
    }}
  >
    <span style={styles.statNumber}>{stats.finalizadas}</span>
    <span style={styles.statLabel}>Finalizadas</span>
  </div>
</div>

        </header>

        {/* Información del operador logueado (sin desplegable) */}
        <section
          style={{ ...styles.card, ...(isMobile ? responsiveStyles.card : {}) }}
        >
          <div style={styles.formGroup}>
            <label style={styles.label}>👤 Operador asignado</label>
            <div
              style={{
                ...styles.select,
                backgroundColor: '#f9fafb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'default',
              }}
            >
              <span>{operatorLabel || 'Operador vinculado a tu cuenta'}</span>
              <span
                style={{
                  fontSize: '0.75rem',
                  color: '#6b7280',
                }}
              >
                Solo lectura
              </span>
            </div>
          </div>
        </section>


        {/* Gestión de notificaciones push para este operador */}
<section
  style={{ ...styles.card, ...(isMobile ? responsiveStyles.card : {}) }}
>
  <div style={styles.formGroup}>
    <label style={styles.label}>🔔 Notificaciones</label>
    <p style={{ fontSize: '0.875rem', color: '#4b5563', marginBottom: '12px' }}>
      Activa las notificaciones para recibir avisos cuando te asignen una nueva
      actividad o cambie tu programación.
    </p>

    <OperatorNotificationsManager operatorId={operatorId} />
  </div>
</section>


        {/* Tabs de Navegación */}
        <div
          style={{ ...styles.tabs, ...(isMobile ? responsiveStyles.tabs : {}) }}
        >
          <button
            onClick={() => setActiveTab('activas')}
            style={{
              ...styles.tab,
              ...(activeTab === 'activas' ? styles.tabActive : {}),
            }}
          >
            🚀 Activas
          </button>
          <button
            onClick={() => setActiveTab('finalizadas')}
            style={{
              ...styles.tab,
              ...(activeTab === 'finalizadas' ? styles.tabActive : {}),
            }}
          >
            ✅ Finalizadas
          </button>
          <button
            onClick={() => setActiveTab('todas')}
            style={{
              ...styles.tab,
              ...(activeTab === 'todas' ? styles.tabActive : {}),
            }}
          >
            📋 Todas
          </button>
        </div>

        {/* Contador de actividades */}
        <div
          style={{
            ...styles.counterBar,
            ...(isMobile ? responsiveStyles.counterBar : {}),
          }}
        >
          <span style={styles.counterText}>
            {assignments.length} actividad
            {assignments.length !== 1 ? 'es' : ''}{' '}
            {activeTab === 'activas'
              ? 'activas'
              : activeTab === 'finalizadas'
              ? 'finalizadas'
              : 'en total'}
          </span>
        </div>

        {/* Contenido de Asignaciones */}
        <section
          style={{ ...styles.card, ...(isMobile ? responsiveStyles.card : {}) }}
        >
          {error && <div style={styles.error}>⚠️ {error}</div>}

          {loading ? (
            <div style={styles.loading}>
              <div style={styles.spinner}></div>
              <p>Cargando actividades...</p>
            </div>
          ) : assignments.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>📝</div>
              <h3>
                No hay actividades{' '}
                {activeTab === 'activas'
                  ? 'activas'
                  : activeTab === 'finalizadas'
                  ? 'finalizadas'
                  : ''}
              </h3>
              <p>Cuando tengas nuevas asignaciones, aparecerán aquí.</p>
            </div>
          ) : (
            <div
              style={{
                ...styles.assignmentsGrid,
                ...(isMobile ? responsiveStyles.assignmentsGrid : {}),
              }}
            >
              {assignments.map((assignment) => (
  <div
    key={assignment.id}
    style={{
      ...styles.assignmentCard,
      borderLeftColor: getStatusColor(assignment.status),
    }}
  >


                  <div
                    style={{
                      ...styles.assignmentHeader,
                      ...(isMobile ? responsiveStyles.assignmentHeader : {}),
                    }}
                  >
                    <div style={styles.assignmentInfo}>
                      <h3 style={styles.activityTitle}>{assignment.activity}</h3>
                      <p style={styles.location}>📍 {assignment.location}</p>
                      {assignment.solicitadoPor && (
                        <p style={styles.solicitadoPor}>
                          👥 Solicitado por:{' '}
                          <strong>{assignment.solicitadoPor}</strong>
                        </p>
                      )}

                      {assignment.telefonoSolicitante && (
                        <p style={styles.solicitadoPor}>
                          📞 Teléfono:{' '}
                          <strong>{assignment.telefonoSolicitante}</strong>
                        </p>
                      )}

                      {assignment.areaSolicitante && (
                        <p style={styles.solicitadoPor}>
                          🏢 Área solicitante:{' '}
                          <strong>{assignment.areaSolicitante}</strong>
                        </p>
                      )}
                    </div>
                    <div
                      style={{
                        ...styles.statusBadge,
                        backgroundColor: `${getStatusColor(
                          assignment.status
                        )}20`,
                        color: getStatusColor(assignment.status),
                      }}
                    >
                      {getStatusIcon(assignment.status)}{' '}
                      {assignment.status.replace('_', ' ')}
                    </div>
                  </div>

                  <div
                    style={{
                      ...styles.timeInfo,
                      ...(isMobile ? responsiveStyles.timeInfo : {}),
                    }}
                  >
                    <div style={styles.timeItem}>
                      <span style={styles.timeLabel}>Inicio:</span>
                      <span style={styles.timeValue}>
                        {formatTime(assignment.startTime)}
                      </span>
                    </div>
                    <div style={styles.timeItem}>
                      <span style={styles.timeLabel}>Fin:</span>
                      <span style={styles.timeValue}>
                        {formatTime(assignment.endTime)}
                      </span>
                    </div>
                    {assignment.durationMinutes && (
                      <div style={styles.timeItem}>
                        <span style={styles.timeLabel}>Duración:</span>
                        <span style={styles.timeValue}>
                          {assignment.durationMinutes} min
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Acciones */}
                  <div
                    style={{
                      ...styles.actions,
                      ...(isMobile ? responsiveStyles.actions : {}),
                    }}
                  >
                    {assignment.status === 'pendiente' && (
                      <button
                        onClick={() => handleStart(assignment.id)}
                        style={styles.btnPrimary}
                      >
                        ▶️ Iniciar
                      </button>
                    )}

                    {assignment.status === 'en_progreso' && (
                      <>
                        <button
                          onClick={() => handlePause(assignment.id)}
                          style={styles.btnSecondary}
                        >
                          ⏸️ Pausar
                        </button>
                        <button
                          onClick={() => handleFinish(assignment)}
                          style={styles.btnSuccess}
                        >
                          ✅ Finalizar
                        </button>
                      </>
                    )}

                    {assignment.status === 'pausado' && (
                      <>
                        <button
                          onClick={() => handleResume(assignment.id)}
                          style={styles.btnPrimary}
                        >
                          ▶️ Reanudar
                        </button>
                        <button
                          onClick={() => handleFinish(assignment)}
                          style={styles.btnSuccess}
                        >
                          ✅ Finalizar
                        </button>
                      </>
                    )}

                    {assignment.status !== 'finalizado' && (
                      <button
                        onClick={() => openNoteModal(assignment)}
                        style={styles.btnOutline}
                      >
                        📝 Nota
                      </button>
                    )}

                    {assignment.status === 'finalizado' && (
                      <div style={styles.completedBadge}>
                        ✅ Completado • {assignment.durationMinutes || '0'} min
                      </div>
                    )}
                  </div>

                  {assignment.evidences &&
                    assignment.evidences.filter((ev) => ev.type === 'text')
                      .length > 0 && (
                      <div style={styles.notesSection}>
                        <h4 style={styles.notesTitle}>Notas:</h4>
                        {assignment.evidences
                          .filter((ev) => ev.type === 'text')
                          .map((ev, index) => (
                            <div key={index} style={styles.noteItem}>
                              <p style={styles.noteText}>{ev.content}</p>
                              <span style={styles.noteTime}>
                                {ev.createdAt?.toDate
                                  ? formatTime(ev.createdAt)
                                  : 'Ahora'}
                              </span>
                            </div>
                          ))}
                      </div>
                    )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Modal Notas Moderno */}
      {showNoteModal && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h3>📝 Agregar Nota</h3>
              <button
                onClick={() => setShowNoteModal(false)}
                style={styles.closeButton}
              >
                ×
              </button>
            </div>

            <div style={styles.modalBody}>
              <p style={styles.modalAssignment}>
                Actividad: <strong>{selectedAssignment?.activity}</strong>
              </p>

              {selectedAssignment?.solicitadoPor && (
                <p style={styles.modalSolicitado}>
                  👥 Solicitado por:{' '}
                  <strong>{selectedAssignment.solicitadoPor}</strong>
                </p>
              )}

              {selectedAssignment?.telefonoSolicitante && (
                <p style={styles.modalSolicitado}>
                  📞 Teléfono:{' '}
                  <strong>{selectedAssignment.telefonoSolicitante}</strong>
                </p>
              )}

              {selectedAssignment?.areaSolicitante && (
                <p style={styles.modalSolicitado}>
                  🏢 Área:{' '}
                  <strong>{selectedAssignment.areaSolicitante}</strong>
                </p>
              )}

              <textarea
                placeholder="Escribe tus observaciones, comentarios o detalles importantes..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                style={styles.textarea}
                rows={4}
              />

              <div style={styles.modalActions}>
                <button
                  onClick={() => setShowNoteModal(false)}
                  style={styles.btnCancel}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveNote}
                  disabled={saving || !noteText.trim()}
                  style={{
                    ...styles.btnSave,
                    ...((saving || !noteText.trim()) && styles.btnDisabled),
                  }}
                >
                  {saving ? '💾 Guardando...' : '💾 Guardar Nota'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
        </main>
  </>
)

}

/* -------- Estilos ULTRA PRO (solo UI) -------- */
const styles = {
  page: {
    minHeight: '100vh',
    background:
      'radial-gradient(1200px circle at 10% 10%, rgba(255,255,255,0.18), transparent 40%), radial-gradient(900px circle at 90% 20%, rgba(255,255,255,0.14), transparent 35%), linear-gradient(135deg, #4f46e5 0%, #7c3aed 45%, #0ea5e9 110%)',
    padding: '20px',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  },

  container: {
    maxWidth: '1200px',
    margin: '0 auto',
  },

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '22px',
    flexWrap: 'wrap',
    gap: '16px',
  },

  title: {
    fontSize: '2.35rem',
    fontWeight: '900',
    letterSpacing: '-0.02em',
    margin: '0',
    background: 'linear-gradient(90deg, rgba(255,255,255,1), rgba(255,255,255,0.75))',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },

  subtitle: {
    fontSize: '1.02rem',
    color: 'rgba(255,255,255,0.86)',
    margin: '8px 0 0 0',
    lineHeight: 1.35,
    maxWidth: '520px',
  },

  stats: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
  },

  // ✅ sin shorthand border (quita warning)
  statCard: {
    background: 'rgba(255,255,255,0.14)',
    backdropFilter: 'blur(14px)',
    padding: '14px 16px',
    borderRadius: '16px',
    textAlign: 'center',
    minWidth: '104px',

    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'rgba(255,255,255,0.22)',

    borderLeftWidth: 5,
    borderLeftStyle: 'solid',
    borderLeftColor: 'rgba(255,255,255,0.22)',

    boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
  },

  statNumber: {
    display: 'block',
    fontSize: '1.75rem',
    fontWeight: '900',
    color: 'white',
    lineHeight: '1',
  },

  statLabel: {
    fontSize: '0.74rem',
    color: 'rgba(255,255,255,0.85)',
    marginTop: '6px',
    letterSpacing: '0.02em',
  },

  card: {
    background: 'rgba(255,255,255,0.92)',
    padding: '22px',
    borderRadius: '22px',
    boxShadow: '0 18px 55px rgba(0,0,0,0.14)',
    marginBottom: '18px',
    backdropFilter: 'blur(12px)',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'rgba(255,255,255,0.55)',
  },

  formGroup: { marginBottom: '0' },

  label: {
    display: 'block',
    fontSize: '0.9rem',
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: '8px',
    letterSpacing: '-0.01em',
  },

  select: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '14px',
    fontSize: '0.98rem',
    backgroundColor: 'rgba(255,255,255,0.9)',
    transition: 'all 0.2s ease',

    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'rgba(15,23,42,0.12)',

    boxShadow: '0 6px 20px rgba(15,23,42,0.06)',
  },

  tabs: {
    display: 'flex',
    background: 'rgba(255,255,255,0.92)',
    padding: '8px',
    borderRadius: '18px',
    marginBottom: '14px',
    backdropFilter: 'blur(12px)',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'rgba(255,255,255,0.55)',
    boxShadow: '0 14px 40px rgba(0,0,0,0.12)',
  },

  tab: {
    flex: '1',
    padding: '12px 12px',
    border: 'none',
    background: 'transparent',
    borderRadius: '14px',
    fontSize: '0.9rem',
    fontWeight: '800',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    color: '#0f172a',
    letterSpacing: '-0.01em',
  },

  tabActive: {
    background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
    color: 'white',
    boxShadow: '0 10px 24px rgba(79,70,229,0.32)',
  },

  counterBar: {
    background: 'rgba(255,255,255,0.85)',
    padding: '12px 16px',
    borderRadius: '16px',
    marginBottom: '14px',
    textAlign: 'center',
    backdropFilter: 'blur(12px)',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'rgba(255,255,255,0.55)',
    boxShadow: '0 10px 30px rgba(0,0,0,0.10)',
  },

  counterText: {
    fontSize: '0.92rem',
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: '-0.01em',
  },

  error: {
    background: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'rgba(239, 68, 68, 0.22)',
    color: '#b91c1c',
    padding: '12px 14px',
    borderRadius: '14px',
    marginBottom: '14px',
    fontSize: '0.9rem',
    fontWeight: '700',
  },

  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '44px 20px',
    color: '#334155',
  },

  spinner: {
    width: '44px',
    height: '44px',
    borderWidth: 4,
    borderStyle: 'solid',
    borderColor: 'rgba(15,23,42,0.12)',
    borderLeftColor: '#4f46e5',
    borderRadius: '50%',
    animation: 'spin 0.9s linear infinite',
    marginBottom: '14px',
  },

  emptyState: {
    textAlign: 'center',
    padding: '54px 16px',
    color: '#334155',
  },

  emptyIcon: {
    fontSize: '3.8rem',
    marginBottom: '10px',
    opacity: '0.55',
  },

  assignmentsGrid: {
    display: 'grid',
    gap: '16px',
    gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
  },

  // ✅ TARJETA DE ACTIVIDAD (más pro)
  // ✅ sin shorthand border (para que si luego pintas borde izq no moleste)
  assignmentCard: {
    position: 'relative',
    overflow: 'hidden',
    background:
      'radial-gradient(600px circle at 80% 0%, rgba(79,70,229,0.10), transparent 45%), radial-gradient(550px circle at 0% 40%, rgba(14,165,233,0.10), transparent 45%), rgba(255,255,255,0.95)',
    borderRadius: '20px',
    padding: '18px',
    transition: 'all 0.25s ease',

    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'rgba(15,23,42,0.10)',

    borderLeftWidth: 6,
    borderLeftStyle: 'solid',
    borderLeftColor: 'rgba(15,23,42,0.10)',

    boxShadow: '0 14px 40px rgba(15,23,42,0.10)',
  },

  // franja superior elegante
  assignmentAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '6px',
    width: '100%',
    opacity: 0.95,
  },

  assignmentHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '14px',
    gap: '12px',
  },

  assignmentInfo: { flex: '1', minWidth: 0 },

  activityTitle: {
    fontSize: '1.18rem',
    fontWeight: '900',
    color: '#0f172a',
    margin: '0 0 6px 0',
    letterSpacing: '-0.02em',
  },

  location: {
    fontSize: '0.85rem',
    color: '#334155',
    margin: '0 0 10px 0',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 10px',
    borderRadius: '999px',
    background: 'rgba(15,23,42,0.04)',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'rgba(15,23,42,0.08)',
    width: 'fit-content',
  },

  solicitadoPor: {
    fontSize: '0.8rem',
    color: '#334155',
    margin: '6px 0 0 0',
    lineHeight: 1.25,
  },

  statusBadge: {
    padding: '8px 12px',
    borderRadius: '999px',
    fontSize: '0.78rem',
    fontWeight: '900',
    whiteSpace: 'nowrap',
    letterSpacing: '0.01em',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'rgba(15,23,42,0.10)',
    boxShadow: '0 10px 22px rgba(15,23,42,0.08)',
    backdropFilter: 'blur(8px)',
  },

  timeInfo: {
    display: 'flex',
    gap: '12px',
    marginBottom: '14px',
    padding: '12px',
    background: 'rgba(15,23,42,0.03)',
    borderRadius: '16px',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'rgba(15,23,42,0.08)',
  },

  timeItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    flex: '1',
    gap: 4,
  },

  timeLabel: {
    fontSize: '0.74rem',
    color: '#64748b',
    fontWeight: '800',
  },

  timeValue: {
    fontSize: '0.92rem',
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: '-0.01em',
  },

  actions: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
  },

  btnPrimary: {
    background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
    color: 'white',
    border: 'none',
    padding: '12px 14px',
    borderRadius: '14px',
    fontSize: '0.92rem',
    fontWeight: '900',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    flex: '1',
    minWidth: '130px',
    boxShadow: '0 14px 28px rgba(79,70,229,0.25)',
  },

  btnSecondary: {
    background: 'linear-gradient(135deg, #f59e0b, #f97316)',
    color: 'white',
    border: 'none',
    padding: '12px 14px',
    borderRadius: '14px',
    fontSize: '0.92rem',
    fontWeight: '900',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    flex: '1',
    minWidth: '130px',
    boxShadow: '0 14px 28px rgba(249,115,22,0.22)',
  },

  btnSuccess: {
    background: 'linear-gradient(135deg, #10b981, #22c55e)',
    color: 'white',
    border: 'none',
    padding: '12px 14px',
    borderRadius: '14px',
    fontSize: '0.92rem',
    fontWeight: '900',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    flex: '1',
    minWidth: '130px',
    boxShadow: '0 14px 28px rgba(34,197,94,0.18)',
  },

  btnOutline: {
    background: 'rgba(255,255,255,0.7)',
    color: '#0f172a',
    padding: '12px 14px',
    borderRadius: '14px',
    fontSize: '0.92rem',
    fontWeight: '900',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    flex: '1',
    minWidth: '120px',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'rgba(15,23,42,0.12)',
    boxShadow: '0 10px 22px rgba(15,23,42,0.08)',
  },

  completedBadge: {
    background: 'rgba(34,197,94,0.10)',
    color: '#166534',
    padding: '12px 14px',
    borderRadius: '14px',
    fontSize: '0.92rem',
    textAlign: 'center',
    flex: '1',
    fontWeight: '900',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'rgba(34,197,94,0.22)',
  },

  notesSection: {
    marginTop: '14px',
    paddingTop: '14px',
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: 'rgba(15,23,42,0.08)',
  },

  notesTitle: {
    fontSize: '0.9rem',
    fontWeight: '900',
    color: '#0f172a',
    margin: '0 0 10px 0',
  },

  noteItem: {
    background: 'rgba(15,23,42,0.03)',
    padding: '12px',
    borderRadius: '14px',
    marginBottom: '10px',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'rgba(15,23,42,0.08)',
  },

  noteText: {
    margin: '0 0 6px 0',
    fontSize: '0.92rem',
    color: '#0f172a',
    fontWeight: '700',
    lineHeight: 1.35,
  },

  noteTime: {
    fontSize: '0.78rem',
    color: '#64748b',
    fontWeight: '800',
  },

  modalBackdrop: {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    background: 'rgba(2, 6, 23, 0.55)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: '1000',
    padding: '20px',
    backdropFilter: 'blur(10px)',
  },

  modal: {
    background: 'rgba(255,255,255,0.95)',
    borderRadius: '22px',
    width: '100%',
    maxWidth: '520px',
    boxShadow: '0 30px 80px rgba(0,0,0,0.28)',
    overflow: 'hidden',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'rgba(255,255,255,0.55)',
  },

  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 22px',
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: 'rgba(15,23,42,0.08)',
  },

  closeButton: {
    background: 'rgba(15,23,42,0.06)',
    border: 'none',
    fontSize: '1.6rem',
    cursor: 'pointer',
    color: '#0f172a',
    padding: '0',
    width: '38px',
    height: '38px',
    borderRadius: '999px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalBody: {
    padding: '20px 22px 22px',
  },

  modalAssignment: {
    margin: '0 0 6px 0',
    color: '#475569',
    fontSize: '0.9rem',
    fontWeight: '700',
  },

  modalSolicitado: {
    margin: '0 0 14px 0',
    color: '#334155',
    fontSize: '0.9rem',
    fontWeight: '700',
  },

  textarea: {
    width: '100%',
    borderRadius: '16px',
    padding: '14px',
    fontSize: '0.95rem',
    resize: 'vertical',
    minHeight: '120px',
    fontFamily: 'inherit',
    transition: 'border-color 0.2s ease',
    outline: 'none',

    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'rgba(15,23,42,0.14)',

    boxShadow: '0 10px 24px rgba(15,23,42,0.08)',
    background: 'rgba(255,255,255,0.9)',
  },

  modalActions: {
    display: 'flex',
    gap: '10px',
    justifyContent: 'flex-end',
    marginTop: '16px',
  },

  btnCancel: {
    background: 'rgba(255,255,255,0.7)',
    color: '#0f172a',
    padding: '12px 16px',
    borderRadius: '14px',
    fontSize: '0.92rem',
    fontWeight: '900',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'rgba(15,23,42,0.12)',
    boxShadow: '0 10px 22px rgba(15,23,42,0.08)',
  },

  btnSave: {
    background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
    color: 'white',
    border: 'none',
    padding: '12px 16px',
    borderRadius: '14px',
    fontSize: '0.92rem',
    fontWeight: '900',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 14px 28px rgba(79,70,229,0.25)',
  },

  btnDisabled: {
    opacity: '0.6',
    cursor: 'not-allowed',
  },
}

const responsiveStyles = {
  page: { padding: '12px' },
  container: { width: '100%' },

  header: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },

  stats: {
    width: '100%',
  },

  card: {
    padding: '16px',
  },

  tabs: {
    flexDirection: 'column',
    gap: '8px',
  },

  counterBar: {
    textAlign: 'left',
  },

  assignmentsGrid: {
    gridTemplateColumns: '1fr',
  },

  assignmentHeader: {
    flexDirection: 'column',
    gap: '10px',
  },

  timeInfo: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },

  actions: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
}
