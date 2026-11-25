import { MongoClient, Collection } from 'mongodb';
export interface Seat { _id: string; status: 'available' | 'booked'; bookedBy: string | null; bookedAt: Date | null }
const client = new MongoClient(process.env.MONGODB_URI!);
let seats: Collection<Seat>;
export async function connectDb() {
  await client.connect();
  seats = client.db(process.env.MONGODB_DATABASE || 'seat_booking').collection<Seat>('seats');
  await seats.createIndex({ status: 1 });
}
export function seatCollection() { if (!seats) throw new Error('Database not connected'); return seats; }
