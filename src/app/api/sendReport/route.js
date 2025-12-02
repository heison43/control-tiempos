// src/app/api/sendReport/route.js
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { Buffer } from "buffer";

export const runtime = "nodejs";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request) {
  try {
    const { fileName, csvContent, type } = await request.json();

    const now = new Date();

    let subject;
    let htmlContent;

    if (type === "daily") {
      subject = `📊 Reporte Diario Automático - ${now.toLocaleDateString("es-CO")}`;
      htmlContent = `
        <h2>📊 Reporte Diario Automático</h2>
        <p><strong>Fecha del reporte:</strong> ${now.toLocaleDateString("es-CO")}</p>
        <p><strong>Hora de envío:</strong> ${now.toLocaleTimeString("es-CO")}</p>
        <p><strong>Tipo:</strong> Envío automático programado</p>
        <hr/>
        <p><em>Este es un reporte automático generado por el sistema de control de tiempos.</em></p>
      `;
    } else {
      subject = `📊 Reporte de Asignaciones - ${now.toLocaleDateString("es-CO")}`;
      htmlContent = `
        <h2>📊 Reporte de Asignaciones</h2>
        <p><strong>Fecha de envío:</strong> ${now.toLocaleDateString("es-CO")}</p>
        <p><strong>Hora de envío:</strong> ${now.toLocaleTimeString("es-CO")}</p>
        <p><strong>Tipo:</strong> Envío manual desde panel</p>
        <hr/>
        <p><em>Reporte solicitado manualmente desde el panel de administración.</em></p>
      `;
    }

    // 🔹 Lista de correos desde variable de entorno
    // En .env.local:
    // REPORT_EMAILS="heisonyepes43@outlook.com, otro@correo.com, tercero@empresa.com"
    const emailsEnv =
      process.env.REPORT_EMAILS ||
      process.env.REPORT_EMAIL || // fallback por si tenías la anterior
      "heisonyepes43@outlook.com";

    const toEmails = emailsEnv
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);

    if (!toEmails.length) {
      throw new Error("No hay correos configurados en REPORT_EMAILS/REPORT_EMAIL");
    }

    const fromEmail =
      process.env.RESEND_FROM ||
      "Reportes MiningSoft <yepes@yepesdevstudio.com>";

    console.log("📤 Envío de correo solicitado");
    console.log("👉 TYPE:", type);
    console.log("👉 FILE:", fileName);
    console.log("👉 FROM:", fromEmail);
    console.log("👉 TO:", toEmails);

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: toEmails, // 👈 ahora es un array de correos
      subject,
      html: htmlContent,
      attachments: [
        {
          filename: fileName,
          content: Buffer.from(csvContent, "utf-8"),
          contentType: "text/csv",
        },
      ],
    });

    if (error) {
      console.error("❌ Error Resend:", error);
      return NextResponse.json(
        {
          success: false,
          error: error.message || "Error enviando correo (Resend)",
        },
        { status: 500 }
      );
    }

    console.log("✅ Correo enviado correctamente. ID:", data.id);

    return NextResponse.json({
      success: true,
      message: "Correo enviado exitosamente",
      id: data.id,
      type,
    });
  } catch (err) {
    console.error("❌ Error enviando correo:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Error interno" },
      { status: 500 }
    );
  }
}



