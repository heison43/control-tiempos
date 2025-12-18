export default function Head() {
  return (
    <>
      <title>Solicitudes de Asignación • MiningSoft</title>

      {/* 👇 Manifest específico para el portal de solicitudes */}
      <link rel="manifest" href="/manifest-solicitudes.webmanifest" />

      {/* Si quieres puedes añadir metas específicas */}
      <meta
        name="description"
        content="Portal de solicitudes para asignación de equipos y operadores."
      />
    </>
  );
}
