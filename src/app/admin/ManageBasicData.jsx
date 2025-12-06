'use client';

import { useState, useEffect } from "react";
import { db } from "../../firebaseConfig";
import {
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  onSnapshot
} from "firebase/firestore";

import {
  Cog6ToothIcon,
  PlusIcon,
  TrashIcon,
  PencilSquareIcon,
  XMarkIcon
} from "@heroicons/react/24/outline";

export default function ManageBasicData() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("operators");

  const [operators, setOperators] = useState([]);
  const [equipment, setEquipment] = useState([]);

  // Crear operador
  const [opName, setOpName] = useState("");
  const [opCode, setOpCode] = useState("");
  const [opEmail, setOpEmail] = useState(""); // 👈 NUEVO

  // Crear equipo
  const [eqName, setEqName] = useState("");
  const [eqCode, setEqCode] = useState("");

  // Editar
  const [editing, setEditing] = useState(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editEmail, setEditEmail] = useState(""); // 👈 NUEVO

  useEffect(() => {
    const unsubOps = onSnapshot(collection(db, "operators"), (snap) =>
      setOperators(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );

    const unsubEq = onSnapshot(collection(db, "equipment"), (snap) =>
      setEquipment(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );

    return () => {
      unsubOps();
      unsubEq();
    };
  }, []);

  // Crear operador
  const createOperator = async () => {
    if (!opName.trim()) return alert("Ingresa un nombre");

    await addDoc(collection(db, "operators"), {
      name: opName.trim(),
      codigo: opCode.trim(),
      authEmail: opEmail.trim() ? opEmail.trim().toLowerCase() : null, // 👈 NUEVO
    });

    setOpName("");
    setOpCode("");
    setOpEmail(""); // 👈 limpiar
  };

  // Crear equipo
  const createEquipment = async () => {
    if (!eqName.trim()) return alert("Ingresa un nombre");
    await addDoc(collection(db, "equipment"), {
      name: eqName.trim(),
      codigo: eqCode.trim(),
    });
    setEqName("");
    setEqCode("");
  };

  // Eliminar
  const deleteItem = async (id, type) => {
    const txt =
      type === "op"
        ? "¿Eliminar operador? Afectará asignaciones históricas."
        : "¿Eliminar equipo?";

    if (!confirm(txt)) return;

    await deleteDoc(doc(db, type === "op" ? "operators" : "equipment", id));
  };

  // Abrir modal de edición
  const enableEdit = (item, type) => {
    setEditing({ ...item, type });
    setEditName(item.name);
    setEditCode(item.codigo || "");
    setEditEmail(item.authEmail || ""); // 👈 NUEVO
  };

  // Guardar edición
  const saveEdit = async () => {
    const ref = doc(
      db,
      editing.type === "op" ? "operators" : "equipment",
      editing.id
    );

    const payload =
      editing.type === "op"
        ? {
            name: editName.trim(),
            codigo: editCode.trim(),
            authEmail: editEmail.trim()
              ? editEmail.trim().toLowerCase()
              : null,
          }
        : {
            name: editName.trim(),
            codigo: editCode.trim(),
          };

    await updateDoc(ref, payload);
    setEditing(null);
  };

  return (
    <>
      {/* BOTÓN DEL MODAL */}
      <button style={btnOpen} onClick={() => setOpen(true)}>
        <Cog6ToothIcon style={{ width: 24, marginRight: 8 }} />
        Configuración avanzada
      </button>

      {open && (
        <div style={overlay}>
          <div style={modal}>
            {/* Header */}
            <div style={modalHeader}>
              <h2 style={{ fontSize: 20, fontWeight: 700 }}>
                Panel de configuración
              </h2>
              <XMarkIcon
                onClick={() => setOpen(false)}
                style={{ width: 28, cursor: "pointer" }}
              />
            </div>

            {/* Tabs */}
            <div style={tabs}>
              <button
                style={activeTab === "operators" ? tabActive : tab}
                onClick={() => setActiveTab("operators")}
              >
                Operadores
              </button>

              <button
                style={activeTab === "equipment" ? tabActive : tab}
                onClick={() => setActiveTab("equipment")}
              >
                Equipos
              </button>
            </div>

            {/* CONTENIDO */}
            <div style={{ padding: "16px 0" }}>
              {/* TAB OPERADORES */}
              {activeTab === "operators" && (
                <>
                  {/* Crear */}
                  <div style={formRow}>
                    <input
                      placeholder="Nombre"
                      value={opName}
                      onChange={(e) => setOpName(e.target.value)}
                      style={input}
                    />
                    <input
                      placeholder="Código"
                      value={opCode}
                      onChange={(e) => setOpCode(e.target.value)}
                      style={input}
                    />
                    <input
                      placeholder="Correo de acceso"
                      value={opEmail}
                      onChange={(e) => setOpEmail(e.target.value)}
                      style={input}
                    />
                    <button style={btnAdd} onClick={createOperator}>
                      <PlusIcon style={{ width: 20 }} />
                    </button>
                  </div>

                  {/* Lista */}
                  <div style={listContainer}> {/* ⭐ NUEVO CONTENEDOR SCROLL */}
                    {operators.map((op) => (
                      <div key={op.id} style={item}>
                        <div>
                          {op.name} {op.codigo && `(${op.codigo})`}
                          {op.authEmail && (
                            <div style={{ fontSize: 12, color: "#4b5563" }}>
                              📧 {op.authEmail}
                            </div>
                          )}
                        </div>

                        <div style={{ display: "flex", gap: 12 }}>
                          <PencilSquareIcon
                            style={iconEdit}
                            onClick={() => enableEdit(op, "op")}
                          />
                          <TrashIcon
                            style={iconDelete}
                            onClick={() => deleteItem(op.id, "op")}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* TAB EQUIPOS */}
              {activeTab === "equipment" && (
                <>
                  <div style={formRow}>
                    <input
                      placeholder="Nombre"
                      value={eqName}
                      onChange={(e) => setEqName(e.target.value)}
                      style={input}
                    />
                    <input
                      placeholder="Código"
                      value={eqCode}
                      onChange={(e) => setEqCode(e.target.value)}
                      style={input}
                    />
                    <button style={btnAdd} onClick={createEquipment}>
                      <PlusIcon style={{ width: 20 }} />
                    </button>
                  </div>

                  <div style={listContainer}> {/* ⭐ MISMO CONTENEDOR */}
                    {equipment.map((eq) => (
                      <div key={eq.id} style={item}>
                        <div>
                          {eq.name} {eq.codigo && `(${eq.codigo})`}
                        </div>

                        <div style={{ display: "flex", gap: 12 }}>
                          <PencilSquareIcon
                            style={iconEdit}
                            onClick={() => enableEdit(eq, "equipment")}
                          />
                          <TrashIcon
                            style={iconDelete}
                            onClick={() => deleteItem(eq.id, "eq")}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Modal de edición */}
            {editing && (
              <div style={editOverlay}>
                <div style={editModal}>
                  <h3 style={{ marginBottom: 12 }}>Editar</h3>

                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    style={input}
                  />
                  <input
                    value={editCode}
                    onChange={(e) => setEditCode(e.target.value)}
                    style={input}
                  />
                  {editing.type === "op" && (
                    <input
                      placeholder="Correo de acceso"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      style={input}
                    />
                  )}

                  <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                    <button style={btnSave} onClick={saveEdit}>
                      Guardar
                    </button>
                    <button style={btnCancel} onClick={() => setEditing(null)}>
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/* ---------- ESTILOS ---------- */

const btnOpen = {
  width: "100%",
  background: "#2563eb",
  border: "none",
  padding: "12px",
  color: "#fff",
  borderRadius: 10,
  fontSize: 16,
  fontWeight: 600,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  boxShadow: "0 2px 6px rgba(37,99,235,0.3)",
  marginBottom: 20,
  cursor: "pointer",
};

const overlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.5)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 50,
};

const modal = {
  width: "94%",              // ⭐ un poco más ancho en pantallas chicas
  maxWidth: 700,             // ⭐ un pelín más grande
  maxHeight: "90vh",         // ⭐ para evitar que se salga de la pantalla
  overflow: "hidden",
  background: "#fff",
  padding: 24,
  borderRadius: 16,
  boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
  animation: "fadeIn 0.3s ease",
  display: "flex",
  flexDirection: "column",
};

const modalHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 12,
};

const tabs = {
  display: "flex",
  gap: 10,
  marginTop: 10,
};

const tab = {
  flex: 1,
  padding: "10px",
  background: "#e5e7eb",
  borderRadius: 8,
  fontWeight: 600,
  cursor: "pointer",
  border: "none",
};

const tabActive = {
  ...tab,
  background: "#2563eb",
  color: "#fff",
};

// ⭐ ahora los inputs pueden saltar a otra línea
const formRow = {
  display: "flex",
  gap: 10,
  marginBottom: 12,
  flexWrap: "wrap",
  alignItems: "stretch",
};

const input = {
  flex: "1 1 150px",   // ⭐ base 150px, se adapta al ancho disponible
  minWidth: 0,
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid #d1d5db",
  fontSize: 14,
  boxSizing: "border-box",
};

const btnAdd = {
  background: "#22c55e",
  border: "none",
  padding: 10,
  borderRadius: 8,
  cursor: "pointer",
  color: "#fff",
  flex: "0 0 auto",
  alignSelf: "stretch",
};

const item = {
  background: "#f3f4f6",
  padding: "10px 14px",
  borderRadius: 10,
  marginBottom: 8,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

// ⭐ contenedor scroll para listas largas
const listContainer = {
  marginTop: 4,
  maxHeight: 320,
  overflowY: "auto",
  paddingRight: 4,
};

const iconEdit = {
  width: 22,
  cursor: "pointer",
  color: "#2563eb",
};

const iconDelete = {
  width: 22,
  cursor: "pointer",
  color: "#dc2626",
};

const editOverlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.4)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 60,
};

const editModal = {
  width: "90%",
  maxWidth: 380,
  background: "#fff",
  padding: 20,
  borderRadius: 12,
  boxShadow: "0 8px 20px rgba(0,0,0,0.2)",
};

const btnSave = {
  flex: 1,
  background: "#2563eb",
  color: "#fff",
  borderRadius: 8,
  padding: "10px 12px",
  border: "none",
  cursor: "pointer",
  fontWeight: 600,
};

const btnCancel = {
  flex: 1,
  background: "#e5e7eb",
  color: "#111",
  borderRadius: 8,
  padding: "10px 12px",
  border: "none",
  cursor: "pointer",
  fontWeight: 600,
};
