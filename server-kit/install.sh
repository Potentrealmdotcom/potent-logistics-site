#!/usr/bin/env bash
# POTENT own-media-server installer. Run ONCE on a fresh Ubuntu 24.04 server, as root:
#   git clone https://github.com/Potentrealmdotcom/potent-logistics-site.git && cd potent-logistics-site/server-kit
#   sudo bash install.sh you@youremail.com
# Installs: Caddy (HTTPS), Jitsi Meet (live video/voice), MediaMTX (OBS broadcasts), MinIO (large video storage).
# Not tested on a real server by the person who wrote it. Read README.md, and run the checks at the end.
set -euo pipefail
EMAIL="${1:-}"; [ -n "$EMAIL" ] || { echo "Usage: sudo bash install.sh you@email.com"; exit 1; }
[ "$(id -u)" = 0 ] || { echo "Run as root (sudo)."; exit 1; }
DOMAIN="${DOMAIN:-potentworld.online}"
SITE="${SITE_URL:-https://potentoperations.netlify.app}"
KIT="$(cd "$(dirname "$0")" && pwd)"
OUT=/opt/potent-media; JDIR=/opt/jitsi

echo "== 1/7 checking DNS"
PUBIP="$(curl -4 -fsS https://api.ipify.org)"
for h in meet live files; do
  if ! getent ahostsv4 "$h.$DOMAIN" | awk '{print $1}' | grep -qx "$PUBIP"; then
    echo "STOP: $h.$DOMAIN does not point to this server ($PUBIP) yet. In Namecheap add an A record, wait a few minutes, run again."; exit 1
  fi
done

echo "== 2/7 packages, firewall, automatic security updates"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y && apt-get install -y ca-certificates curl unzip ufw openssl gettext-base unattended-upgrades
command -v docker >/dev/null || curl -fsSL https://get.docker.com | sh
ufw allow 22/tcp; ufw allow 80/tcp; ufw allow 443/tcp; ufw allow 443/udp; ufw allow 1935/tcp; ufw allow 10000/udp
ufw --force enable

echo "== 3/7 secrets"
rnd() { openssl rand -hex "$1"; }
JITSI_APP_SECRET="$(rnd 24)"; MTX_KEY="$(rnd 24)"; MINIO_USER="potent$(rnd 3)"; MINIO_PASS="$(rnd 24)"
mkdir -p "$OUT" /srv/minio

echo "== 4/7 Jitsi Meet (video + voice)"
mkdir -p "$JDIR" && cd "$JDIR"
if [ ! -f .installed ]; then
  URL="$(curl -fsS https://api.github.com/repos/jitsi/docker-jitsi-meet/releases/latest | grep zipball_url | cut -d '"' -f4)"
  curl -fsSL "$URL" -o j.zip && unzip -qo j.zip && rm j.zip
  cd "$(ls -d jitsi-docker-jitsi-meet-* | head -1)"
  cp env.example .env && ./gen-passwords.sh
  setenv() { if grep -qE "^#?$1=" .env; then sed -i -E "s|^#?$1=.*|$1=$2|" .env; else echo "$1=$2" >> .env; fi; }
  setenv PUBLIC_URL "https://meet.$DOMAIN"; setenv HTTP_PORT 8000; setenv HTTPS_PORT 8443
  setenv DISABLE_HTTPS 1; setenv ENABLE_LETSENCRYPT 0; setenv ENABLE_HTTP_REDIRECT 0
  setenv ENABLE_AUTH 1; setenv AUTH_TYPE jwt; setenv ENABLE_GUESTS 0
  setenv JWT_APP_ID potent; setenv JWT_APP_SECRET "$JITSI_APP_SECRET"
  setenv JWT_ACCEPTED_ISSUERS potent; setenv JWT_ACCEPTED_AUDIENCES jitsi
  setenv JVB_ADVERTISE_IPS "$PUBIP"; setenv TZ America/New_York
  setenv ENABLE_RECORDING 0; setenv ENABLE_LIVESTREAMING 0
  docker compose up -d
  echo "$(pwd)" > "$JDIR/.installed"
else
  echo "Jitsi already installed, leaving it (and its secret) alone."; JITSI_APP_SECRET="(unchanged: see $(cat "$JDIR/.installed")/.env JWT_APP_SECRET)"
fi

echo "== 5/7 Caddy, MediaMTX, MinIO"
cd "$OUT"
export DOMAIN EMAIL SITE MTX_KEY MINIO_USER MINIO_PASS
envsubst '${DOMAIN} ${EMAIL}' < "$KIT/Caddyfile.template" > Caddyfile
envsubst '${SITE} ${MTX_KEY}' < "$KIT/mediamtx.yml.template" > mediamtx.yml
envsubst '${DOMAIN} ${MINIO_USER} ${MINIO_PASS}' < "$KIT/docker-compose.media.yml" > docker-compose.yml
docker compose up -d

echo "== 6/7 video bucket"
for i in $(seq 1 20); do curl -fsS http://127.0.0.1:9000/minio/health/live >/dev/null 2>&1 && break; sleep 2; done
docker run --rm --network host --entrypoint sh minio/mc -c "mc alias set l http://127.0.0.1:9000 '$MINIO_USER' '$MINIO_PASS' && (mc mb -p l/videos || true) && mc anonymous set download l/videos"

echo "== 7/7 writing the Netlify settings file"
ENVF=/root/netlify-env.txt; umask 077
cat > "$ENVF" <<EOT
JITSI_DOMAIN=meet.$DOMAIN
JITSI_APP_ID=potent
JITSI_APP_SECRET=$JITSI_APP_SECRET
LIVE_HOST=live.$DOMAIN
MTX_KEY=$MTX_KEY
MINIO_ENDPOINT=https://files.$DOMAIN
MINIO_ACCESS_KEY=$MINIO_USER
MINIO_SECRET_KEY=$MINIO_PASS
MINIO_BUCKET=videos
EOT
echo
echo "DONE. Add every line of $ENVF as an environment variable in Netlify (Site configuration > Environment variables), then redeploy."
echo "Do NOT paste that file into chat or email. Delete it after copying:  shred -u $ENVF"
echo "Then run the checks in README.md."
