#!/usr/bin/env python3
"""POTENT VOICE canonical transcriber (bridge host).

The live transcript (Gemini Live's in-call transcription) errs: it once stored the caller as
saying "1,500 Peachtree Street" when he said 1200. Tony's rule (Oct 30, 2026): the transcript
must be word for word or the product is pointless. Calls are recorded on Twilio whenever
recording is on; this worker turns that recording into the session's canonical transcript.

Loop: poll the site (voice-tools, bridge secret) for canonical_jobs -> for each job, fetch the
call's Twilio recording -> transcribe with faster-whisper -> POST canonical_transcript, which
replaces the live rows and releases the owner report. Dual-channel recordings are transcribed
per channel, so caller/agent separation is exact. A mono recording is role-anchored against
the live transcript's turn order (text from the recording, roles from the live skeleton).
If the recording never completes or transcription fails, POST canonical_giveup before the
job's deadline so the owner report still goes out with the live transcript.

Env: SITE_URL, VOICE_BRIDGE_SECRET, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
     WHISPER_MODEL (default "small"), CANONICAL_POLL_SEC (default 15),
     TWILIO_CALLER_CHANNEL (0 or 1; default: auto — the agent greets first, so the channel
     whose speech starts first is the agent's).

Offline proof mode (no network):  transcriber.py --file CALL.m4a --live live.json --out out.json
where live.json is [{"role": "agent"|"caller", "text": "..."}] in stored order.
"""
import base64
import difflib
import io
import json
import os
import re
import sys
import time
import urllib.request
import urllib.error
import wave

import numpy as np

MODEL = None


def log(*a):
    print(time.strftime("%Y-%m-%dT%H:%M:%S"), *a, flush=True)


def get_model():
    global MODEL
    if MODEL is None:
        from faster_whisper import WhisperModel
        name = os.environ.get("WHISPER_MODEL", "small")
        MODEL = WhisperModel(name, device="cpu", compute_type="int8")
        log("whisper model loaded:", name)
    return MODEL


def http_json(url, data=None, headers=None, timeout=30):
    req = urllib.request.Request(url, data=(json.dumps(data).encode() if data is not None else None),
                                 headers=dict(headers or {}, **({"Content-Type": "application/json"} if data is not None else {})),
                                 method="POST" if data is not None else "GET")
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8") or "{}")


def http_bytes(url, headers=None, timeout=120):
    req = urllib.request.Request(url, headers=headers or {})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def site(body):
    return http_json(os.environ["SITE_URL"].rstrip("/") + "/.netlify/functions/voice-tools",
                     data=body, headers={"Authorization": "Bearer " + os.environ["VOICE_BRIDGE_SECRET"]}, timeout=30)


def twilio_auth():
    return {"Authorization": "Basic " + base64.b64encode((os.environ["TWILIO_ACCOUNT_SID"] + ":" + os.environ["TWILIO_AUTH_TOKEN"]).encode()).decode()}


# ---------- transcription ----------

def transcribe_array(samples):
    """samples: float32 mono 16 kHz. Returns [{start, end, text}] with empty/noise segments dropped."""
    segs, _info = get_model().transcribe(samples, beam_size=5, vad_filter=True,
                                         vad_parameters={"min_silence_duration_ms": 400})
    out = []
    for s in segs:
        t = (s.text or "").strip()
        if t:
            out.append({"start": float(s.start), "end": float(s.end), "text": t})
    return out


def split_wav_channels(wav_bytes):
    """Returns a list of float32 mono 16 kHz arrays, one per channel, or None if not PCM WAV."""
    try:
        w = wave.open(io.BytesIO(wav_bytes))
    except Exception:
        return None
    n_ch, width, rate, n = w.getnchannels(), w.getsampwidth(), w.getframerate(), w.getnframes()
    if width != 2:
        return None
    raw = np.frombuffer(w.readframes(n), dtype=np.int16).astype(np.float32) / 32768.0
    chans = [raw[i::n_ch].copy() for i in range(n_ch)]
    if rate != 16000:  # linear resample; phone audio is narrowband, this is adequate for ASR
        chans = [np.interp(np.linspace(0, len(c) - 1, int(len(c) * 16000 / rate)), np.arange(len(c)), c).astype(np.float32) for c in chans]
    return chans


def merge_segments(tagged):
    """tagged: [{start, end, text, role}] across channels -> transcript lines, consecutive
    same-role segments joined the way a person reads a transcript."""
    lines = []
    for s in sorted(tagged, key=lambda x: (x["start"], x["end"])):
        if lines and lines[-1]["role"] == s["role"] and s["start"] - lines[-1]["end"] < 1.2:
            lines[-1]["text"] = (lines[-1]["text"] + " " + s["text"]).strip()
            lines[-1]["end"] = s["end"]
        else:
            lines.append({"role": s["role"], "text": s["text"], "start": s["start"], "end": s["end"]})
    return [{"role": l["role"], "text": l["text"]} for l in lines if l["text"].strip()]


def lines_from_dual(chans):
    per = [transcribe_array(c) for c in chans[:2]]
    firsts = [(p[0]["start"] if p else 1e18) for p in per]
    forced = os.environ.get("TWILIO_CALLER_CHANNEL")
    caller_ch = int(forced) if forced in ("0", "1") else (0 if firsts[0] > firsts[1] else 1)
    tagged = []
    for ch, segs in enumerate(per):
        role = "caller" if ch == caller_ch else "agent"
        tagged += [dict(s, role=role) for s in segs]
    return merge_segments(tagged), "twilio-dual:caller_ch%d" % caller_ch


