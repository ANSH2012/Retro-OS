import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Change working directory to parent so API imports work
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
process.chdir(path.dirname(__dirname));

// Import API handlers
import noticeboardHandler from '../api/noticeboard.js';
import guestbookHandler from '../api/guestbook.js';
import browserHandler from '../api/browser.js';
import healthHandler from '../api/health.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 10 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  }
});

app.use('/api/', limiter);

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowed = process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',')
      : [];
    const defaultAllowed = [
      'http://localhost:3000',
      'http://localhost:5500',
      'http://127.0.0.1:5500'
    ];

    if (!origin || allowed.includes(origin) || defaultAllowed.includes(origin) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'RetroOS Email Service is running',
    timestamp: new Date().toISOString()
  });
});

// API routes
app.all('/api/noticeboard', (req, res) => noticeboardHandler(req, res));
app.all('/api/guestbook', (req, res) => guestbookHandler(req, res));
app.all('/api/browser', (req, res) => browserHandler(req, res));
app.all('/api/health', (req, res) => healthHandler(req, res));

// Catch-all route for 404
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Error handler
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 RetroOS Server running on port ${PORT}`);
  console.log('');
  console.log('🔗 Direct Access Links:');
  console.log(`   Health Check: http://localhost:${PORT}/api/health`);
  console.log(`   Frontend:     http://localhost:3000`);
  console.log('');
});

export default app;
