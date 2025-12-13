'use client';

import Link from 'next/link';
import type { CSSProperties } from 'react';

/**
 * Portal de solicitudes:
 * - Opción 1: Solicitud de actividad (operador + equipo).
 * - Opción 2: Préstamo de equipo.
 */

const styles = {
  page: {
    minHeight: '100vh',
    padding: '24px 16px',
    background:
      'radial-gradient(circle at top left, #1e293b 0, #020617 40%, #020617 100%)',
    fontFamily: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
    color: '#e5e7eb',
  } as CSSProperties,
  container: {
    maxWidth: 960,
    margin: '0 auto',
  } as CSSProperties,
  card: {
    background: 'linear-gradient(145deg, rgba(15,23,42,0.96), rgba(15,23,42,0.9))',
    borderRadius: 24,
    padding: '24px 20px',
    border: '1px solid rgba(148,163,184,0.3)',
    boxShadow: '0 22px 60px rgba(15,23,42,0.8)',
  } as CSSProperties,
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 11,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    background: 'rgba(37,99,235,0.12)',
    color: '#93c5fd',
  } as CSSProperties,
  title: {
    marginTop: 10,
    fontSize: 26,
    fontWeight: 800,
    color: '#f9fafb',
  } as CSSProperties,
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    color: '#cbd5f5',
  } as CSSProperties,
  grid: {
    marginTop: 24,
    display: 'grid',
    gap: 16,
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
  } as CSSProperties,
  optionCard: {
    borderRadius: 18,
    padding: '18px 16px',
    background:
      'linear-gradient(145deg, rgba(15,23,42,0.96), rgba(30,64,175,0.14))',
    border: '1px solid rgba(148,163,184,0.35)',
    cursor: 'pointer',
    transition: 'all 0.18s ease-out',
    textDecoration: 'none',
    color: 'inherit',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  } as CSSProperties,
  optionCardGreen: {
    background:
      'linear-gradient(145deg, rgba(6,95,70,0.16), rgba(15,23,42,0.97))',
    border: '1px solid rgba(52,211,153,0.5)',
  } as CSSProperties,
  optionHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  } as CSSProperties,
  optionTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: '#f9fafb',
  } as CSSProperties,
  optionTag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '2px 8px',
    borderRadius: 999,
    fontSize: 11,
    background: 'rgba(37,99,235,0.18)',
    color: '#bfdbfe',
  } as CSSProperties,
  optionTagGreen: {
    background: 'rgba(16,185,129,0.18)',
    color: '#bbf7d0',
  } as CSSProperties,
  optionArrow: {
    fontSize: 22,
    color: '#93c5fd',
    alignSelf: 'center',
    transition: 'transform 0.18s ease-out',
  } as CSSProperties,
  optionDescription: {
    fontSize: 13,
    color: '#cbd5f5',
  } as CSSProperties,
  optionList: {
    marginTop: 4,
    paddingLeft: 18,
    fontSize: 12,
    color: '#9ca3af',
  } as CSSProperties,
  footerText: {
    marginTop: 18,
    fontSize: 11,
    textAlign: 'center',
    color: '#9ca3af',
  } as CSSProperties,
};

export default function SolicitudesLandingPage() {
  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <div style={styles.card}>
          {/* Encabezado */}
          <header>
            <div style={styles.badge}>
              <span>🧾</span>
              <span>Portal de solicitudes</span>
            </div>
            <h1 style={styles.title}>Solicitudes de asignación y préstamo</h1>
            <p style={styles.subtitle}>
              Elige qué tipo de solicitud quieres realizar. Puedes pedir un operador
              para una actividad específica o solicitar el préstamo de un equipo.
            </p>
          </header>

          {/* Opciones */}
          <section style={styles.grid}>
            {/* Opción 1: Solicitud de actividad */}
            <Link href="/solicitud-asignacion" style={styles.optionCard}>
              <div style={styles.optionHeaderRow}>
                <div>
                  <h2 style={styles.optionTitle}>👷 Solicitud de actividad</h2>
                  <span style={styles.optionTag}>
                    <span>⚙️</span>
                    <span>Operador + equipo</span>
                  </span>
                </div>
                <span style={styles.optionArrow}>➜</span>
              </div>

              <p style={styles.optionDescription}>
                Pide un operador y un equipo para realizar una actividad específica
                (carga, traslado, apoyo en frente, etc.).
              </p>

              <ul style={styles.optionList}>
                <li>Genera un código de seguimiento para la actividad.</li>
                <li>El administrador aprueba o rechaza la solicitud.</li>
                <li>Se usa para planear la asignación de operador + equipo.</li>
              </ul>
            </Link>

            {/* Opción 2: Préstamo de equipo */}
            <Link
              href="/prestamo-equipo"
              style={{ ...styles.optionCard, ...styles.optionCardGreen }}
            >
              <div style={styles.optionHeaderRow}>
                <div>
                  <h2 style={styles.optionTitle}>🚜 Préstamo de equipo</h2>
                  <span style={{ ...styles.optionTag, ...styles.optionTagGreen }}>
                    <span>📦</span>
                    <span>Sólo equipo</span>
                  </span>
                </div>
                <span style={{ ...styles.optionArrow, color: '#6ee7b7' }}>➜</span>
              </div>

              <p style={styles.optionDescription}>
                Solicita que te presten un equipo por un rango de tiempo definido, sin
                operador asignado.
              </p>

              <ul style={styles.optionList}>
                <li>Registra quién pide el equipo y dónde se usará.</li>
                <li>El administrador autoriza fechas de préstamo.</li>
                <li>El equipo se marca como entregado y devuelto.</li>
              </ul>
            </Link>
          </section>

          <p style={styles.footerText}>
            Si tienes dudas sobre qué opción usar, consulta con el área de almacén.
          </p>
        </div>
      </div>
    </main>
  );
}
