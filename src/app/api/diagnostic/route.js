// /src/app/api/diagnostic/route.js
import { NextResponse } from "next/server";

export async function GET() {
  const results = {
    env_variables: {
      EMAIL_USER: process.env.EMAIL_USER ? "✅ Configurado" : "❌ No configurado",
      EMAIL_PASS: process.env.EMAIL_PASS ? "✅ Configurado" : "❌ No configurado",
      EMAIL_PASS_LENGTH: process.env.EMAIL_PASS ? process.env.EMAIL_PASS.length : 0,
      REPORT_EMAIL: process.env.REPORT_EMAIL ? "✅ Configurado" : "❌ No configurado"
    },
    timestamp: new Date().toISOString(),
    node_version: process.version
  };
  
  return NextResponse.json(results);
}