_NORM = re.compile(r"[^a-z0-9 ]+")


def _norm(t):
    return " ".join(_NORM.sub(" ", str(t).lower()).split())


def lines_from_mono(samples, live_lines):
    """Mono recording: the text comes from the recording; the speaker of each segment is anchored
    to the live transcript's turn order (the live text is wrong in places, its turn skeleton is
    not). Unmatched segments inherit the previous segment's role."""
    segs = transcribe_array(samples)
    if not segs:
        return [], "mono:no-speech"
    anchors = []          # (seg_index, role) for segments matched to a live line
    j = 0                 # whisper segment cursor; matching only moves forward
    for line in live_lines or []:
        want = _norm(line.get("text", ""))
        if not want:
            continue
        best, best_i, best_r = None, None, 0.45
        window = ""
        for i in range(j, min(j + 6, len(segs))):
            window = (window + " " + _norm(segs[i]["text"])).strip()
            r = difflib.SequenceMatcher(None, want, window).ratio()
            if r > best_r:
                best, best_i, best_r = window, i, r
        if best_i is not None:
            for i in range(j, best_i + 1):
                anchors.append((i, line["role"]))
            j = best_i + 1
    role_of = {}
    for i, role in anchors:
        role_of[i] = role
    last = "agent"        # the agent greets first on every call
    tagged = []
    for i, s in enumerate(segs):
        last = role_of.get(i, last)
        tagged.append(dict(s, role=last))
    return merge_segments(tagged), "mono:anchored(%d/%d)" % (len(anchors), len(segs))


def lines_from_file(path, live_lines):
    """Any audio file (offline proof + mp3 fallback): decode, then dual if 2ch WAV else mono."""
    with open(path, "rb") as f:
        data = f.read()
    chans = split_wav_channels(data)
    if chans and len(chans) >= 2:
        return lines_from_dual(chans)
    from faster_whisper.audio import decode_audio
    return lines_from_mono(decode_audio(path), live_lines)


# ---------- job processing ----------

def fetch_recording(call_sid):
    sid = os.environ["TWILIO_ACCOUNT_SID"]
    url = "https://api.twilio.com/2010-04-01/Accounts/%s/Calls/%s/Recordings.json" % (sid, call_sid)
    d = http_json(url, headers=twilio_auth())
    recs = [r for r in d.get("recordings", []) if r.get("status") == "completed"]
    if not recs:
        return None, False
    recs.sort(key=lambda r: (int(r.get("channels") or 1), r.get("date_created") or ""), reverse=True)
    rec = recs[0]
    media = "https://api.twilio.com/2010-04-01/Accounts/%s/Recordings/%s.wav" % (sid, rec["sid"])
    return (rec, http_bytes(media, headers=twilio_auth())), True


def process(job):
    sid = job["session_id"]
    deadline = job.get("deadline")
    if deadline:
        from datetime import datetime, timezone
        try:
            dl = datetime.fromisoformat(str(deadline).replace("Z", "+00:00"))
            if datetime.now(timezone.utc) > dl:
                site({"action": "canonical_giveup", "session_id": sid, "why": "deadline_passed"})
                log("giveup (deadline)", sid)
                return
        except Exception:
            pass
    payload, ready = fetch_recording(job["call_sid"])
    if not ready:
        log("recording not ready", sid)   # retried on the next poll until the deadline giveup above
        return
    rec, wav_bytes = payload
    with open("/tmp/rec-%s.wav" % rec["sid"], "wb") as f:
        f.write(wav_bytes)
    chans = split_wav_channels(wav_bytes)
    if chans and len(chans) >= 2:
        lines, source = lines_from_dual(chans)
    else:
        lines, source = lines_from_file("/tmp/rec-%s.wav" % rec["sid"], job.get("live_lines") or [])
    if not lines:
        site({"action": "canonical_giveup", "session_id": sid, "why": "empty_transcription"})
        log("giveup (empty)", sid)
        return
    r = site({"action": "canonical_transcript", "session_id": sid, "lines": lines,
              "engine": "faster-whisper-" + os.environ.get("WHISPER_MODEL", "small"), "source": source})
    log("canonical stored", sid, len(lines), "lines", source, r.get("ok"))


def main():
    if "--file" in sys.argv:
        path = sys.argv[sys.argv.index("--file") + 1]
        live = []
        if "--live" in sys.argv:
            with open(sys.argv[sys.argv.index("--live") + 1]) as f:
                live = json.load(f)
        lines, source = lines_from_file(path, live)
        out = {"source": source, "lines": lines}
        dest = sys.argv[sys.argv.index("--out") + 1] if "--out" in sys.argv else None
        if dest:
            with open(dest, "w") as f:
                json.dump(out, f, indent=1)
        print(json.dumps(out, indent=1))
        return
    poll = int(os.environ.get("CANONICAL_POLL_SEC", "15"))
    log("canonical transcriber up; poll", poll, "s")
    while True:
        try:
            jobs = site({"action": "canonical_jobs"}).get("jobs", [])
            for job in jobs:
                try:
                    process(job)
                except Exception as e:  # one bad job never kills the loop; the deadline giveup covers it
                    log("job error", job.get("session_id"), repr(e))
        except Exception as e:
            log("poll error", repr(e))
        time.sleep(poll)


if __name__ == "__main__":
    main()
