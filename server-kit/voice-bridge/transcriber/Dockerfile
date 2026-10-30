# Canonical transcriber: turns each call's Twilio recording into the word-for-word
# transcript (faster-whisper) on the bridge host. Runs next to the bridge container;
# shares no state with it — all coordination goes through the site (voice-tools).
FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY transcriber.py ./
CMD ["python", "transcriber.py"]
