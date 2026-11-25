# Seat booking API

Node.js + Express + TypeScript API with WebSocket updates and MongoDB persistence.

## Local setup
1. Create a MongoDB database and copy `.env.example` to `.env`; set `MONGODB_URI`, `MONGODB_DATABASE`, and `FRONTEND_ORIGIN`.
2. Run `npm install`, `npm run seed`, `npm run dev`.
3. API defaults to `http://localhost:3001`; WebSocket endpoint is `/ws`.

`HOLD_DURATION_SECONDS` defaults to 60. Hold state is memory-only and assumes one backend instance. Booking uses a conditional MongoDB update. The seed command preserves existing seat data.

## Render
Create a Node Web Service from this repository with the repository root as its root directory, build command `npm install && npm run build`, and start command `npm start`. Add `MONGODB_URI`, `MONGODB_DATABASE`, `HOLD_DURATION_SECONDS`, and the deployed `FRONTEND_ORIGIN`. Render supports WebSockets on the same service URL; use `wss://` from HTTPS frontend deployments.
