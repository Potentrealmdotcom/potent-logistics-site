#!/usr/bin/env bash
# POTENT VOICE bridge ONLY, for a small cheap server (1 vCPU / 1-2 GB is enough). No video rooms, no OBS, no file hosting.
# Run on a fresh Ubuntu 24.04 server, as root:
#   git clone https://github.com/Potentrealmdotcom/potent-logistics-site.git && cd potent-logistics-site/server-kit
#   sudo bash install-voice-only.sh you@email.com
# Optional cheaper AI model:  VOICE_AI_MODEL=gpt-realtime-2.1-mini sudo -E bash install-voice-only.sh you@email.com
# You need: an A record  voice.<your domain>  pointing at this server, and an OpenAI API key.
# Not tested on a real server by the person who wrote it. Run the check at the end.
set -euo pipefail
EMAIL="${1:-}"; [ -n "$EMAIL" ] || { echo "Usage: sudo bash install-voice-only.sh you@email.com"; exit 1; }
[ "$(id -u)" = 0 ] || { echo "Run as root (sudo)."; exit 1; }
DOMAIN="${DOMAIN:-potentworld.ink}"; SITE="${SITE_URL:-https://potentoperations.netlify.app}"
KIT="$(cd "$(dirname "$0")" && pwd)"; V=/opt/potent-voice
PUBIP="$(curl -4 -fsS https://api.ipify.org)"
getent ahostsv4 "voice.$DOMAIN" | awk '{print $1}' | grep -qx "$PUBIP" || { echo "STOP: voice.$DOMAIN does not point to this server ($PUBIP). Add the A record in Namecheap, wait a few minutes, run again."; exit 1; }
if [ -z "${OPENAI_API_KEY:-}" ]; then read -r -s -p "Paste your OpenAI API key (hidden): " OPENAI_API_KEY; echo; fi
[ -n "$OPENAI_API_KEY" ] || { echo "No key given."; exit 1; }
export DEBIAN_FRONTEND=noninteractive
apt-get update -y && apt-get install -y ca-certificates curl ufw openssl unattended-upgrades
command -v docker >/dev/null || curl -fsSL https://get.docker.com | sh
ufw allow 22/tcp; ufw allow 80/tcp; ufw allow 443/tcp; ufw --force enable
mkdir -p "$V/app" "$V/caddy"; umask 077
SECRET="$( [ -f "$V/.secret" ] && cat "$V/.secret" || openssl rand -hex 24 )"; echo "$SECRET" > "$V/.secret"
rm -rf "$V/app"; mkdir -p "$V/app"; cp "$KIT/voice-bridge/"{package.json,bridge.js,server.js,Dockerfile} "$V/app/"
cp "$KIT/../netlify/functions/lib/voice/adapters/realtime.js" "$V/app/realtime.js"
cat > "$V/caddy/Caddyfile" <<EOT
{
	email $EMAIL
}
voice.$DOMAIN {
	reverse_proxy 127.0.0.1:8090
}
EOT
cat > "$V/docker-compose.yml" <<EOT
services:
  voice-bridge:
    build: ./app
    network_mode: host
    restart: unless-stopped
    environment:
      OPENAI_API_KEY: "$OPENAI_API_KEY"
      VOICE_BRIDGE_SECRET: "$SECRET"
      SITE_URL: "$SITE"
      MAX_CALLS: "50"
      VOICE_AI_MODEL: "\${VOICE_AI_MODEL:-${VOICE_AI_MODEL:-gpt-realtime-2.1}}"
  caddy:
    image: caddy:2
    network_mode: host
    restart: unless-stopped
    volumes:
      - ./caddy/Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
volumes:
  caddy_data:
EOT
chmod 600 "$V/docker-compose.yml"
cd "$V" && docker compose up -d --build
ENVF=/root/voice-netlify-env.txt
cat > "$ENVF" <<EOT
VOICE_BRIDGE_URL=wss://voice.$DOMAIN/twilio
VOICE_BRIDGE_SECRET=$SECRET
EOT
echo
echo "DONE. Add the two lines in $ENVF to Netlify environment variables, then redeploy."
echo "Check (wait a minute for the certificate):  curl https://voice.$DOMAIN/health    should print: ok 0"
echo "Delete the file after copying:  shred -u $ENVF"
