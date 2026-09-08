# Deploying VicGym with Coolify and Resend

VicGym authenticates each user with an expiring, single-use email magic link sent through Resend. After verification it uses an HTTP-only server session cookie. The old Coolify/Traefik HTTP Basic Authentication layer is no longer the application's authentication system and should normally be disabled to avoid presenting users with two login gates.

## Resend setup

1. In Resend, add a sending domain or dedicated subdomain, for example `auth.example.com`.
2. Add every DNS record Resend supplies, including SPF and DKIM, at the authoritative DNS provider and wait for the domain to show as verified.
3. Create a Resend API key. Restrict it to sending access and the VicGym sending domain when that option is available.
4. Choose a sender on that verified domain, for example `VicGym <login@auth.example.com>`.
5. Do not put the API key in source control, Docker build arguments, browser variables, or logs.

Resend API reference: [Send email](https://resend.com/docs/api-reference/emails/send-email) and [Domains](https://resend.com/docs/dashboard/domains/introduction).

## Coolify application

1. Create a standard application from this repository and select the included `Dockerfile` build pack.
2. Leave the custom start command empty. The image entrypoint applies migrations, seeds the shared catalogue, and starts `node .next/standalone/server.js`.
3. Route the application domain to container port `3000` through Coolify/Traefik.
4. Enable HTTPS and redirect HTTP to HTTPS.
5. Do not publish or forward port `3000` directly on the host.
6. Disable Coolify HTTP Basic Authentication unless two independent login prompts are deliberate.
7. Set the health-check path to `/api/health`. HTTP `200` means the app can reach PostgreSQL; `503` means the process is running but the database is unavailable or invalid.

## PostgreSQL and environment

Create PostgreSQL on Coolify's private network and do not expose its port publicly. Configure these application variables:

```dotenv
DATABASE_URL=postgresql://user:strong-password@internal-postgres-host:5432/vicgym
APP_ORIGIN=https://gym.example.com
APP_TIMEZONE=Europe/London
RESEND_API_KEY=re_your_server_side_key
RESEND_FROM_EMAIL=VicGym <login@auth.example.com>
AUTH_ALLOWED_EMAILS=first@example.com,second@example.com
```

- `DATABASE_URL` is required for every process.
- `APP_ORIGIN` must exactly match the browser-facing origin, including `https://`, with no path, query, fragment, or trailing slash. It is used in emailed links and same-origin mutation validation.
- `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are required when a user requests a login link.
- `AUTH_ALLOWED_EMAILS` is optional. When empty, any deliverable email can create an account. For a private few-user deployment, set the comma-separated allowlist.
- `APP_TIMEZONE` defaults to `Europe/London`.

Mark database and Resend credentials as secrets. Preserve the proxy's `Host`, `X-Forwarded-Host`, and `X-Forwarded-Proto` headers. Do not add permissive CORS headers.

## Authentication lifecycle

The login endpoint normalizes the submitted email and returns a generic confirmation whether or not it is allowlisted or currently rate-limited. For an allowed email, VicGym stores only a SHA-256 hash of a random login token and sends the raw token through Resend. The token expires after 15 minutes, its database update is conditional to make it single-use under concurrent requests, and each email has a one-minute request cooldown.

Following a valid link creates the user on first login, creates that user's settings, creates a separate hashed 30-day session, and sets the raw session token in an HTTP-only, `SameSite=Lax`, secure cookie. Logout deletes that session and expires the cookie. Additional users are created the same way; add their addresses to `AUTH_ALLOWED_EMAILS` first when the allowlist is enabled.

## Multi-user migration and reset

Migration `20260908193000_multi_user_magic_link_auth` intentionally discards the old single-owner personal programme/workout/settings/sync data. It leaves `Equipment`, `Exercise`, `Muscle`, `ExerciseMuscle`, and `ExerciseMedia` intact. A normal redeployment is sufficient: startup runs the migration and reseeds the global catalogue.

If a completely fresh production database is preferred, the safest route is to create a new empty PostgreSQL database/service in Coolify, update `DATABASE_URL`, and redeploy. All migrations will run in order and the entrypoint will seed the shared catalogue.

An in-place reset is destructive. Back up first, stop the app to prevent concurrent writes, then run these commands in an administrative PostgreSQL shell connected to the exact VicGym database:

```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
```

Then start/redeploy the application. Alternatively run these inside the application container after the empty schema exists:

```bash
npm run db:migrate:deploy
npm run db:seed
```

Do not run the reset against a shared PostgreSQL database or another application's schema. The reset deletes all users, sessions, programmes, and workout history as well as catalogue rows; the idempotent seed recreates only the global catalogue.

## Startup and standalone runtime

`docker-entrypoint.sh` runs `prisma migrate deploy` and `npm run db:seed` before launching the standalone Next.js server. A failure prevents the app from starting. The seed is safe on every deployment and never creates users or personal programmes.

The build's post-build step copies `public` and `.next/static` into `.next/standalone`, so PWA icons, exercise media, styles, and JavaScript are available to the minimal runtime. Do not configure `next start`; leave Coolify's start command blank so the Docker command remains:

```text
node .next/standalone/server.js
```

## First deployment check

1. Confirm startup logs show all migrations applied and the shared catalogue seed completed.
2. Open `/api/health` and confirm HTTP `200`.
3. Open `/login` in a private browser window.
4. Request a link for an allowlisted email and confirm it appears in the Resend dashboard.
5. Follow it within 15 minutes and confirm Home opens.
6. Sign out under **More**, then confirm protected pages redirect to `/login`.
7. Sign in as a second allowed test user and confirm it starts without the first user's programme/history.
8. Configure scheduled PostgreSQL backups and test a restoration before relying on the deployment.

Offline workout data is stored in a separate IndexedDB database per authenticated user. Signing out does not delete pending local data, allowing the same account to resume and synchronize later; another account cannot open or replay that namespace. API responses containing authenticated data remain network-only in the service worker.
