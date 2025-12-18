// src/hooks/useBrowserNotifications.js
import { useEffect, useState } from "react";

// Hook para manejar permiso del navegador
export function useNotificationPermission() {
  const [permission, setPermission] = useState("default");
  const [hasSupport, setHasSupport] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const isSupported = "Notification" in window;
    setHasSupport(isSupported);

    if (isSupported) {
      // Sync inicial del permiso real del navegador
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async () => {
    if (!hasSupport) {
      console.warn("Este navegador no soporta notificaciones");
      return;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result; // por si lo quieres usar afuera
    } catch (error) {
      console.error("Error al solicitar permiso de notificaciones:", error);
    }
  };

  return { permission, hasSupport, requestPermission };
}

// Función para mostrar la notificación
export function showBrowserNotification(title, options = {}) {
  if (typeof window === "undefined") return;
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  new Notification(title, {
    icon: options.icon,
    body: options.body,
    ...options,
  });
}
