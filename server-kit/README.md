# POTENT media server kit (potentworld.ink)

Runs on one rented server. Gives POTENT: live video/voice rooms (Jitsi), OBS broadcasts (MediaMTX) and large video storage (MinIO). The website and database stay on Netlify and Supabase.

**Status: written and unit-tested on the website side only. It has NOT been run on a real server yet.** Do the checks at the bottom and report anything that fails.

## 1. Server (about 15 minutes)
1. hetzner.com/cloud → new server: location Ashburn (VA), image Ubuntu 24.04, type 4 vCPU / 8 GB (e.g. CPX31 / CCX13), add your SSH key. Note the IPv4 address.
2. Namecheap → Domain List → potentworld.ink → Manage → **Advanced DNS** → Add New Record, three times:
   - Type `A Record`, Host `meet`, Value `<server IP>`, TTL Automatic
   - Type `A Record`, Host `live`, Value `<server IP>`
   - Type `A Record`, Host `files`, Value `<server IP>`
   (Don't touch the existing records for the main site.)
3. Wait 5–10 minutes for DNS.

## 2. Install (about 10 minutes)
```
ssh root@<server IP>
git clone https://github.com/Potentrealmdotcom/potent-logistics-site.git
cd potent-logistics-site/server-kit
bash install.sh your@email.com
```
If it says a name doesn't point to the server yet, wait and run it again (it's safe to re-run).

At the end it writes `/root/netlify-env.txt` with 9 settings. Copy each line into Netlify → Site configuration → Environment variables, then trigger a redeploy. Don't paste the file into chat/email. Afterwards: `shred -u /root/netlify-env.txt`.

## 3. Checks (report anything that fails)
1. `https://meet.potentworld.ink` loads a Jitsi page (it will refuse a plain visit because logins are required; that is correct).
2. `https://files.potentworld.ink/minio/health/live` shows a blank page with status 200.
3. `https://live.potentworld.ink/` loads (a 404 page is fine).
4. In POTENT Live: host a public session → Start → press **Join the video & voice room** on two devices. Video/voice should connect. Cameras/mics start muted.
5. Host presses **Broadcast with OBS**, enters the server/username/password in OBS (Settings → Stream → Custom, "Use authentication"), starts streaming. The viewer link should play within ~10–20 seconds.
6. Studio → add a video → upload a file over 50 MB. It should upload and play from `files.potentworld.ink`.

## What it will cost / what you must maintain
- Server about $15–25/month. Bandwidth is the real cost if many people watch video; Hetzner includes a lot.
- Turn on Hetzner **backups/snapshots** (about 20% of server price). Videos live in `/srv/minio`.
- Security updates install automatically. Reboot the server once a month: `reboot`.
- Update the apps every few months: `cd /opt/potent-media && docker compose pull && docker compose up -d` and the same in the Jitsi folder under `/opt/jitsi/`.

## Known limits
- The OBS password travels unencrypted over RTMP. It only allows publishing to that one session, but treat it like a password and don't share the screen while it shows.
- Broadcasts are for public sessions only.
- Jitsi runs comfortably for a handful of performers and a few dozen watchers. For hundreds of live viewers, use the OBS broadcast instead of the video room.
- POTENT does not record. Jitsi recording/livestreaming are switched off.
- The 360° viewer needs a direct video file link, not an HLS broadcast.
