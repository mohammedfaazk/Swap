import express, { Request, Response, NextFunction } from 'express';
import morgan from 'morgan';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from './middleware/rateLimit';
import authMiddleware from './middleware/auth';
import validationMiddleware from './middleware/validation';

import swapsRoutes from './routes/swaps';
import resolversRoutes from './routes/resolvers';
import statusRoutes from './routes/status';

const app = express();

// Basic security headers
app.use(helmet());

// Enable CORS - you can customize origin as needed
app.use(cors());

// Logging HTTP requests
app.use(morgan('combined'));

// Parse JSON bodies
app.use(express.json());

// Rate limiting middleware - protect against DoS attacks
app.use(rateLimit);

// Simple authentication middleware for protected routes
app.use(authMiddleware);

// Validation middleware
app.use(validationMiddleware);

// API route mounts
app.use('/api/swaps', swapsRoutes);
app.use('/api/resolvers', resolversRoutes);
app.use('/api/status', statusRoutes);

// Basic health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'OK' });
});

// Global error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

export default app;
