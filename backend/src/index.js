// src/index.js — SimplifyRepo Backend Entry Point
// Three-tier architecture: Client → Express Server → External APIs (SDS §3.1)

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { analyzeRouter } from './routes/analyze.js';
import { chatRouter } from './routes/chat.js';
import { securityRouter } from './routes/security.js';
import { visualizerRouter } from './routes/visualizer.js';
import { wikiRouter } from './routes/wiki.js';
import { terminalRouter } from './routes/terminal.js';
import { sessionCleanup } from './utils/sessionStore.js';
import { createRateLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();
const PORT = process.env.PORT || 5000;

// ── Security middleware (NFR-S1, NFR-S3) ──────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || 'http://localhost:3000',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json({ limit: '1mb' }));

// ── Rate limiting (NFR-S5: 10 analysis requests per IP per hour) ──────────
app.use('/api/analyze', createRateLimiter(
  parseInt(process.env.RATE_LIMIT_MAX) || 10,
  parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 3600000
));

// ── Routes ─────────────────────────────────────────────────────────────────
app.use('/api/analyze',    analyzeRouter);    // P1: Repository Ingestion
app.use('/api/chat',       chatRouter);       // P3: Interactive ChatBot
app.use('/api/security',   securityRouter);   // P4: Security Gate
app.use('/api/visualizer', visualizerRouter); // P5: Pro-Mode Visualizer
app.use('/api/wiki',       wikiRouter);       // P6: Wiki Generator
app.use('/api/terminal',   terminalRouter);   // P7: Developer Terminal

// ── Health check ──────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', version: '1.0.0' }));

// ── Global error handler (NFR-U4: non-technical error messages) ───────────
app.use(errorHandler);

// ── Session cleanup — purge expired sessions every 10 minutes (SRS §7.3) ─
setInterval(sessionCleanup, 10 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`[SimplifyRepo] Server running on port ${PORT}`);
});
