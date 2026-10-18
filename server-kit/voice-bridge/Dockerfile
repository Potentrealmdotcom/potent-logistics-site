FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY bridge.js server.js ./
# realtime.js is copied here from netlify/functions/lib/voice/adapters by install-voice.sh so there is one copy of the message formats
COPY realtime.js ./
CMD ["node", "server.js"]
