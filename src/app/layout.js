// src/app/layout.js
import "./globals.css";
import PwaInstallPrompt from "../components/PwaInstallPrompt";

export const metadata = {
  title: "Gestión de Equipos",
  description: "Sistema de control de tiempos",
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
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#4c1d95" />
      </head>
      <body>
        {children}
        <PwaInstallPrompt />
      </body>
    </html>
  );
}
