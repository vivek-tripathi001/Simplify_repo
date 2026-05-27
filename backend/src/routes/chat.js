// src/routes/chat.js — P3: Interactive ChatBot
import { Router } from 'express';
import { getSession, updateSession } from '../utils/sessionStore.js';
import { processChat } from '../services/chatBotService.js';
export const chatRouter = Router();

chatRouter.post('/', async (req, res, next) => {
  try {
    const { sessionId, message } = req.body;
    const session = getSession(sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found or expired.', code: 'SESSION_NOT_FOUND' });
    if (!session.summary) return res.status(400).json({ error: 'Analysis not complete. Please analyze a repository first.' });

    const result = await processChat(session, sessionId, message);
    // chatHistory is mutated in-place by processChat
    res.json(result);
  } catch (err) { next(err); }
});

chatRouter.delete('/:sessionId/history', (req, res) => {
  const session = getSession(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found.' });
  updateSession(req.params.sessionId, { chatHistory: [] });
  res.json({ cleared: true });
});
