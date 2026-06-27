import mongoose from 'mongoose';

export async function connectMongo() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error('Missing MONGODB_URI environment variable');
  }

  await mongoose.connect(uri);
  console.log('MongoDB connected successfully');
}
