// /src/app/api/test-gmail-advanced/route.js
import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function GET() {
  try {
    console.log("🔍 Probando configuración avanzada de Gmail...");
    
    // Opción 1: Puerto 465 con SSL
    let transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true, // true para 465
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000
    });

    console.log("🔌 Probando puerto 465 (SSL)...");
    
    try {
      await transporter.verify();
      console.log("✅ Puerto 465 funciona!");
      
      // Probar envío real
      const info = await transporter.sendMail({
        from: `"Prueba" <${process.env.EMAIL_USER}>`,
        to: process.env.REPORT_EMAIL,
        subject: 'Prueba de correo - Puerto 465',
        text: 'Esta es una prueba del puerto 465',
        html: '<p>Esta es una prueba del puerto 465</p>'
      });
      
      return NextResponse.json({ 
        success: true, 
        message: 'Conexión exitosa con puerto 465',
        port: 465,
        messageId: info.messageId
      });
      
    } catch (error465) {
      console.log("❌ Puerto 465 falló:", error465.message);
      
      // Opción 2: Puerto 587 con STARTTLS
      transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false, // false para 587
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
        tls: {
          rejectUnauthorized: false
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 10000
      });
      
      console.log("🔌 Probando puerto 587 (STARTTLS)...");
      await transporter.verify();
      
      const info = await transporter.sendMail({
        from: `"Prueba" <${process.env.EMAIL_USER}>`,
        to: process.env.REPORT_EMAIL,
        subject: 'Prueba de correo - Puerto 587',
        text: 'Esta es una prueba del puerto 587',
        html: '<p>Esta es una prueba del puerto 587</p>'
      });
      
      return NextResponse.json({ 
        success: true, 
        message: 'Conexión exitosa con puerto 587',
        port: 587,
        messageId: info.messageId
      });
    }
    
  } catch (error) {
    console.error("❌ Todos los puertos fallaron:", error.message);
    
    // Diagnosticar el problema de red
    return NextResponse.json({
      success: false,
      error: error.message,
      code: error.code,
      suggestion: `
        PROBLEMA DE RED DETECTADO:
        
        1. Tu firewall/antivirus está bloqueando los puertos 465 y 587
        2. Tu red corporativa/proveedor bloquea conexiones SMTP
        3. Tu IP está temporalmente bloqueada por Google
        
        SOLUCIONES:
        1. Desactiva temporalmente el firewall/antivirus
        2. Prueba con una red móvil (hotspot del celular)
        3. Espera 24 horas y vuelve a intentar
        4. Usa un servicio de correo alternativo (SendGrid, Mailgun)
        
        SOLUCIÓN INMEDIATA:
        - Exporta el CSV localmente y envíalo manualmente
        - Configura una tarea programada en el servidor (si despliegas en Vercel)
      `
    }, { status: 500 });
  }
}