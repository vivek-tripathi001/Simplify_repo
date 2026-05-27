// src/services/chatBotService.js
// MODULE 3 — Interactive ChatBot (P3)
// SRS: FR-3.1 to FR-3.7 | ✅ Gemini 2.5 Flash

import { callGemini } from '../utils/geminiClient.js';
import { emitLog } from '../utils/sessionStore.js';
import { createError } from '../middleware/errorHandler.js';

const MAX_HISTORY      = 50;     // FR-3.5: sliding window
const MAX_CONTEXT_CHARS = 20000;
const RESPONSE_TIMEOUT  = 30000; // 30 seconds

// ── P3.1: Input Sanitizer (NFR-S3) ────────────────────────────────────────
function sanitizeInput(raw) {
  if (!raw || typeof raw !== 'string') throw createError('INVALID_URL', 400);
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 2000) throw createError('INVALID_URL', 400);
  return trimmed
    .replace(/<\/?[^>]+(>|$)/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

// ── P3.2: Context Builder ─────────────────────────────────────────────────
function buildSystemPrompt(session) {
  const meta    = session.repoMetadata || {};
  const summary = session.summary      || {};
  const stack   = session.techStack    || {};

  let ctx = `You are an AI assistant for the GitHub repository: ${meta.fullName || 'this repository'}.
Answer ALL questions based ONLY on the repository context provided below.
Do not invent code, functions, or features that are not in the context.

=== REPOSITORY ===
Name: ${meta.fullName}
Language: ${meta.language}
Description: ${meta.description || 'N/A'}
Tech Stack: Languages: ${(stack.languages||[]).join(', ')} | Frameworks: ${(stack.frameworks||[]).join(', ')}

=== OVERVIEW ===
${summary.overview || 'Not yet generated.'}

=== MODULES ===
${(summary.moduleSummaries||[]).map(m=>`- ${m.name}: ${m.description}`).join('\n')}

=== DESIGN PATTERNS ===
${(summary.designPatterns||[]).join(', ') || 'None detected'}

=== KEY DEPENDENCIES ===
${(summary.dependencies||[]).map(d=>`- ${d.name}: ${d.role}`).join('\n')}

=== DIRECTORY STRUCTURE ===
${buildTreeString(session.directoryTree, 0, 3)}`;

  // Attach source file snippets within budget
  let fileCtx = '\n\n=== SOURCE FILES ===\n';
  let charCount = ctx.length + fileCtx.length;
  for (const f of (session.sourceFiles || [])) {
    const snippet = `\n### ${f.path}\n${f.content.slice(0, 1500)}\n`;
    if (charCount + snippet.length > MAX_CONTEXT_CHARS) break;
    fileCtx  += snippet;
    charCount += snippet.length;
  }
  return ctx + fileCtx;
}

function buildTreeString(node, depth, maxDepth) {
  if (!node || depth > maxDepth) return '';
  const indent = '  '.repeat(depth);
  let out = `${indent}${node.type === 'directory' ? '📁' : '📄'} ${node.name}\n`;
  if (node.children) {
    for (const child of node.children.slice(0, 20)) {
      out += buildTreeString(child, depth + 1, maxDepth);
    }
  }
  return out;
}

// ── P3.6: Fallback Detector ───────────────────────────────────────────────
const FALLBACK_PHRASES = [
  "i don't have information",
  "i cannot find",
  "not available in the repository",
  "i don't see any",
  "i'm unable to",
  "no information about"
];

function isFallback(text) {
  const lower = text.toLowerCase();
  return FALLBACK_PHRASES.some(p => lower.includes(p));
}

// ── Main chat handler ─────────────────────────────────────────────────────
export async function processChat(session, sessionId, userMessage) {
  const sanitized = sanitizeInput(userMessage);
  emitLog(sessionId, 'INFO', 'P3-ChatBot', `Query: "${sanitized.slice(0, 60)}..."`);

  const systemPrompt = buildSystemPrompt(session);
  const history      = (session.chatHistory || []).slice(-MAX_HISTORY);

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: sanitized }
  ];

  // P3.3: Gemini request with timeout
  let responseText;
  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), RESPONSE_TIMEOUT)
    );
    responseText = await Promise.race([
      callGemini(messages, { maxTokens: 1000, temperature: 0.4 }),
      timeoutPromise
    ]);
  } catch (err) {
    console.error('[ChatBot] Gemini error:', err.message);
    throw createError('OPENAI_ERROR', 502);
  }

  const fallback = isFallback(responseText);

  // P3.5: Update history only on real responses (FR-3.6)
  if (!fallback) {
    session.chatHistory = [
      ...history,
      { role: 'user',      content: sanitized     },
      { role: 'assistant', content: responseText  }
    ].slice(-MAX_HISTORY);
  }

  emitLog(sessionId, 'INFO', 'P3-ChatBot',
    `Response: ${responseText.length} chars | fallback=${fallback}`);
  return { response: responseText, isFallback: fallback };
}
