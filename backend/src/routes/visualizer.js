// src/routes/visualizer.js — P5: Pro-Mode Visualizer
import { Router } from 'express';
import { getSession, updateSession } from '../utils/sessionStore.js';
import { generateDiagram } from '../services/visualizerService.js';
export const visualizerRouter = Router();

visualizerRouter.post('/generate', async (req, res, next) => {
  try {
    const { sessionId, diagramType = 'flowchart' } = req.body;
    const session = getSession(sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found or expired.', code: 'SESSION_NOT_FOUND' });
    if (!session.summary) return res.status(400).json({ error: 'Summary not available. Please analyze a repository first.' });

    const mermaidCode = await generateDiagram(session, sessionId, diagramType);
    updateSession(sessionId, { mermaidCode });
    res.json({ mermaidCode, diagramType });
  } catch (err) { next(err); }
});
