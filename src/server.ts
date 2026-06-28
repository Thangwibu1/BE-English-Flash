import dotenv from 'dotenv';
import dns from 'dns';
import { createApp } from './app';
import { connectMongo } from './infrastructure/database/mongoose/connection';

// Force Node.js to resolve IPv4 first (fixes native fetch failed in alpine containers)
dns.setDefaultResultOrder('ipv4first');

dotenv.config();

async function bootstrap() {
  const port = process.env.PORT || 4000;

  // Connect database
  try {
    await connectMongo();
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    process.exit(1);
  }

  const app = createApp();

  app.listen(port, () => {
    console.log(`API running on port ${port}`);
  });
}

bootstrap().catch((error) => {
  console.error('Error bootstrapping application:', error);
  process.exit(1);
});
