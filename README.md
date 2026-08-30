# VicGym

VicGym is a private, mobile-first workout log. This repository currently contains **Phases 1 and 2**: the secure application foundation, verified photo/equipment catalogue, exercise and muscle library, and an inactive demo programme with explicit activation.

The four-day routine is software fixture data only and is always labelled **“Demo programme — not training advice.”** It is inactive after a fresh seed. VicGym does not yet contain workout logging, timer behavior, offline sync, progress charts, reports, or an import workflow.

## Local development

Requirements: Node.js 24+, npm, Docker, and Docker Compose.

```bash
cp .env.example .env
docker compose -f compose.dev.yml up -d
npm install
npm run phase2:setup
npm run dev
```

Open `http://localhost:3000`. The readiness endpoint is `GET /api/health`.

## Checks

```bash
npm run check
npm run build
npm run db:validate
DATABASE_URL=postgresql://vicgym:vicgym-local-only@localhost:5432/vicgym npm run verify:phase2
```

Database records are single-owner and deliberately have no `userId`. Authentication is supplied at the deployment proxy, not by application account or session tables. See [Coolify deployment](docs/coolify-deployment.md).

Photo originals remain in `gym-pictures/`. The deterministic processor writes orientation-corrected 640/1280 WebP and AVIF assets to `public/media/equipment/`; the exact source mapping is documented in [the equipment photo map](docs/equipment-photo-map.md).
