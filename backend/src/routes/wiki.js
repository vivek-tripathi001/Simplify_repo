// src/routes/wiki.js — P6: Wiki Generator
import { Router } from 'express';
import { getSession, updateSession } from '../utils/sessionStore.js';
import { generateWiki } from '../services/wikiService.js';
export const wikiRouter = Router();

wikiRouter.post('/generate', async (req, res, next) => {
  try {
    const { sessionId } = req.body;
    const session = getSession(sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found or expired.', code: 'SESSION_NOT_FOUND' });
    if (!session.summary) return res.status(400).json({ error: 'Summary not available. Please analyze a repository first.' });

    const { wikiMarkdown, gapReport } = await generateWiki(session, sessionId);
    updateSession(sessionId, { wikiMarkdown });
    res.json({ wikiMarkdown, gapReport });
  } catch (err) { next(err); }
});

// FR-6.5: Export as .md file
wikiRouter.get('/:sessionId/export', (req, res) => {
  const session = getSession(req.params.sessionId);
  if (!session?.wikiMarkdown) return res.status(404).json({ error: 'No wiki available. Generate it first.' });
  res.setHeader('Content-Type', 'text/markdown');
  res.setHeader('Content-Disposition', `attachment; filename="${session.repoMetadata?.name || 'project'}-wiki.md"`);
  res.send(session.wikiMarkdown);
});
