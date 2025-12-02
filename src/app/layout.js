// src/app/layout.js
import AuthGate from "../components/AuthGate";
import "./globals.css";
import PwaInstallPrompt from "../components/PwaInstallPrompt";

export const metadata = {
  title: "Control Tiempos",
  description: "Sistema de control de tiempos",
  // 👇 Esto le dice a Next dónde está el manifest PWA
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icons/icon-192x192.png",
    apple: "/icons/icon-192x192.png",
  },
  themeColor: "#4c1d95",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        {/* Extra por si acaso: algunos navegadores ignoran el metadata.manifest */}
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#4c1d95" />
      </head>
      <body>
        <AuthGate>{children}</AuthGate>

        {/* Botón flotante para instalar la PWA cuando esté disponible */}
        <PwaInstallPrompt />
      </body>
    </html>
  );
}
