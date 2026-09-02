# Deploying VicGym with Coolify

VicGym uses Coolify's Traefik HTTP Basic Authentication as its only authentication layer. Better Auth is not installed, and the database has no user, account, or authentication-session tables.

## Application

1. Create a standard Coolify application from this repository and select the included `Dockerfile` as the build pack. Leave Coolify's custom start command empty so the image runs `docker-entrypoint.sh`.
2. Route the application domain to container port `3000` through Coolify's proxy. Do not publish or forward the container port directly on the host; doing so would bypass authentication.
3. Configure the public domain with HTTPS and automatic certificate renewal. Redirect HTTP to HTTPS.
4. Enable HTTP Basic Authentication for the application in Coolify. Use a long, unique password generated and stored by a password manager. Coolify stores the configured password as a bcrypt hash.
5. Set the health-check path to `/api/health`. A `200` response means both the application and database are ready; a `503` means the application is running but the database is unavailable or misconfigured.

Browser-native Basic Authentication has no polished logout flow. Closing all browser windows or clearing credentials for the site may be required to end a browser session. Because Phase 6 stores the active workout in the browser profile, also use **More → Offline & synchronization → Reset private offline data** before handing an unlocked device or browser profile to another person.

## PostgreSQL and secrets

Create a PostgreSQL service on Coolify's internal network. Set these application environment variables:

- `DATABASE_URL`: the PostgreSQL connection URL using the internal service hostname and a unique database password.
- `APP_ORIGIN`: the exact public HTTPS origin, for example `https://gym.example.com`. This keeps same-origin mutation protection correct if a proxy forwards an internal host.
- `APP_TIMEZONE`: `Europe/London` unless the owner deliberately changes it.

Keep `DATABASE_URL` in Coolify's secret environment configuration. Do not commit `.env` files. PostgreSQL should not expose a public host port. Configure scheduled database backups and test restoration before relying on the deployment for durable history.

## Startup and network boundary

The container entrypoint runs `prisma migrate deploy` and the idempotent verified catalogue seed before starting the standalone Next.js server with `node .next/standalone/server.js`. If migration or seeding fails, the application does not start and cannot report healthy. The seed never activates the demo programme and does not overwrite an existing programme version.

`npm start` uses the same standalone server command. The build's `postbuild` step copies `public` and `.next/static` into `.next/standalone`, so the minimal server can serve PWA icons, exercise media, styles, and client bundles. Do not configure `next start` as a Coolify start command. If a custom command is unavoidable, use `./docker-entrypoint.sh` so migrations and seeding still run before the server starts.

All future mutation routes must call the shared same-origin JSON guard. `APP_ORIGIN` is the authoritative public origin; the deployment should also preserve `Host`, `X-Forwarded-Host`, and `X-Forwarded-Proto`. Do not add permissive CORS headers.

Phase 6 installs a same-origin service worker and stores active workout data in IndexedDB. Serve VicGym only over HTTPS through the authenticated Traefik route, and do not expose a direct application port that could let the service worker fetch around the proxy boundary. API responses are not runtime-cached; prepared workout pages and optimized machine media are held in private versioned caches until browser eviction or explicit local-data reset.

Reference: [Coolify Basic Authentication](https://next.coolify.io/docs/core/networking/proxy/traefik/basic-auth)
