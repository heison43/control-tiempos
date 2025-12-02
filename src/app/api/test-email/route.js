import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function GET() {
  try {
    console.log("🔍 Probando configuración de Gmail...");
    console.log("📧 Usuario:", process.env.EMAIL_USER);
    console.log("📧 Contraseña:", process.env.EMAIL_PASS ? "Configurada" : "NO configurada");
    
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      tls: {
        rejectUnauthorized: false
      }
    });
    
    console.log("🔌 Conectando a Gmail (puerto 465)...");
    await transporter.verify();
    console.log("✅ Conexión exitosa!");
    
    return NextResponse.json({ 
      success: true, 
      message: 'Conexión Gmail OK - Puerto 465',
      user: process.env.EMAIL_USER 
    });
    
  } catch (error) {
    console.error("❌ Error de conexión:", error.message);
    console.error("❌ Código:", error.code);
    
    return NextResponse.json({ 
      success: false, 
      error: `Error: ${error.message}`,
      code: error.code,
      suggestion: "Prueba: 1) Verificar contraseña 2) Desactivar firewall 3) Usar red móvil"
    }, { status: 500 });
  }
}