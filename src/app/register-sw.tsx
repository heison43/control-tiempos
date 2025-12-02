"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      // En localhost y en producción con HTTPS
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/service-worker.js")
          .then((reg) => {
            console.log("[SW] Registrado con scope:", reg.scope);
          })
          .catch((err) => {
            console.error("[SW] Error al registrar:", err);
          });
      });
    }
  }, []);

  return null;
}
