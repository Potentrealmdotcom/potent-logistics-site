#!/usr/bin/env bash
# POTENT VOICE audio bridge installer. Run AFTER install.sh (it reuses that server's Caddy for HTTPS). As root:
#   cd potent-logistics-site/server-kit && sudo bash install-voice.sh
# Optional: choose the cheaper model with   VOICE_AI_MODEL=gpt-realtime-2.1-mini sudo -E bash install-voice.sh
# You need: an A record  voice.<your domain>  pointing at this server, and an OpenAI API key (platform.openai.com).
# Not tested on a real server by the person who wrote it. Run the checks at the end.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Run as root (sudo)."; exit 1; }
DOMAIN="${DOMAIN:-potentworld.ink}"; SITE="${SITE_URL:-https://potentoperations.netlify.app}"
KIT="$(cd "$(dirname "$0")" && pwd)"; OUT=/opt/potent-media; V=/opt/potent-voice
[ -f "$OUT/Caddyfile" ] || { echo "STOP: run install.sh first (it sets up Caddy)."; exit 1; }
PUBIP="$(curl -4 -fsS https://api.ipify.org)"
getent ahostsv4 "voice.$DOMAIN" | awk '{print $1}' | grep -qx "$PUBIP" || { echo "STOP: voice.$DOMAIN does not point to this server ($PUBIP). Add the A record in Namecheap, wait, run again."; exit 1; }
if [ -z "${OPENAI_API_KEY:-}" ]; then read -r -s -p "Paste your OpenAI API key (hidden): " OPENAI_API_KEY; echo; fi
[ -n "$OPENAI_API_KEY" ] || { echo "No key given."; exit 1; }
mkdir -p "$V"; umask 077
SECRET="$( [ -f "$V/.secret" ] && cat "$V/.secret" || openssl rand -hex 24 )"; echo "$SECRET" > "$V/.secret"
rm -rf "$V/app"; mkdir -p "$V/app"; cp "$KIT/voice-bridge/"{package.json,bridge.js,server.js,Dockerfile} "$V/app/"
cp "$KIT/../netlify/functions/lib/voice/adapters/realtime.js" "$V/app/realtime.js"
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
      VOICE_AI_MODEL: "${VOICE_AI_MODEL:-gpt-realtime-2.1}"
EOT
chmod 600 "$V/docker-compose.yml"
cd "$V" && docker compose up -d --build
grep -q "voice.$DOMAIN" "$OUT/Caddyfile" || printf '\nvoice.%s {\n\treverse_proxy 127.0.0.1:8090\n}\n' "$DOMAIN" >> "$OUT/Caddyfile"
( cd "$OUT" && docker compose restart caddy )
ENVF=/root/voice-netlify-env.txt
cat > "$ENVF" <<EOT
VOICE_BRIDGE_URL=wss://voice.$DOMAIN/twilio
VOICE_BRIDGE_SECRET=$SECRET
EOT
echo
echo "DONE. Add the two lines in $ENVF to Netlify environment variables (plus TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_SMS_FROM if texting), then redeploy."
echo "Check:  curl https://voice.$DOMAIN/health   should print: ok 0"
echo "Delete the file after copying:  shred -u $ENVF"
