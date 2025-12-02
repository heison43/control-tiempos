// app/api/export-report/route.js
import { NextResponse } from "next/server";
import { db } from "../../../firebaseConfig";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import nodemailer from "nodemailer";

export const runtime = "nodejs";

function createTransporter() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error("EMAIL_USER o EMAIL_PASS no están configurados");
  }

  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    requireTLS: true,
  });
}

export async function POST(request) {
  try {
    const { startDate, endDate, email } = await request.json();

    console.log("📤 Exportación manual solicitada");

    let q = query(collection(db, "assignments"), orderBy("createdAt", "desc"));

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      q = query(
        collection(db, "assignments"),
        where("createdAt", ">=", start),
        where("createdAt", "<=", end),
        orderBy("createdAt", "desc")
      );
    }

    const snap = await getDocs(q);
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    console.log(`📊 ${data.length} asignaciones para exportar`);

    if (data.length === 0) {
      return NextResponse.json({
        success: false,
        message: "No hay asignaciones en el rango seleccionado",
      });
    }

    const transporter = createTransporter();

    const header = [
      "Fecha",
      "Operador",
      "Equipo",
      "Actividad",
      "Lugar",
      "Estado",
      "Inicio",
      "Fin",
      "Duración",
    ];
    const rows = data.map((a) => [
      a.createdAt?.toDate ? a.createdAt.toDate().toLocaleDateString("es-CO") : "-",
      a.operatorId || "-",
      a.equipmentId || "-",
      a.activity || "-",
      a.location || "-",
      a.status || "-",
      a.startTime?.toDate ? a.startTime.toDate().toLocaleTimeString("es-CO") : "-",
      a.endTime?.toDate ? a.endTime.toDate().toLocaleTimeString("es-CO") : "-",
      a.durationMinutes ?? "-",
    ]);

    const csvContent = [header, ...rows].map((r) => r.join(",")).join("\n");

    const now = new Date();
    const fileName = `reporte_exportado_${now.toISOString().split("T")[0]}.csv`;

    const inProgress = data.filter((a) => a.status === "en_progreso").length;
    const completed = data.filter((a) => a.status === "finalizado").length;

    const mailOptions = {
      from: `"Sistema de Control" <${process.env.EMAIL_USER}>`,
      to: email || "heisonyepes43@outlook.com",
      subject: `📊 Reporte Exportado - ${now.toLocaleDateString("es-CO")}`,
      html: `
        <h2>📊 Reporte Exportado</h2>
        <p><strong>Fecha exportación:</strong> ${now.toLocaleDateString("es-CO")}</p>
        <p><strong>Total asignaciones:</strong> ${data.length}</p>
        <p><strong>En progreso:</strong> ${inProgress}</p>
        <p><strong>Finalizadas:</strong> ${completed}</p>
        <p><strong>Archivo adjunto:</strong> ${fileName}</p>
        <hr>
        <p><em>Exportación manual desde el panel admin</em></p>
      `,
      attachments: [
        {
          filename: fileName,
          content: csvContent,
          contentType: "text/csv",
        },
      ],
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Reporte exportado enviado:", info.messageId);

    return NextResponse.json({
      success: true,
      message: `📧 Reporte exportado con ${data.length} asignaciones`,
      messageId: info.messageId,
    });
  } catch (err) {
    console.error("❌ Error exportando:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Error desconocido al exportar",
      },
      { status: 500 }
    );
  }
}
