// src/routes/terminal.js — P7: Developer Terminal (SSE)
// SRS: FR-7.1 to FR-7.5 | SDS: §2.6.9
// Establishes SSE stream; all log events broadcast from sessionStore.emitLog/emitStep

import { Router } from 'express';
import { getSession, addSSEClient, removeSSEClient } from '../utils/sessionStore.js';
export const terminalRouter = Router();

// FR-7.1: SSE stream endpoint — GET /api/terminal/stream?sessionId=xxx
terminalRouter.get('/stream', (req, res) => {
  const { sessionId } = req.query;
  const session = getSession(sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found or expired.' });

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable Nginx buffering on Render
  res.flushHeaders();

  // Register this client
  addSSEClient(sessionId, res);

  // Replay existing logs for reconnection (Last-Event-ID support)
  const existingLogs = session.logs || [];
  for (const log of existingLogs) {
    res.write(`data: ${JSON.stringify({ type: 'log', data: log })}\n\n`);
  }

  // Keep-alive ping every 15s (SDS §7.7)
  const keepAlive = setInterval(() => {
    try { res.write(': keepalive\n\n'); } catch (_) { clearInterval(keepAlive); }
  }, 15000);

  // Cleanup on client disconnect
  req.on('close', () => {
    clearInterval(keepAlive);
    removeSSEClient(sessionId, res);
  });
});

// FR-7.3: Get filtered logs (REST fallback for polling clients)
terminalRouter.get('/logs/:sessionId', (req, res) => {
  const session = getSession(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found.' });

  const { level } = req.query; // 'INFO' | 'WARNING' | 'ERROR' | undefined (all)
  const logs = level
    ? session.logs.filter(l => l.level === level.toUpperCase())
    : session.logs;

  res.json({ logs, total: session.logs.length, filtered: logs.length });
});

// FR-7.4: Download full session log as .txt
terminalRouter.get('/logs/:sessionId/export', (req, res) => {
  const session = getSession(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found.' });

  const text = session.logs
    .map(l => `[${l.timestamp}] [${l.level}] [${l.module}] ${l.message}`)
    .join('\n');

  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Content-Disposition', `attachment; filename="session-${req.params.sessionId.slice(0, 8)}-logs.txt"`);
  res.send(text);
});
