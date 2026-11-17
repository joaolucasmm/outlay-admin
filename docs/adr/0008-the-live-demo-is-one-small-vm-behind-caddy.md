# The live demo is one small VM behind Caddy

The browser demo on GitHub Pages runs on the MSW mock. To show the Java tenant API for real, it needs a public home that stays up when a reviewer opens the link, for a few euros a month at most. The stack is already a Docker Compose file (MySQL plus the Spring Boot service), so `compose.prod.yaml` runs it on one small VM with Caddy in front. Caddy obtains the HTTPS certificate, serves the web app built for the live API, and proxies `/api/*` to the service. Only Caddy's ports are published.

## Considered options

- **A PaaS free tier (Render, Koyeb).** Rejected: no free MySQL, 512 MB is tight for a Spring Boot JVM, and a service that sleeps after inactivity greets the reviewer with a 30-second cold start.
- **A PaaS with managed MySQL (Railway).** Workable, but usage-priced and harder to predict than a flat VM; it also splits one Compose stack into separately configured services.
- **Point the GitHub Pages build at the VM's API.** Rejected: the Pages build would depend on the VM being up, and every request would be cross-origin. Serving the live build from the same origin needs no CORS and leaves the mock demo independent.
- **Kubernetes.** Out of proportion for one replica of each service; it stays an optional M9 exercise.

## Consequences

- Two demos: the mock on GitHub Pages (always up, no backend) and the live one on the VM (real API and MySQL). They share the code, the seed and the e2e flow.
- Receipt extraction stays mocked on the live demo. A public page must not spend Anthropic credits on visitors' uploads; the AI service runs locally or in the evals.
- The demo profile has personas, not logins, so anyone can change the data. A `reset` container calls `POST /demo/reset` every hour, and the MySQL port is never published.
- Deploys are manual (`git pull && docker compose -f compose.prod.yaml up -d --build` on the VM). Automating them would mean storing SSH credentials in CI, which a portfolio demo does not need.
