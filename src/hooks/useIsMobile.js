// src/hooks/useIsMobile.js
import { useEffect, useState } from "react";

/**
 * Hook para detectar si el usuario está en móvil según el ancho de la pantalla.
 * @param {number} breakpoint - Ancho máximo en px para considerar "móvil" (por defecto 768px)
 * @returns {boolean} isMobile
 */
export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const checkIsMobile = () => {
      setIsMobile(window.innerWidth <= breakpoint);
    };

    // Comprobación inicial
    checkIsMobile();

    // Escuchar cambios de tamaño
    window.addEventListener("resize", checkIsMobile);

    return () => {
      window.removeEventListener("resize", checkIsMobile);
    };
  }, [breakpoint]);

  return isMobile;
}
