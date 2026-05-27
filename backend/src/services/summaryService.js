// src/services/summaryService.js
// MODULE 2 — AI Summarization Engine (P2)
// SRS: FR-2.1 to FR-2.7 | ✅ Gemini 2.5 Flash

import { callGeminiWithRetry } from '../utils/geminiClient.js';
import { emitLog, emitStep } from '../utils/sessionStore.js';

const MAX_CHUNK_CHARS = 28000; // ~7000 tokens × 4 chars/token

// ── P2.1: Context Chunker (FR-2.5) ────────────────────────────────────────
export function chunkSourceFiles(sourceFiles) {
  const chunks = [];
  let current = '';
  let currentFiles = [];
  for (const file of sourceFiles) {
    const block = `\n\n### FILE: ${file.path}\n${file.content}`;
    if (current.length + block.length > MAX_CHUNK_CHARS && current.length > 0) {
      chunks.push({ content: current, files: currentFiles });
      current = block;
      currentFiles = [file.path];
    } else {
      current += block;
      currentFiles.push(file.path);
    }
  }
  if (current) chunks.push({ content: current, files: currentFiles });
  return chunks;
}

// ── P2.2: Repo Overview (FR-2.1) ──────────────────────────────────────────
async function generateOverview(repoMetadata, chunks, techStack, sessionId) {
  emitLog(sessionId, 'INFO', 'P2-Summarization', 'Generating repository overview...');
  emitStep(sessionId, 'STEP_START', 'P2-Summarization', 'overview-generation');

  const result = await callGeminiWithRetry([
    {
      role: 'system',
      content: `You are a senior software architect. Write a clear 200–400 word overview of this repository covering:
1) Purpose and domain  2) High-level architecture  3) Main features.
Be specific and factual.`
    },
    {
      role: 'user',
      content: `Repository: ${repoMetadata.fullName}
Description: ${repoMetadata.description || 'None'}
Language: ${repoMetadata.language}
Tech Stack: ${JSON.stringify(techStack)}

Source files sample:
${chunks[0]?.content?.slice(0, 6000) || '(none)'}`
    }
  ], { maxTokens: 800, temperature: 0.3 });

  emitStep(sessionId, 'STEP_COMPLETE', 'P2-Summarization', 'overview-generation');
  return result;
}

// ── P2.3: Module Summarizer (FR-2.2) ─────────────────────────────────────
async function generateModuleSummaries(directoryTree, chunks, sessionId) {
  emitLog(sessionId, 'INFO', 'P2-Summarization', 'Generating module summaries...');
  emitStep(sessionId, 'STEP_START', 'P2-Summarization', 'module-summaries');

  const topDirs = (directoryTree?.children || []).filter(n => n.type === 'directory');
  if (!topDirs.length) return [];

  const raw = await callGeminiWithRetry([
    {
      role: 'system',
      content: `For each directory listed, write a 1–2 sentence description of its purpose.
Return ONLY a valid JSON array with no markdown fences:
[{"name":"dir_name","description":"..."}]`
    },
    {
      role: 'user',
      content: `Directories: ${topDirs.map(d => d.name).join(', ')}

Code sample:
${chunks.slice(0, 2).map(c => c.content.slice(0, 2000)).join('\n---\n')}`
    }
  ], { maxTokens: 800, temperature: 0.2 });

  emitStep(sessionId, 'STEP_COMPLETE', 'P2-Summarization', 'module-summaries');
  try {
    return JSON.parse(raw.replace(/```json|```/g, '').trim());
  } catch (_) {
    return topDirs.map(d => ({ name: d.name, description: 'No description available.' }));
  }
}

// ── P2.4: Dependency Analyzer (FR-2.3) ───────────────────────────────────
async function analyzeDependencies(sourceFiles, sessionId) {
  emitLog(sessionId, 'INFO', 'P2-Summarization', 'Analyzing dependencies...');
  emitStep(sessionId, 'STEP_START', 'P2-Summarization', 'dependency-analysis');

  const manifests = sourceFiles.filter(f =>
    ['package.json','requirements.txt','pom.xml','Cargo.toml','go.mod','Gemfile']
      .includes(f.path.split('/').pop())
  );

  if (!manifests.length) {
    emitStep(sessionId, 'STEP_COMPLETE', 'P2-Summarization', 'dependency-analysis');
    return [];
  }

  const raw = await callGeminiWithRetry([
    {
      role: 'system',
      content: `Identify the 5–10 most important dependencies from these manifest files.
Return ONLY a valid JSON array with no markdown fences:
[{"name":"...","version":"...","role":"what it does in this project"}]`
    },
    {
      role: 'user',
      content: manifests.map(f => `### ${f.path}\n${f.content.slice(0, 2000)}`).join('\n\n')
    }
  ], { maxTokens: 600, temperature: 0.2 });

  emitStep(sessionId, 'STEP_COMPLETE', 'P2-Summarization', 'dependency-analysis');
  try {
    return JSON.parse(raw.replace(/```json|```/g, '').trim());
  } catch (_) { return []; }
}

// ── P2.5: Design Pattern Detector (FR-2.4) ───────────────────────────────
async function detectDesignPatterns(directoryTree, chunks, sessionId) {
  emitLog(sessionId, 'INFO', 'P2-Summarization', 'Detecting design patterns...');
  emitStep(sessionId, 'STEP_START', 'P2-Summarization', 'pattern-detection');

  const raw = await callGeminiWithRetry([
    {
      role: 'system',
      content: `Identify architectural patterns in this codebase (MVC, microservices, event-driven,
repository pattern, CQRS, layered, clean architecture, etc.).
Return ONLY a valid JSON array with no markdown fences: ["pattern1","pattern2"]`
    },
    {
      role: 'user',
      content: `Directory structure:\n${JSON.stringify(directoryTree, null, 2).slice(0, 3000)}

Code sample:\n${chunks[0]?.content?.slice(0, 3000) || ''}`
    }
  ], { maxTokens: 200, temperature: 0.2 });

  emitStep(sessionId, 'STEP_COMPLETE', 'P2-Summarization', 'pattern-detection');
  try {
    return JSON.parse(raw.replace(/```json|```/g, '').trim());
  } catch (_) { return []; }
}

// ── P2.6: Summary Assembler — main export ────────────────────────────────
export async function generateSummary(session, sessionId) {
  emitLog(sessionId, 'INFO', 'P2-Summarization', 'Starting AI summarization pipeline...');
  emitStep(sessionId, 'STEP_START', 'P2-Summarization', 'full-summary');

  const chunks = chunkSourceFiles(session.sourceFiles || []);
  emitLog(sessionId, 'INFO', 'P2-Summarization', `Chunked into ${chunks.length} context block(s)`);

  const [overview, moduleSummaries, dependencies, designPatterns] = await Promise.all([
    generateOverview(session.repoMetadata, chunks, session.techStack, sessionId),
    generateModuleSummaries(session.directoryTree, chunks, sessionId),
    analyzeDependencies(session.sourceFiles, sessionId),
    detectDesignPatterns(session.directoryTree, chunks, sessionId)
  ]);

  emitStep(sessionId, 'STEP_COMPLETE', 'P2-Summarization', 'full-summary');
  emitLog(sessionId, 'INFO', 'P2-Summarization', 'Summary complete ✓');
  return { overview, moduleSummaries, dependencies, designPatterns };
}
