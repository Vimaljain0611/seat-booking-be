import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { z } from 'zod';
import { connectDb, seatCollection } from './db.js';
import { holds } from './holds.js';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const origin = process.env.FRONTEND_ORIGIN?.split(',').map(s => s.trim()) || [];
app.use(cors({ origin: (o, cb) => cb(null, !o || origin.includes(o)) }));
app.use(express.json());
type SeatStatus = 'available' | 'held' | 'booked';
const userSchema = z.object({ userId: z.string().trim().min(1).max(80).regex(/^[\w-]+$/) });
const seatPattern = /^[A-D][1-5]$/;
function broadcast(event: unknown) { const msg = JSON.stringify(event); wss.clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(msg); }); }
async function expire(id: string) { const h = holds.get(id); if (h && h.expiresAt <= Date.now()) { holds.delete(id); broadcast({ type: 'seat.updated', seatId: id }); return true; } return false; }
async function seatView() {
  const docs = await seatCollection().find().sort({ _id: 1 }).toArray();
  return docs.map(s => {
    const h = holds.get(s._id);
    if (h && h.expiresAt <= Date.now()) { holds.delete(s._id); setTimeout(() => broadcast({ type: 'seat.updated', seatId: s._id }), 0); }
    const active = holds.get(s._id);
    return active ? { id: s._id, status: 'held' as SeatStatus, heldBy: active.userId, holdExpiresAt: new Date(active.expiresAt).toISOString() } : { id: s._id, status: s.status };
  });
}
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/api/seats', async (_req, res, next) => { try { res.json({ seats: await seatView() }); } catch (e) { next(e); } });
app.post('/api/seats/:id/hold', async (req, res, next) => {
  try {
    if (!seatPattern.test(req.params.id)) return res.status(400).json({ error: { code: 'VALIDATION', message: 'Seat ID must be A1–D5.' } });
    const parsed = userSchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: { code: 'VALIDATION', message: 'Enter a valid user ID (1–80 letters, numbers, _ or -).' } });
    const id = req.params.id, { userId } = parsed.data; await expire(id);
    const seat = await seatCollection().findOne({ _id: id });
    if (!seat) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Seat not found.' } });
    if (seat.status === 'booked') return res.status(409).json({ error: { code: 'CONFLICT', message: 'This seat is already booked.' } });
    const current = holds.get(id); if (current && current.userId !== userId) return res.status(409).json({ error: { code: 'CONFLICT', message: 'This seat is held by another user.' } });
    const duration = Math.max(1, Number(process.env.HOLD_DURATION_SECONDS) || 60), hold = { userId, expiresAt: Date.now() + duration * 1000 };
    holds.set(id, hold); setTimeout(() => { if (holds.get(id) === hold) { holds.delete(id); broadcast({ type: 'seat.updated', seatId: id }); } }, duration * 1000 + 10);
    broadcast({ type: 'seat.updated', seatId: id }); res.json({ id, status: 'held', heldBy: userId, holdExpiresAt: new Date(hold.expiresAt).toISOString() });
  } catch (e) { next(e); }
});
app.post('/api/seats/:id/confirm', async (req, res, next) => {
  try {
    if (!seatPattern.test(req.params.id)) return res.status(400).json({ error: { code: 'VALIDATION', message: 'Seat ID must be A1–D5.' } });
    const parsed = userSchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: { code: 'VALIDATION', message: 'Enter a valid user ID.' } });
    const id = req.params.id, { userId } = parsed.data; await expire(id);
    const hold = holds.get(id); if (!hold) return res.status(410).json({ error: { code: 'HOLD_EXPIRED', message: 'Your hold expired. Select the seat again to try.' } });
    if (hold.userId !== userId) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'This seat is held by another user.' } });
    if (hold.expiresAt <= Date.now()) { holds.delete(id); broadcast({ type: 'seat.updated', seatId: id }); return res.status(410).json({ error: { code: 'HOLD_EXPIRED', message: 'Your hold expired. Select the seat again to try.' } }); }
    const bookedAt = new Date();
    const result = await seatCollection().findOneAndUpdate({ _id: id, status: 'available' }, { $set: { status: 'booked', bookedBy: userId, bookedAt } }, { returnDocument: 'after' });
    if (!result) return res.status(409).json({ error: { code: 'CONFLICT', message: 'This seat was already booked.' } });
    holds.delete(id); const seat = { id, status: 'booked', bookedBy: userId, bookedAt: bookedAt.toISOString() };
    broadcast({ type: 'seat.updated', seatId: id }); res.json({ seat });
  } catch (e) { next(e); }
});
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => { console.error(err); res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong. Please try again.' } }); });
app.use((_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint not found.' } }));
wss.on('connection', ws => { ws.send(JSON.stringify({ type: 'connected' })); });
const port = Number(process.env.PORT) || 3001;
connectDb().then(async () => { const count = await seatCollection().countDocuments(); if (count !== 20) console.warn(`Database has ${count} seats; run npm run seed to initialize.`); server.listen(port, () => console.log(`Seat API listening on ${port}`)); }).catch(err => { console.error('MongoDB connection failed', err); process.exit(1); });
