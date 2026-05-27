// src/utils/sessionStore.js
// In-memory session store — no persistent DB in Phase 1 (SDS §3.2)
// All session data isolated per sessionId, TTL = 60 min (SRS §7.3, NFR-R3, NFR-R4)

import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import os from 'os';

const SESSION_TTL = parseInt(process.env.SESSION_TTL_MS) || 3600000; // 60 min

/**
 * Session shape (SDS Data Dictionary §3.2.1):
 * {
 *   sessionId:   String (UUID v4)
 *   createdAt:   Number (ms timestamp)
 *   repoURL:     String
 *   repoMetadata: Object
 *   directoryTree: Object
 *   entryPoints: String[]
 *   techStack:   Object
 *   sourceFiles: Object[]   — { path, content }
 *   cloneDir:    String     — ephemeral fs path
 *   summary:     Object     — D2
 *   securityReport: Object  — D3
 *   mermaidCode: String     — D4
 *   wikiMarkdown: String    — D4
 *   chatHistory: Object[]   — D3.1 (max 50 messages)
 *   logs:        Object[]   — D5
 *   sseClients:  Set        — active SSE response objects
 * }
 */

const sessions = new Map();

export function createSession() {
  const sessionId = uuidv4();
  sessions.set(sessionId, {
    sessionId,
    createdAt: Date.now(),
    repoURL: null,
    repoMetadata: null,
    directoryTree: null,
    entryPoints: [],
    techStack: {},
    sourceFiles: [],
    cloneDir: null,
    summary: null,
    securityReport: null,
    mermaidCode: null,
    wikiMarkdown: null,
    chatHistory: [],
    logs: [],
    sseClients: new Set()
  });
  return sessionId;
}

export function getSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return null;
  if (Date.now() - session.createdAt > SESSION_TTL) {
    destroySession(sessionId);
    return null;
  }
  return session;
}

export function updateSession(sessionId, updates) {
  const session = getSession(sessionId);
  if (!session) return false;
  Object.assign(session, updates);
  return true;
}

/** NFR-R4, SRS §7.3: delete cloned files + purge session */
export function destroySession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return;
  // Cleanup ephemeral clone directory
  if (session.cloneDir && fs.existsSync(session.cloneDir)) {
    try { fs.rmSync(session.cloneDir, { recursive: true, force: true }); } catch (_) {}
  }
  // Close all SSE connections
  for (const client of session.sseClients) {
    try { client.end(); } catch (_) {}
  }
  sessions.delete(sessionId);
}

/** Called every 10 minutes to evict expired sessions */
export function sessionCleanup() {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now - session.createdAt > SESSION_TTL) {
      destroySession(id);
      console.log(`[SessionStore] Cleaned up expired session ${id}`);
    }
  }
}

export function addSSEClient(sessionId, res) {
  const session = getSession(sessionId);
  if (!session) return false;
  session.sseClients.add(res);
  return true;
}

export function removeSSEClient(sessionId, res) {
  const session = sessions.get(sessionId);
  if (session) session.sseClients.delete(res);
}

/** P7.1: Add log event and broadcast to all SSE clients (D5) */
export function emitLog(sessionId, level, moduleName, message) {
  const session = sessions.get(sessionId);
  if (!session) return;
  const event = {
    timestamp: new Date().toISOString(),
    sessionId,
    level,   // 'INFO' | 'WARNING' | 'ERROR'
    module: moduleName,
    message
  };
  // Store in D5 (max 1000 events — circular buffer)
  session.logs.push(event);
  if (session.logs.length > 1000) session.logs.shift();
  // Broadcast to all registered SSE clients (P7.3)
  broadcastSSE(session, { type: 'log', data: event });
}

/** P7.4: Step status event broadcast */
export function emitStep(sessionId, type, moduleName, stepName, extra = {}) {
  const session = sessions.get(sessionId);
  if (!session) return;
  const event = { type, module: moduleName, step: stepName, timestamp: new Date().toISOString(), ...extra };
  broadcastSSE(session, { type: 'step', data: event });
}

function broadcastSSE(session, payload) {
  const str = `data: ${JSON.stringify(payload)}\n\n`;
  for (const client of session.sseClients) {
    try { client.write(str); } catch (_) { session.sseClients.delete(client); }
  }
}
