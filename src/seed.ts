import 'dotenv/config';
import { connectDb, seatCollection } from './db.js';
await connectDb();
const docs = ['A','B','C','D'].flatMap(row => [1,2,3,4,5].map(n => ({ _id: `${row}${n}`, status: 'available' as const, bookedBy: null, bookedAt: null })));
await seatCollection().bulkWrite(docs.map(document => ({ updateOne: { filter: { _id: document._id }, update: { $setOnInsert: document }, upsert: true } })));
console.log('Seeded 20 seats (existing seat data preserved).');
process.exit(0);
