// src/routes/security.js — P4: Security Gate
import { Router } from 'express';
import { getSession, updateSession } from '../utils/sessionStore.js';
import { runSecurityScan, exportToMarkdown } from '../services/securityService.js';
export const securityRouter = Router();

securityRouter.post('/scan', async (req, res, next) => {
  try {
    const { sessionId } = req.body;
    const session = getSession(sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found or expired.', code: 'SESSION_NOT_FOUND' });
    if (!session.sourceFiles?.length) return res.status(400).json({ error: 'No source files. Please analyze a repository first.' });

    const report = await runSecurityScan(session, sessionId);
    updateSession(sessionId, { securityReport: report });
    res.json(report);
  } catch (err) { next(err); }
});

securityRouter.get('/:sessionId/export', (req, res) => {
  const session = getSession(req.params.sessionId);
  if (!session?.securityReport) return res.status(404).json({ error: 'No security report available.' });
  const markdown = exportToMarkdown(session.securityReport);
  res.setHeader('Content-Type', 'text/markdown');
  res.setHeader('Content-Disposition', `attachment; filename="security-report-${req.params.sessionId.slice(0, 8)}.md"`);
  res.send(markdown);
});
