import express from 'express';
import cors from 'cors';
import { errorMiddleware } from './interfaces/http/middlewares/errorMiddleware';
import { authRoutes } from './interfaces/http/routes/auth.routes';
import { vocabularyRoutes } from './interfaces/http/routes/vocabulary.routes';
import { readingRoutes } from './interfaces/http/routes/reading.routes';
import { flashcardRoutes } from './interfaces/http/routes/flashcard.routes';
import { topicRoutes } from './interfaces/http/routes/topic.routes';
import { contributionRoutes } from './interfaces/http/routes/contribution.routes';
import { streakRoutes } from './interfaces/http/routes/streak.routes';
import { authMiddleware } from './interfaces/http/middlewares/authMiddleware';
import { buildContainer } from './shared/container/buildContainer';

export function createApp() {
  const app = express();
  const { authController } = buildContainer();

  app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  }));

  app.use(express.json({ limit: '2mb' }));

  // Health check route
  app.get('/api/health', (req, res) => {
    res.json({
      success: true,
      message: 'OK',
      timestamp: new Date(),
    });
  });

  // Me route
  app.get('/api/me', authMiddleware, authController.getMe);

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/vocabularies', vocabularyRoutes);
  app.use('/api/readings', readingRoutes);
  app.use('/api/flashcard-decks', flashcardRoutes);
  app.use('/api/topics', topicRoutes);
  app.use('/api/contributions', contributionRoutes);
  app.use('/api', streakRoutes);

  // Global Error Handler
  app.use(errorMiddleware);

  return app;
}
