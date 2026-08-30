# Deploying VicGym with Coolify

VicGym uses Coolify's Traefik HTTP Basic Authentication as its only authentication layer. Better Auth is not installed, and the database has no user, account, or authentication-session tables.

## Application

1. Create a standard Coolify application from this repository and build it with the included `Dockerfile`.
2. Route the application domain to container port `3000` through Coolify's proxy. Do not publish or forward the container port directly on the host; doing so would bypass authentication.
3. Configure the public domain with HTTPS and automatic certificate renewal. Redirect HTTP to HTTPS.
4. Enable HTTP Basic Authentication for the application in Coolify. Use a long, unique password generated and stored by a password manager. Coolify stores the configured password as a bcrypt hash.
5. Set the health-check path to `/api/health`. A `200` response means both the application and database are ready; a `503` means the application is running but the database is unavailable or misconfigured.

Browser-native Basic Authentication has no polished logout flow. Closing all browser windows or clearing credentials for the site may be required to end a browser session.

## PostgreSQL and secrets

Create a PostgreSQL service on Coolify's internal network. Set these application environment variables:

- `DATABASE_URL`: the PostgreSQL connection URL using the internal service hostname and a unique database password.
- `APP_TIMEZONE`: `Europe/London` unless the owner deliberately changes it.

Keep `DATABASE_URL` in Coolify's secret environment configuration. Do not commit `.env` files. PostgreSQL should not expose a public host port. Configure scheduled database backups and test restoration before relying on the deployment for durable history.

## Startup and network boundary

The container entrypoint runs `prisma migrate deploy` and the idempotent verified catalogue seed before starting the standalone Next.js server. If migration or seeding fails, the application does not start and cannot report healthy. The seed never activates the demo programme and does not overwrite an existing programme version.

All future mutation routes must call the shared same-origin JSON guard. The deployment must preserve `Host`, `X-Forwarded-Host`, and `X-Forwarded-Proto`, as Coolify's Traefik proxy normally does. Do not add permissive CORS headers.

The phone or browser profile protects any future cached local data; Phase 1 does not install a service worker or create an offline cache.

Reference: [Coolify Basic Authentication](https://next.coolify.io/docs/core/networking/proxy/traefik/basic-auth)
