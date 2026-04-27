# Fase 1 - Login corporativo con Microsoft (sin quitar aún Firestore)

Este proyecto quedó preparado para cambiar el acceso interno a **Microsoft Entra ID** usando **Auth.js / NextAuth**.

## Qué quedó listo
- Login interno por Microsoft en `src/app/page.js`
- Endpoint de autenticación en `src/app/api/auth/[...nextauth]/route.js`
- Configuración Auth.js en `src/auth.js`
- `SessionProvider` global en `src/app/layout.js`
- Validación de rol actual contra Firestore en `src/lib/userAccess.js`
- Layouts de `admin` y `operador` adaptados a sesión Microsoft

## Qué falta para probar mañana
Copiar al `.env.local` del servidor o ambiente de pruebas:
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `AZURE_AD_TENANT_ID`
- `AZURE_AD_CLIENT_ID`
- `AZURE_AD_CLIENT_SECRET`
- (opcional) `AUTH_ALLOWED_DOMAINS=continentalgold.com`

## Ruta típica de callback que deberá registrarse en Azure
Si la app usa Auth.js/NextAuth con provider `azure-ad`, la callback normalmente será:

`<URL_INTERNA>/api/auth/callback/azure-ad`

Ejemplo:
`http://10.10.10.25:3000/api/auth/callback/azure-ad`

o idealmente con dominio/HTTPS:
`https://gestion-equipos.interna/api/auth/callback/azure-ad`

## Instalación pendiente
Después de recibir credenciales y antes de correr:

```bash
npm install
```

Esto instalará `next-auth` según `package.json`.

## Nota de transición
En esta fase todavía se usa Firestore para:
- roles (`users`, `admins`, `operators`)
- datos operativos del sistema

La autenticación interna ya no dependerá de Google, pero la salida completa de Firebase se hará en la fase de migración a PostgreSQL.
