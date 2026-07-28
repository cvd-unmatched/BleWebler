# Static site: no build step, just served by nginx. Built by CI on tag push, pushed to
# GHCR (see .github/workflows/release.yml). Put a reverse proxy with TLS in front of
# this container: Web Bluetooth requires a secure context (HTTPS or localhost), which
# this container does not provide on its own.
FROM nginx:1.27-alpine

COPY . /usr/share/nginx/html

EXPOSE 80
