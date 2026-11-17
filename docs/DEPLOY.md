# Deploying the live demo

One small Linux VM runs the whole live demo with Docker Compose ([ADR 0008](adr/0008-the-live-demo-is-one-small-vm-behind-caddy.md)):

```text
internet ──▶ Caddy :443 (HTTPS) ──┬─ /api/*  ──▶ tenant-api :8080 ──▶ MySQL :3306
                                  └─ /*      ──▶ web app (built for the live API)
             reset (hourly POST /demo/reset)
```

Only ports 80 and 443 are open. Receipt extraction stays mocked in the browser.

## What you need

- A VM with 2 GB of RAM or more (4 GB is comfortable, since the first build compiles Java and the web app on it), x86-64 or ARM64, Ubuntu 24.04 or similar. A Hetzner CX22 or an Oracle Cloud Always Free ARM instance fits.
- A domain name pointing at the VM (an `A` record). A free subdomain from a dynamic DNS service works; Caddy needs it to get a certificate.
- Ports 22, 80 and 443 open in the provider's firewall.

## First deploy

On the VM:

```bash
curl -fsSL https://get.docker.com | sh
git clone https://github.com/joaolucasmm/outlay-admin.git
cd outlay-admin
cat > .env <<EOF
SITE_ADDRESS=demo.example.com
DB_PASSWORD=$(openssl rand -hex 24)
DB_ROOT_PASSWORD=$(openssl rand -hex 24)
EOF
docker compose -f compose.prod.yaml up -d --build
```

Replace `demo.example.com` with your domain. The `.env` file stays on the VM; it is git-ignored. The first build takes a few minutes. Then:

```bash
curl https://demo.example.com/api/v1/health
docker compose -f compose.prod.yaml logs -f web tenant-api
```

## Updating

```bash
cd outlay-admin && git pull && docker compose -f compose.prod.yaml up -d --build
```

The MySQL volume survives updates. Flyway applies new migrations on start, and the `demo` profile re-seeds the demo data.

## Trying it locally

`SITE_ADDRESS=:80` serves plain HTTP, so there is no certificate to trust; open http://localhost:

```bash
SITE_ADDRESS=:80 DB_PASSWORD=local DB_ROOT_PASSWORD=local docker compose -f compose.prod.yaml up -d --build
curl http://localhost/api/v1/health
```

Stop the development stack (`docker compose down`) first if it is running: both want the host's ports, though they use different project names and volumes. CI runs the same smoke test. (`SITE_ADDRESS=localhost` gives HTTPS from Caddy's own local certificate authority, which browsers do not trust.)

## Settings

| Variable | Required | Meaning |
|---|---|---|
| `SITE_ADDRESS` | yes | The demo's domain; Caddy serves HTTPS for it |
| `DB_PASSWORD` | yes | Password of the `outlay` MySQL user |
| `DB_ROOT_PASSWORD` | yes | MySQL root password |
| `RESET_EVERY_SECONDS` | no | How often the demo data goes back to the seed (default 3600) |

## What this deploy leaves out

No rate limiting, backups, monitoring, or automated deploys: the data is demo data that resets every hour. A production setup would add real authentication first ([ADR 0006](adr/0006-demo-persona-header-is-a-spring-security-filter.md)).
