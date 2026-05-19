import mongoose from 'mongoose';
import 'dotenv/config';

await mongoose.connect(process.env.MONGODB_URI);
const result = await mongoose.connection.db.collection('opportunities').deleteMany({});
console.log(`Cleared ${result.deletedCount} old records`);
process.exit(0);
