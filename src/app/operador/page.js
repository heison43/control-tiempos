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

  // 👉 NUEVO: detectar tamaño de pantalla
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

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
          <div
            style={{ ...styles.stats, ...(isMobile ? responsiveStyles.stats : {}) }}
          >
            <div style={{ ...styles.statCard, borderLeft: '3px solid #f59e0b' }}>
              <span style={styles.statNumber}>{stats.pendientes}</span>
              <span style={styles.statLabel}>Pendientes</span>
            </div>
            <div style={{ ...styles.statCard, borderLeft: '3px solid #10b981' }}>
              <span style={styles.statNumber}>{stats.enProgreso}</span>
              <span style={styles.statLabel}>En Progreso</span>
            </div>
            <div style={{ ...styles.statCard, borderLeft: '3px solid #ef4444' }}>
              <span style={styles.statNumber}>{stats.pausadas}</span>
              <span style={styles.statLabel}>Pausadas</span>
            </div>
            <div style={{ ...styles.statCard, borderLeft: '3px solid #6b7280' }}>
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
                <div key={assignment.id} style={styles.assignmentCard}>
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
  )
}

/* -------- Estilos Modernos -------- */
const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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
    marginBottom: '24px',
    flexWrap: 'wrap',
    gap: '20px',
  },
  title: {
    fontSize: '2.5rem',
    fontWeight: '800',
    color: 'white',
    margin: '0',
    background: 'linear-gradient(45deg, #fff, #f0f0f0)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  subtitle: {
    fontSize: '1.1rem',
    color: 'rgba(255,255,255,0.8)',
    margin: '8px 0 0 0',
  },
  stats: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
  },
  statCard: {
    background: 'rgba(255,255,255,0.1)',
    backdropFilter: 'blur(10px)',
    padding: '16px 20px',
    borderRadius: '12px',
    textAlign: 'center',
    border: '1px solid rgba(255,255,255,0.2)',
    minWidth: '100px',
  },
  statNumber: {
    display: 'block',
    fontSize: '1.8rem',
    fontWeight: '700',
    color: 'white',
    lineHeight: '1',
  },
  statLabel: {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.8)',
    marginTop: '4px',
  },
  card: {
    background: 'white',
    padding: '24px',
    borderRadius: '20px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
    marginBottom: '20px',
    backdropFilter: 'blur(10px)',
  },
  formGroup: {
    marginBottom: '0',
  },
  label: {
    display: 'block',
    fontSize: '0.875rem',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '8px',
  },
  select: {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '12px',
    border: '2px solid #e5e7eb',
    fontSize: '1rem',
    backgroundColor: 'white',
    transition: 'all 0.2s ease',
  },
  tabs: {
    display: 'flex',
    background: 'white',
    padding: '8px',
    borderRadius: '16px',
    marginBottom: '16px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
  },
  tab: {
    flex: '1',
    padding: '12px 16px',
    border: 'none',
    background: 'transparent',
    borderRadius: '12px',
    fontSize: '0.875rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  tabActive: {
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    color: 'white',
    boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
  },
  counterBar: {
    background: 'rgba(255,255,255,0.9)',
    padding: '12px 20px',
    borderRadius: '12px',
    marginBottom: '16px',
    textAlign: 'center',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255,255,255,0.3)',
  },
  counterText: {
    fontSize: '0.875rem',
    fontWeight: '600',
    color: '#374151',
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
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '40px 20px',
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
    padding: '60px 20px',
    color: '#6b7280',
  },
  emptyIcon: {
    fontSize: '4rem',
    marginBottom: '16px',
    opacity: '0.5',
  },
  assignmentsGrid: {
    display: 'grid',
    gap: '20px',
    gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
  },
  assignmentCard: {
    background: 'white',
    border: '1px solid #f3f4f6',
    borderRadius: '16px',
    padding: '20px',
    transition: 'all 0.3s ease',
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
  },
  assignmentHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '16px',
  },
  assignmentInfo: {
    flex: '1',
  },
  activityTitle: {
    fontSize: '1.125rem',
    fontWeight: '700',
    color: '#1f2937',
    margin: '0 0 4px 0',
  },
  location: {
    fontSize: '0.875rem',
    color: '#6b7280',
    margin: '0 0 4px 0',
  },
  solicitadoPor: {
    fontSize: '0.75rem',
    color: '#4b5563',
    margin: '0',
    fontStyle: 'italic',
  },
  statusBadge: {
    padding: '6px 12px',
    borderRadius: '20px',
    fontSize: '0.75rem',
    fontWeight: '600',
    whiteSpace: 'nowrap',
  },
  timeInfo: {
    display: 'flex',
    gap: '16px',
    marginBottom: '16px',
    padding: '12px',
    background: '#f8fafc',
    borderRadius: '12px',
  },
  timeItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    flex: '1',
  },
  timeLabel: {
    fontSize: '0.75rem',
    color: '#6b7280',
    marginBottom: '4px',
  },
  timeValue: {
    fontSize: '0.875rem',
    fontWeight: '600',
    color: '#1f2937',
  },
  actions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  btnPrimary: {
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    color: 'white',
    border: 'none',
    padding: '10px 16px',
    borderRadius: '10px',
    fontSize: '0.875rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    flex: '1',
    minWidth: '120px',
  },
  btnSecondary: {
    background: '#f59e0b',
    color: 'white',
    border: 'none',
    padding: '10px 16px',
    borderRadius: '10px',
    fontSize: '0.875rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    flex: '1',
    minWidth: '120px',
  },
  btnSuccess: {
    background: '#10b981',
    color: 'white',
    border: 'none',
    padding: '10px 16px',
    borderRadius: '10px',
    fontSize: '0.875rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    flex: '1',
    minWidth: '120px',
  },
  btnOutline: {
    background: 'transparent',
    color: '#374151',
    border: '2px solid #e5e7eb',
    padding: '10px 16px',
    borderRadius: '10px',
    fontSize: '0.875rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    flex: '1',
    minWidth: '100px',
  },
  completedBadge: {
    background: '#f0fdf4',
    color: '#166534',
    padding: '10px 16px',
    borderRadius: '10px',
    fontSize: '0.875rem',
    textAlign: 'center',
    flex: '1',
    fontWeight: '600',
  },
  notesSection: {
    marginTop: '16px',
    paddingTop: '16px',
    borderTop: '1px solid #f3f4f6',
  },
  notesTitle: {
    fontSize: '0.875rem',
    fontWeight: '600',
    color: '#374151',
    margin: '0 0 8px 0',
  },
  noteItem: {
    background: '#f8fafc',
    padding: '12px',
    borderRadius: '8px',
    marginBottom: '8px',
  },
  noteText: {
    margin: '0 0 4px 0',
    fontSize: '0.875rem',
    color: '#1f2937',
  },
  noteTime: {
    fontSize: '0.75rem',
    color: '#6b7280',
  },
  modalBackdrop: {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: '1000',
    padding: '20px',
  },
  modal: {
    background: 'white',
    borderRadius: '20px',
    width: '100%',
    maxWidth: '500px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
    overflow: 'hidden',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '24px',
    borderBottom: '1px solid #f3f4f6',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '1.5rem',
    cursor: 'pointer',
    color: '#6b7280',
    padding: '0',
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    padding: '24px',
  },
  modalAssignment: {
    margin: '0 0 8px 0',
    color: '#6b7280',
    fontSize: '0.875rem',
  },
  modalSolicitado: {
    margin: '0 0 16px 0',
    color: '#4b5563',
    fontSize: '0.875rem',
    fontStyle: 'italic',
  },
  textarea: {
    width: '100%',
    border: '2px solid #e5e7eb',
    borderRadius: '12px',
    padding: '16px',
    fontSize: '0.875rem',
    resize: 'vertical',
    minHeight: '120px',
    fontFamily: 'inherit',
    transition: 'border-color 0.2s ease',
  },
  modalActions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
    marginTop: '20px',
  },
  btnCancel: {
    background: 'transparent',
    color: '#6b7280',
    border: '2px solid #e5e7eb',
    padding: '12px 20px',
    borderRadius: '10px',
    fontSize: '0.875rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  btnSave: {
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    color: 'white',
    border: 'none',
    padding: '12px 20px',
    borderRadius: '10px',
    fontSize: '0.875rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  btnDisabled: {
    opacity: '0.6',
    cursor: 'not-allowed',
  },
}

const responsiveStyles = {
  page: {
    padding: '12px',
  },
  container: {
    width: '100%',
  },
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
    gap: '8px',
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
