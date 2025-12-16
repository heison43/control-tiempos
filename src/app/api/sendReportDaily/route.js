// src/app/api/sendReportDaily/route.js
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { Buffer } from "buffer";

// Ajusta esta ruta si tu firebaseConfig está en otro sitio
import { db } from "../../../firebaseConfig";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
} from "firebase/firestore";

export const runtime = "nodejs";

const resend = new Resend(process.env.RESEND_API_KEY);

// ───────────────────────── Helpers ─────────────────────────

function getTodayRange() {
  const now = new Date();

  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0
  );
  const end = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999
  );

  return { start, end };
}

function formatDate(value) {
  if (!value) return "";
  if (value.toDate) {
    return value.toDate().toLocaleDateString("es-CO");
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("es-CO");
}

function formatTime(value) {
  if (!value) return "";
  if (value.toDate) {
    return value.toDate().toLocaleTimeString("es-CO", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function csvEscape(value) {
  const str = String(value ?? "").replace(/"/g, '""');
  return `"${str}"`;
}

async function generateTodayCsv() {
  const { start, end } = getTodayRange();

  // ⚠️ Ajusta "assignments" y "fecha" a tu colección/campo reales
  const colRef = collection(db, "assignments");

  const q = query(
    colRef,
    where("fecha", ">=", start),
    where("fecha", "<=", end),
    orderBy("fecha", "asc")
  );

  const snap = await getDocs(q);

  const rows = [];

  rows.push([
    "Fecha",
    "Operador",
    "Equipo",
    "Actividad",
    "Lugar",
    "Estado",
    "Inicio",
    "Fin",
    "Duración",
    "Notas",
  ]);

  snap.forEach((doc) => {
    const data = doc.data();

    rows.push([
      formatDate(data.fecha),
      data.operador ?? "",
      data.equipo ?? "",
      data.actividad ?? "",
      data.lugar ?? "",
      data.estado ?? "",
      formatTime(data.inicio),
      formatTime(data.fin),
      data.duracion ?? "",
      data.notas ?? "",
    ]);
  });

  const csv = rows
    .map((row) => row.map(csvEscape).join(";"))
    .join("\n");

  return { csv, count: snap.size };
}

function getRecipients() {
  const raw = process.env.REPORT_EMAILS;

  if (!raw) {
    return ["heisonyepes43@outlook.com"];
  }

  return raw
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
}

// ───────────────── Handler compartido ─────────────────

async function sendDailyReport() {
  try {
    console.log("⏰ Iniciando envío de reporte diario automático...");

    const now = new Date();
    const { csv, count } = await generateTodayCsv();

    console.log(`📄 Asignaciones encontradas para hoy: ${count}`);

    const fileName = `asignaciones_${now
      .toISOString()
      .slice(0, 10)}.csv`;

    const subject = `📊 Reporte Diario Automático - ${now.toLocaleDateString(
      "es-CO"
    )}`;

    const htmlContent = `
      <h2>📊 Reporte Diario Automático</h2>
      <p><strong>Fecha del reporte:</strong> ${now.toLocaleDateString(
        "es-CO"
      )}</p>
      <p><strong>Hora de envío:</strong> ${now.toLocaleTimeString(
        "es-CO"
      )}</p>
      <p><strong>Total de asignaciones del día:</strong> ${count}</p>
      <p><strong>Tipo:</strong> Envío automático programado</p>
      <hr/>
      <p><em>Este reporte fue generado automáticamente por el sistema de Gestión de Equipos.</em></p>
    `;

    const recipients = getRecipients();
    const fromEmail =
      process.env.RESEND_FROM ||
      'Reportes MiningSoft <yepes@yepesdevstudio.com>';

    console.log("👉 FROM:", fromEmail);
    console.log("👉 TO:", recipients);

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: recipients,
      subject,
      html: htmlContent,
      attachments: [
        {
          filename: fileName,
          content: Buffer.from(csv, "utf-8"),
          contentType: "text/csv",
        },
      ],
    });

    if (error) {
      console.error("❌ Error Resend (daily):", error);
      return NextResponse.json(
        {
          success: false,
          error: error.message || "Error enviando correo diario (Resend)",
        },
        { status: 500 }
      );
    }

    console.log("✅ Reporte diario enviado correctamente. ID:", data.id);

    return NextResponse.json({
      success: true,
      message: "Reporte diario enviado exitosamente",
      id: data.id,
      count,
    });
  } catch (err) {
    console.error("❌ Error en /api/sendReportDaily:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Error interno generando reporte diario",
      },
      { status: 500 }
    );
  }
}

// ────────── Exportamos POST y GET usando el mismo handler ──────────

export async function POST() {
  return sendDailyReport();
}

export async function GET() {
  // Solo para pruebas desde el navegador
  return sendDailyReport();
}
