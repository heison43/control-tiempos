'use client';

import { useState, useEffect } from "react";
import { db } from "../../firebaseConfig";
import {
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

import {
  Cog6ToothIcon,
  PlusIcon,
  TrashIcon,
  PencilSquareIcon,
  XMarkIcon
} from "@heroicons/react/24/outline";

/* ---------------- HELPERS ---------------- */
function normEmail(v) {
  return (v || "").trim().toLowerCase();
}

function normOpId(v) {
  return (v || "").trim().toUpperCase(); // OP003
}

export default function ManageBasicData() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("operators");

  const [operators, setOperators] = useState([]);
  const [equipment, setEquipment] = useState([]);

  // Crear operador
  const [opName, setOpName] = useState("");
  const [opCode, setOpCode] = useState("");
  const [opEmail, setOpEmail] = useState("");

  // Crear equipo
  const [eqName, setEqName] = useState("");
  const [eqCode, setEqCode] = useState("");

  // Editar
  const [editing, setEditing] = useState(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editEmail, setEditEmail] = useState("");

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

  /* ---------------- OPERATORS (FIX) ----------------
     ✅ operators/{OP003} (ID = código)
     ✅ users/{email} creado/actualizado para login
  */
  const createOperator = async () => {
    const name = opName.trim();
    const operatorId = normOpId(opCode);
    const email = normEmail(opEmail);

    if (!name) return alert("Ingresa un nombre");
    if (!operatorId) return alert("Ingresa un código (ej: OP003)");
    if (!email) return alert("Ingresa el correo de acceso");

    // 1) operators/{OP003}
    await setDoc(
      doc(db, "operators", operatorId),
      {
        name,
        codigo: operatorId,
        authEmail: email,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    // 2) users/{email}
    await setDoc(
      doc(db, "users", email),
      {
        email,
        role: "operator",
        operatorId, // OP003
        isActive: true,
        name,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    setOpName("");
    setOpCode("");
    setOpEmail("");
  };

  // Crear equipo (puede seguir con addDoc normal)
  const createEquipment = async () => {
    if (!eqName.trim()) return alert("Ingresa un nombre");
    await addDoc(collection(db, "equipment"), {
      name: eqName.trim(),
      codigo: eqCode.trim(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
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
    setEditName(item.name || "");
    setEditCode(item.codigo || item.id || ""); // si no trae codigo, mostramos el id
    setEditEmail(item.authEmail || "");
  };

  // Guardar edición
  const saveEdit = async () => {
    if (!editing) return;

    const isOp = editing.type === "op";
    const name = editName.trim();
    const code = normOpId(editCode);
    const email = normEmail(editEmail);

    if (!name) return alert("Ingresa un nombre");

    if (isOp) {
      // ✅ IMPORTANTE: NO cambiar el ID del operador.
      // El doc ID debe ser OPxxx (editing.id). Solo actualizamos datos.
      const ref = doc(db, "operators", editing.id);

      await updateDoc(ref, {
        name,
        authEmail: email || null,
        updatedAt: serverTimestamp(),
      });

      // sincronizar users/{email} si hay correo
      if (email) {
        await setDoc(
          doc(db, "users", email),
          {
            email,
            role: "operator",
            operatorId: editing.id, // OP003 real
            isActive: true,
            name,
            updatedAt: serverTimestamp(),
            createdAt: serverTimestamp(),
          },
          { merge: true }
        );
      }

      setEditing(null);
      return;
    }

    // equipment sí puede actualizar código normal
    const ref = doc(db, "equipment", editing.id);

    await updateDoc(ref, {
      name,
      codigo: code,
      updatedAt: serverTimestamp(),
    });

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
                      placeholder="Código (OP001)"
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
                  <div style={listContainer}>
                    {operators.map((op) => (
                      <div key={op.id} style={item}>
                        <div>
                          {op.name} {(op.codigo || op.id) && ` (${op.codigo || op.id})`}
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

                  <div style={listContainer}>
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
                    placeholder="Nombre"
                  />

                  {/* Código: para operadores NO se puede cambiar (para no romper el ID) */}
                  <input
                    value={editCode}
                    onChange={(e) => setEditCode(e.target.value)}
                    style={{
                      ...input,
                      opacity: editing.type === "op" ? 0.6 : 1,
                      cursor: editing.type === "op" ? "not-allowed" : "text",
                    }}
                    disabled={editing.type === "op"}
                    placeholder="Código"
                    title={
                      editing.type === "op"
                        ? "No se puede cambiar el código del operador (es el ID del documento)"
                        : "Código"
                    }
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
  width: "94%",
  maxWidth: 700,
  maxHeight: "90vh",
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

const formRow = {
  display: "flex",
  gap: 10,
  marginBottom: 12,
  flexWrap: "wrap",
  alignItems: "stretch",
};

const input = {
  flex: "1 1 150px",
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
