'use client';

import { useEffect, useState } from "react";
import { db } from "../../firebaseConfig";
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  query,
  orderBy,
} from "firebase/firestore";

export default function ManageAssignments() {
  const [asignaciones, setAsignaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  // mapas para mostrar nombres bonitos
  const [operatorMap, setOperatorMap] = useState({});
  const [equipmentMap, setEquipmentMap] = useState({});

  // ─────────────────────────────
  // CARGA DE ASIGNACIONES + OPERADORES + EQUIPOS
  // ─────────────────────────────
  useEffect(() => {
    const fetchData = async () => {
      try {
        setCargando(true);

        const [assignSnap, opsSnap, eqSnap] = await Promise.all([
          getDocs(
            query(collection(db, "assignments"), orderBy("createdAt", "desc"))
          ),
          getDocs(collection(db, "operators")),
          getDocs(collection(db, "equipment")),
        ]);

        const data = assignSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          createdAt: d.data().createdAt?.toDate?.() || new Date(),
        }));
        setAsignaciones(data);

        // mapa operadores
        const ops = {};
        opsSnap.forEach((d) => {
          ops[d.id] = d.data();
        });
        setOperatorMap(ops);

        // mapa equipos
        const eqs = {};
        eqSnap.forEach((d) => {
          eqs[d.id] = d.data();
        });
        setEquipmentMap(eqs);
      } catch (err) {
        console.error("Error cargando asignaciones:", err);
        setError("Error al cargar las asignaciones");
      } finally {
        setCargando(false);
      }
    };

    fetchData();
  }, []);

  // ─────────────────────────────
  // HELPERS PARA MOSTRAR TEXTOS
  // ─────────────────────────────
  const getOperatorLabel = (row) => {
    const fallback = row.operador || row.operatorId || "-";
    if (row.operatorId && operatorMap[row.operatorId]) {
      const op = operatorMap[row.operatorId];
      if (!op) return fallback;
      return op.codigo ? `${op.name} (${op.codigo})` : op.name;
    }
    return fallback;
  };

  const getEquipmentLabel = (row) => {
    const fallback = row.equipo || row.equipmentId || "-";
    if (row.equipmentId && equipmentMap[row.equipmentId]) {
      const eq = equipmentMap[row.equipmentId];
      if (!eq) return fallback;
      return eq.codigo ? `${eq.name} (${eq.codigo})` : eq.name;
    }
    return fallback;
  };

  const getRequester = (row) =>
    row.requestedBy || row.solicitante || row.solicitadoPor || "-";

  // ─────────────────────────────
  // ELIMINAR ASIGNACIÓN (solo pendiente)
  // ─────────────────────────────
  const handleDelete = async (id) => {
    const asignacion = asignaciones.find((a) => a.id === id);
    if (!asignacion) return;

    const estadosBloqueados = ["en_progreso", "pausado", "finalizado"];

    if (estadosBloqueados.includes(asignacion.status)) {
      alert(
        "⚠️ No se puede eliminar esta asignación porque está en progreso, pausada o finalizada."
      );
      return;
    }

    if (
      !confirm(
        "¿Estás seguro de que deseas eliminar esta asignación? Esta acción no se puede deshacer."
      )
    )
      return;

    try {
      await deleteDoc(doc(db, "assignments", id));
      setAsignaciones((prev) => prev.filter((a) => a.id !== id));
    } catch (error) {
      console.error("Error eliminando asignación:", error);
      alert("❌ Hubo un error al eliminar la asignación");
    }
  };

  const formatDate = (date) => {
    if (!date) return "-";
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString("es-CO");
  };

  // ─────────────────────────────
  // ESTADOS CARGA / ERROR (fuera del modal)
  // ─────────────────────────────
  if (cargando) {
    return (
      <section style={sectionWrapper}>
        <h2 style={title}>Gestión de Asignaciones</h2>
        <p style={subtitle}>Cargando asignaciones...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section style={sectionWrapper}>
        <h2 style={title}>Gestión de Asignaciones</h2>
        <p style={{ ...subtitle, color: "#fca5a5" }}>❌ {error}</p>
      </section>
    );
  }

  return (
    <>
      {/* Bloque compacto en la página */}
      <section style={sectionWrapper}>
        <div style={headerRow}>
          <div>
            <h2 style={title}>Gestión de Asignaciones</h2>
            <p style={subtitle}>
              Aquí solo puedes eliminar asignaciones que aún estén{" "}
              <strong style={{ color: "#fde68a" }}>pendientes</strong>.
            </p>
          </div>

          <div style={rightInfo}>
            <span style={badgeCount}>
              📋 {asignaciones.length} asignaciones
            </span>
            <button style={btnOpen} onClick={() => setOpen(true)}>
              🧹 Abrir gestor
            </button>
          </div>
        </div>
      </section>

      {/* MODAL CON TARJETAS */}
      {open && (
        <div style={overlay}>
          <div style={modal}>
            {/* HEADER MODAL */}
            <div style={modalHeader}>
              <div>
                <h3 style={modalTitle}>Gestor de Asignaciones</h3>
                <p style={modalSubtitle}>
                  Revisa el estado y elimina únicamente las asignaciones
                  pendientes. Las demás quedan bloqueadas por historial.
                </p>
              </div>
              <button style={btnClose} onClick={() => setOpen(false)}>
                ✕
              </button>
            </div>

            {/* CONTENIDO MODAL */}
            {asignaciones.length === 0 ? (
              <div style={emptyBox}>
                <div style={{ fontSize: 32 }}>📭</div>
                <p style={{ marginTop: 8, color: "#6b7280" }}>
                  No hay asignaciones registradas.
                </p>
              </div>
            ) : (
              <div style={cardsScroll}>
                {asignaciones.map((row) => {
                  const operador = getOperatorLabel(row);
                  const equipo = getEquipmentLabel(row);
                  const actividad = row.activity || "-";
                  const solicitante = getRequester(row);

                  // Estilos por estado
                  let statusStyle = statusPending;
                  let statusText = "Pendiente";
                  let statusIcon = "⏳";

                  if (row.status === "en_progreso") {
                    statusStyle = statusProgress;
                    statusText = "En progreso";
                    statusIcon = "🔄";
                  } else if (row.status === "pausado") {
                    statusStyle = statusPaused;
                    statusText = "Pausado";
                    statusIcon = "⏸️";
                  } else if (row.status === "finalizado") {
                    statusStyle = statusDone;
                    statusText = "Finalizado";
                    statusIcon = "✅";
                  }

                  return (
                    <article key={row.id} style={card}>
                      {/* fila superior */}
                      <div style={cardTopRow}>
                        <div>
                          <p style={label}>Fecha</p>
                          <p style={valueStrong}>{formatDate(row.createdAt)}</p>
                        </div>

                        <div style={statusStyle}>
                          <span style={{ fontSize: 14, marginRight: 4 }}>
                            {statusIcon}
                          </span>
                          <span style={{ fontSize: 12 }}>{statusText}</span>
                        </div>
                      </div>

                      {/* contenido principal */}
                      <div style={cardBody}>
                        <div style={cardRow}>
                          <span style={label}>Operador</span>
                          <span style={value}>{operador}</span>
                        </div>

                        <div style={cardRow}>
                          <span style={label}>Equipo</span>
                          <span style={value}>{equipo}</span>
                        </div>

                        <div style={cardRow}>
                          <span style={label}>Actividad</span>
                          <span style={value}>{actividad}</span>
                        </div>

                        <div style={cardRow}>
                          <span style={label}>Solicitado por</span>
                          <span style={value}>{solicitante}</span>
                        </div>
                      </div>

                      {/* pie tarjeta */}
                      <div style={cardFooter}>
                        <span style={idText}>
                          ID asignación:{" "}
                          <span style={idMono}>
                            {row.id.length > 18
                              ? row.id.slice(0, 18) + "…"
                              : row.id}
                          </span>
                        </span>

                        {row.status === "pendiente" ? (
                          <button
                            style={btnDelete}
                            onClick={() => handleDelete(row.id)}
                          >
                            🗑️ Eliminar
                          </button>
                        ) : (
                          <span style={lockPill} title="Asignación protegida">
                            🔒 Bloqueada
                          </span>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/* ─────────────────────────────
   ESTILOS INLINE
   ───────────────────────────── */

const sectionWrapper = {
  marginTop: 24,
  padding: 16,
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.12)",
  background:
    "linear-gradient(135deg, rgba(15,23,42,0.18), rgba(88,28,135,0.15))",
  boxShadow: "0 10px 30px rgba(15,23,42,0.30)",
};

const headerRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  flexWrap: "wrap",
};

const title = {
  fontSize: 22,
  fontWeight: 800,
  color: "#f9fafb",
  margin: 0,
};

const subtitle = {
  margin: "6px 0 0",
  fontSize: 13,
  color: "rgba(226,232,240,0.85)",
};

const rightInfo = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  gap: 8,
};

const badgeCount = {
  fontSize: 12,
  padding: "4px 10px",
  borderRadius: 999,
  border: "1px solid rgba(148,163,184,0.5)",
  background: "rgba(15,23,42,0.6)",
  color: "#e5e7eb",
};

const btnOpen = {
  padding: "8px 14px",
  borderRadius: 999,
  border: "none",
  background:
    "linear-gradient(135deg, rgb(59,130,246), rgb(147,51,234))",
  color: "#fff",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  boxShadow: "0 6px 16px rgba(37,99,235,0.45)",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
};

/* MODAL */

const overlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(15,23,42,0.65)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 100,
  padding: 12,
};

const modal = {
  width: "100%",
  maxWidth: 950,
  maxHeight: "86vh",
  background: "#f9fafb",
  borderRadius: 20,
  boxShadow: "0 18px 45px rgba(15,23,42,0.45)",
  padding: 20,
  display: "flex",
  flexDirection: "column",
};

const modalHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  paddingBottom: 12,
  borderBottom: "1px solid #e5e7eb",
};

const modalTitle = {
  fontSize: 20,
  fontWeight: 800,
  color: "#0f172a",
  margin: 0,
};

const modalSubtitle = {
  marginTop: 4,
  fontSize: 13,
  color: "#6b7280",
};

const btnClose = {
  border: "none",
  background: "transparent",
  fontSize: 20,
  cursor: "pointer",
  color: "#6b7280",
};

const cardsScroll = {
  marginTop: 12,
  paddingTop: 4,
  overflowY: "auto",
  paddingRight: 6,
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const emptyBox = {
  marginTop: 24,
  padding: 40,
  borderRadius: 16,
  background: "#f3f4f6",
  textAlign: "center",
};

/* TARJETAS */

const card = {
  borderRadius: 16,
  padding: 14,
  background:
    "linear-gradient(135deg, #ffffff, #eff6ff)",
  boxShadow: "0 4px 14px rgba(15,23,42,0.12)",
  display: "flex",
  flexDirection: "column",
  gap: 10,
  border: "1px solid #e5e7eb",
};

const cardTopRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const label = {
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#9ca3af",
};

const valueStrong = {
  fontSize: 14,
  fontWeight: 700,
  color: "#111827",
  marginTop: 2,
};

const value = {
  fontSize: 13,
  color: "#111827",
};

const cardBody = {
  display: "grid",
  gridTemplateColumns: "auto 1fr",
  columnGap: 16,
  rowGap: 4,
};

const cardRow = {
  display: "contents",
};

const cardFooter = {
  borderTop: "1px dashed #e5e7eb",
  marginTop: 6,
  paddingTop: 6,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
};

const idText = {
  fontSize: 11,
  color: "#6b7280",
};

const idMono = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas",
  fontSize: 10,
  background: "#e5e7eb",
  padding: "2px 4px",
  borderRadius: 999,
};

/* ESTADOS */

const baseStatus = {
  display: "inline-flex",
  alignItems: "center",
  padding: "4px 10px",
  borderRadius: 999,
  fontWeight: 600,
  borderWidth: 1,
  borderStyle: "solid",
};

const statusPending = {
  ...baseStatus,
  backgroundColor: "#fef9c3",
  color: "#854d0e",
  borderColor: "#facc15",
};

const statusProgress = {
  ...baseStatus,
  backgroundColor: "#dcfce7",
  color: "#166534",
  borderColor: "#22c55e",
};

const statusPaused = {
  ...baseStatus,
  backgroundColor: "#fee2e2",
  color: "#b91c1c",
  borderColor: "#f97373",
};

const statusDone = {
  ...baseStatus,
  backgroundColor: "#e0f2fe",
  color: "#075985",
  borderColor: "#38bdf8",
};

/* BOTONES FOOTER */

const btnDelete = {
  padding: "6px 12px",
  borderRadius: 999,
  border: "none",
  backgroundColor: "#fee2e2",
  color: "#b91c1c",
  fontSize: 12,
  fontWeight: 600,
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  cursor: "pointer",
};

const lockPill = {
  padding: "6px 12px",
  borderRadius: 999,
  border: "1px solid #d1d5db",
  backgroundColor: "#f3f4f6",
  color: "#6b7280",
  fontSize: 11,
  fontWeight: 600,
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
};
