'use client';

import { useEffect, useState } from "react";
import { db } from "../../firebaseConfig";
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  query,
  orderBy
} from "firebase/firestore";

export default function ManageAssignments() {
  const [asignaciones, setAsignaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setCargando(true);
        const q = query(collection(db, "assignments"), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        const data = snap.docs.map(d => ({ 
          id: d.id, 
          ...d.data(),
          createdAt: d.data().createdAt?.toDate?.() || new Date()
        }));
        setAsignaciones(data);
      } catch (err) {
        console.error("Error cargando asignaciones:", err);
        setError("Error al cargar las asignaciones");
      } finally {
        setCargando(false);
      }
    };
    fetchData();
  }, []);

  // 🔥 FUNCIÓN MEJORADA PARA BORRAR CON VALIDACIÓN DE ESTADO
  const handleDelete = async (id) => {
    const asignacion = asignaciones.find(a => a.id === id);
    if (!asignacion) return;

    // ESTADOS QUE BLOQUEAN ELIMINACIÓN
    const estadosBloqueados = ["en_progreso", "pausado", "finalizado"];

    if (estadosBloqueados.includes(asignacion.status)) {
      alert("⚠️ No se puede eliminar esta asignación porque está en progreso, pausada o finalizada.");
      return;
    }

    if (!confirm("¿Estás seguro de que deseas eliminar esta asignación? Esta acción no se puede deshacer.")) return;

    try {
      await deleteDoc(doc(db, "assignments", id));
      setAsignaciones(asignaciones.filter(a => a.id !== id));
      // Podrías agregar un toast de éxito aquí
    } catch (error) {
      console.error("Error eliminando asignación:", error);
      alert("❌ Hubo un error al eliminar la asignación");
    }
  };

  // Formatear fecha
  const formatDate = (date) => {
    if (!date) return '-';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('es-CO');
  };

  if (cargando) {
    return (
      <div className="bg-white p-6 rounded-xl shadow-md mt-4">
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Cargando asignaciones...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white p-6 rounded-xl shadow-md mt-4">
        <div className="text-center text-red-600 py-4">
          ❌ {error}
        </div>
      </div>
    );
  }

  return (
    <section className="bg-white p-6 rounded-xl shadow-md mt-4 border border-gray-200">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Gestión de Asignaciones</h2>
        <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
          {asignaciones.length} asignaciones
        </span>
      </div>

      {asignaciones.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <div className="text-4xl mb-2">📋</div>
          <p>No hay asignaciones registradas</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gradient-to-r from-gray-50 to-gray-100 text-left">
                <th className="px-4 py-3 font-semibold text-gray-700 border-b">Operador</th>
                <th className="px-4 py-3 font-semibold text-gray-700 border-b">Equipo</th>
                <th className="px-4 py-3 font-semibold text-gray-700 border-b">Actividad</th>
                <th className="px-4 py-3 font-semibold text-gray-700 border-b">Fecha</th>
                <th className="px-4 py-3 font-semibold text-gray-700 border-b">Estado</th>
                <th className="px-4 py-3 font-semibold text-gray-700 border-b text-center">Acción</th>
              </tr>
            </thead>

            <tbody>
              {asignaciones.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 border-b">
                    <div className="font-medium text-gray-900">
                      {row.operatorId || row.operador || '-'}
                    </div>
                  </td>
                  <td className="px-4 py-3 border-b">
                    <div className="font-medium text-gray-900">
                      {row.equipmentId || row.equipo || '-'}
                    </div>
                  </td>
                  <td className="px-4 py-3 border-b">
                    <div className="max-w-xs truncate text-gray-600" title={row.activity}>
                      {row.activity || '-'}
                    </div>
                  </td>
                  <td className="px-4 py-3 border-b text-gray-600">
                    {formatDate(row.createdAt)}
                  </td>

                  <td className="px-4 py-3 border-b">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                        row.status === "pendiente" 
                          ? "bg-yellow-100 text-yellow-800 border border-yellow-200" :
                        row.status === "en_progreso" 
                          ? "bg-blue-100 text-blue-800 border border-blue-200" :
                        row.status === "pausado" 
                          ? "bg-orange-100 text-orange-800 border border-orange-200" :
                        "bg-green-100 text-green-800 border border-green-200"
                      }`}
                    >
                      {row.status === "pendiente" && "⏳"}
                      {row.status === "en_progreso" && "🔄"}
                      {row.status === "pausado" && "⏸️"}
                      {row.status === "finalizado" && "✅"}
                      <span className="ml-1 capitalize">
                        {row.status?.replace('_', ' ') || 'pendiente'}
                      </span>
                    </span>
                  </td>

                  {/* 🔥 BOTÓN O CANDADO SEGÚN ESTADO */}
                  <td className="px-4 py-3 border-b text-center">
                    {row.status === "pendiente" ? (
                      <button
                        onClick={() => handleDelete(row.id)}
                        className="inline-flex items-center justify-center w-8 h-8 text-red-500 hover:bg-red-50 hover:text-red-700 rounded-full transition-all duration-200"
                        title="Eliminar asignación"
                      >
                        🗑️
                      </button>
                    ) : (
                      <span
                        className="inline-flex items-center justify-center w-8 h-8 text-gray-400 cursor-not-allowed"
                        title={`No se puede eliminar - Estado: ${row.status}`}
                      >
                        🔒
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}