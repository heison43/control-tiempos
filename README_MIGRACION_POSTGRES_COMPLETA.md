# Gestión de Equipos - Migración PostgreSQL sin Firebase

Esta versión deja el proyecto preparado para trabajar con Microsoft Entra ID + PostgreSQL.

## Qué cambió

- Se retiraron las dependencias directas de Firebase en el código fuente.
- Se agregó una capa de compatibilidad: `src/lib/pgFirestoreCompat.js`.
- Las operaciones que antes iban a Firestore ahora pasan por la API:
  - `src/app/api/pg-firestore/route.js`
- La validación de usuarios, admins y operadores se realiza desde PostgreSQL.
- Las notificaciones push con Firebase Cloud Messaging quedan deshabilitadas temporalmente.

## Archivos principales nuevos o modificados

- `prisma/schema.prisma`
- `src/lib/prisma.js`
- `src/lib/pgAuth.js`
- `src/lib/pgFirestoreCompat.js`
- `src/app/api/pg-firestore/route.js`
- `src/app/api/auth/resolve-user/route.js`
- `src/lib/userAccess.js`
- `.env.example`

## Variables requeridas

Crear `.env.local` desde `.env.example` y configurar:

```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=
AZURE_AD_TENANT_ID=
AZURE_AD_CLIENT_ID=
AZURE_AD_CLIENT_SECRET=
AUTH_ALLOWED_DOMAINS=continentalgold.com
DATABASE_URL="postgresql://USUARIO:CLAVE@HOST:5432/DB_Almacen_SolicitudesEquipos?schema=public"
```

## Comandos recomendados

```bash
npm install
npx prisma generate
npx prisma db push
npm run dev
```

## Prueba de conexión

Abrir:

```text
http://localhost:3000/api/db/health
```

Resultado esperado:

```json
{"ok":true,"message":"Conexión PostgreSQL OK"}
```

## Scripts SQL incluidos

En la carpeta `scripts/` quedan dos archivos:

1. `postgres_phase2_update_schema.sql`
   - agrega columnas `metadata`
   - crea tablas auxiliares para tokens/portal

2. `postgres_phase2_seed_users_operators.sql`
   - carga el admin principal
   - carga operadores base

## Nota importante sobre notificaciones

Firebase Cloud Messaging fue retirado. Por eso las notificaciones push quedan como pendiente técnico. Para producción se debe definir una alternativa corporativa, por ejemplo correo, Web Push propio, servicio interno o integración con Microsoft.
