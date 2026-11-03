FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY bridge.js server.js ./
# gemini-live.js is copied here from netlify/functions/lib/voice/adapters by the install scripts so there is one copy of the message formats
COPY gemini-live.js ./
# the approved ambience recordings (beds/*.ulaw.b64) the bridge mixes under her voice
COPY beds ./beds
CMD ["node", "server.js"]
