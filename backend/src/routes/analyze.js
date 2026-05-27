// src/routes/analyze.js — P1 (Ingestion) + P2 (Summarization) orchestration
import { Router } from 'express';
import {
  createSession, getSession, updateSession, emitLog, emitStep
} from '../utils/sessionStore.js';
import {
  validateGitHubURL, fetchRepoMetadata, cloneAndParse,
  detectEntryPoints, identifyTechStack
} from '../services/ingestionService.js';
import { generateSummary } from '../services/summaryService.js';

export const analyzeRouter = Router();

// POST /api/analyze — Start full P1+P2 pipeline, returns sessionId immediately
analyzeRouter.post('/', async (req, res) => {
  const { url } = req.body;
  let sessionId;

  try {
    // P1.1: URL Validation (FR-1.1)
    const { validatedURL, owner, repo } = validateGitHubURL(url);

    sessionId = createSession();
    emitLog(sessionId, 'INFO', 'P1-Ingestion', `Analysis started for ${validatedURL}`);

    // Respond immediately — pipeline runs async, progress via SSE (FR-2.7)
    res.json({ sessionId, status: 'started' });

    // ── P1 Pipeline ───────────────────────────────────────────────────────
    emitStep(sessionId, 'STEP_START', 'P1-Ingestion', 'metadata-fetch');

    // P1.2: Metadata Fetcher (FR-1.5, FR-1.8)
    const repoMetadata = await fetchRepoMetadata(owner, repo, sessionId);
    updateSession(sessionId, { repoURL: validatedURL, repoMetadata });
    emitStep(sessionId, 'STEP_COMPLETE', 'P1-Ingestion', 'metadata-fetch');

    // P1.3: Git Clone & Parse (FR-1.2, FR-1.3, FR-1.7)
    const { cloneDir, directoryTree, sourceFiles } = await cloneAndParse(validatedURL, sessionId);

    // P1.4: Entry Point Detector (FR-1.4)
    const entryPoints = detectEntryPoints(sourceFiles);
    emitLog(sessionId, 'INFO', 'P1-Ingestion',
      `Entry points detected: ${entryPoints.join(', ') || 'none'}`);

    // P1.5: Tech Stack Identifier (FR-1.6)
    const techStack = identifyTechStack(sourceFiles, directoryTree);
    emitLog(sessionId, 'INFO', 'P1-Ingestion',
      `Tech stack: ${techStack.languages.join(', ') || 'unknown'}`);

    updateSession(sessionId, { directoryTree, sourceFiles, entryPoints, techStack, cloneDir });
    emitStep(sessionId, 'STEP_COMPLETE', 'P1-Ingestion', 'full-ingestion');
    emitLog(sessionId, 'INFO', 'P1-Ingestion', 'Repository ingestion complete ✓');

    // ── P2 Pipeline (auto-triggered after P1 per SDS UC-2) ────────────────
    const session = getSession(sessionId);
    const summary = await generateSummary(session, sessionId);
    updateSession(sessionId, { summary });
    emitLog(sessionId, 'INFO', 'P2-Summarization', 'AI summarization complete ✓');

    // Broadcast analysis_complete to all connected SSE clients (P7)
    const finalSession = getSession(sessionId);
    if (finalSession) {
      const msg = `data: ${JSON.stringify({ type: 'analysis_complete', sessionId })}\n\n`;
      for (const client of finalSession.sseClients) {
        try { client.write(msg); } catch (_) {}
      }
    }
  } catch (err) {
    if (sessionId) {
      emitLog(sessionId, 'ERROR', 'P1-Ingestion', err.message || 'Analysis failed');
      emitStep(sessionId, 'STEP_ERROR', 'P1-Ingestion', 'pipeline', { error: err.message });
      // Broadcast error so frontend unblocks
      const s = getSession(sessionId);
      if (s) {
        const msg = `data: ${JSON.stringify({ type: 'analysis_error', error: err.message })}\n\n`;
        for (const client of s.sseClients) { try { client.write(msg); } catch (_) {} }
      }
    }
    console.error('[AnalyzeRoute]', err.code || err.message);
  }
});

// GET /api/analyze/:sessionId — Poll current session state
analyzeRouter.get('/:sessionId', (req, res) => {
  const session = getSession(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found or expired.', code: 'SESSION_NOT_FOUND' });
  }
  res.json({
    sessionId:    session.sessionId,
    repoMetadata: session.repoMetadata,
    directoryTree:session.directoryTree,
    entryPoints:  session.entryPoints,
    techStack:    session.techStack,
    summary:      session.summary,
    hasSecurity:  !!session.securityReport,
    hasWiki:      !!session.wikiMarkdown,
    hasDiagram:   !!session.mermaidCode
  });
});
