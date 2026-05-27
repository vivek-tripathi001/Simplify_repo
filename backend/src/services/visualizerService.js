// src/services/visualizerService.js
// MODULE 5 — Pro-Mode Visualizer (P5)
// SRS: FR-5.1 to FR-5.6 | ✅ Gemini 2.5 Flash

import { callGemini } from '../utils/geminiClient.js';
import { emitLog, emitStep } from '../utils/sessionStore.js';
import { createError } from '../middleware/errorHandler.js';

const MAX_MERMAID_LENGTH = 5000;

// ── P5.1: Module Graph Builder ────────────────────────────────────────────
function buildModuleGraph(summary, directoryTree) {
  const nodes = [];
  const edges = [];

  for (const mod of (summary?.moduleSummaries || [])) {
    nodes.push({
      id:          mod.name.replace(/[^a-zA-Z0-9_]/g, '_'),
      label:       mod.name,
      description: mod.description || ''
    });
  }
  for (const dep of (summary?.dependencies || []).slice(0, 8)) {
    nodes.push({
      id:    `ext_${dep.name.replace(/[^a-zA-Z0-9_]/g, '_')}`,
      label: dep.name,
      type:  'external'
    });
  }

  const srcDirs = (directoryTree?.children || []).filter(n => n.type === 'directory');
  for (let i = 0; i < srcDirs.length - 1 && i < 5; i++) {
    edges.push({
      from:  srcDirs[i].name.replace(/[^a-zA-Z0-9_]/g, '_'),
      to:    srcDirs[i+1].name.replace(/[^a-zA-Z0-9_]/g, '_'),
      label: 'uses'
    });
  }

  return { nodes, edges };
}

// ── P5.2: Diagram Type Selector (FR-5.6) ─────────────────────────────────
const VALID_TYPES = ['flowchart', 'sequence', 'classDiagram', 'erDiagram'];

function validateType(type) {
  return VALID_TYPES.includes(type) ? type : 'flowchart';
}

// ── P5.3: Mermaid Code Generator (FR-5.1, FR-5.3) ────────────────────────
const DIAGRAM_PROMPTS = {
  flowchart:    `Generate a Mermaid.js flowchart (LR direction) showing the system architecture.
Nodes = modules/components. Edges = dependencies/data flows between them.
Style external dependencies differently. Use subgraphs for logical groupings.`,
  sequence:     `Generate a Mermaid.js sequence diagram showing how main modules interact
during a typical request-response cycle. Use module names as participants.`,
  classDiagram: `Generate a Mermaid.js class diagram showing main classes/services,
their key methods, and relationships (inheritance, composition, dependency).`,
  erDiagram:    `Generate a Mermaid.js ER diagram showing main data entities and relationships.
Infer entities from module names, dependencies, and directory structure.`
};

async function generateMermaidCode(graph, diagramType, summary, sessionId) {
  emitLog(sessionId, 'INFO', 'P5-Visualizer', `Generating ${diagramType} diagram...`);

  const moduleList = graph.nodes
    .filter(n => !n.type)
    .map(n => `- ${n.label}: ${n.description}`)
    .join('\n');

  const depList = (summary?.dependencies || []).slice(0, 8)
    .map(d => `- ${d.name}: ${d.role}`)
    .join('\n');

  const raw = await callGemini([
    {
      role: 'system',
      content: `You are a Mermaid.js diagram expert.
Generate ONLY syntactically valid Mermaid.js DSL code — no markdown fences, no explanation, no comments outside the diagram syntax.
Keep output under ${MAX_MERMAID_LENGTH} characters.
The diagram must start with the correct Mermaid keyword (graph, flowchart, sequenceDiagram, classDiagram, or erDiagram).`
    },
    {
      role: 'user',
      content: `${DIAGRAM_PROMPTS[diagramType]}

Modules:
${moduleList}

External Dependencies:
${depList}

Architecture patterns: ${(summary?.designPatterns || []).join(', ')}
Overview: ${summary?.overview?.slice(0, 400) || ''}`
    }
  ], { maxTokens: 1200, temperature: 0.2 });

  return raw.replace(/^```.*\n?|```$/gm, '').trim();
}

// ── P5.4: Syntax Validator ────────────────────────────────────────────────
function isValidMermaid(code) {
  if (!code || code.length < 10) return false;
  const starters = ['graph ', 'flowchart ', 'sequenceDiagram', 'classDiagram',
    'erDiagram', 'gantt', 'pie', 'gitGraph', 'stateDiagram', 'journey'];
  return starters.some(s => code.trimStart().startsWith(s));
}

// ── Main generator ────────────────────────────────────────────────────────
export async function generateDiagram(session, sessionId, diagramType = 'flowchart') {
  const type = validateType(diagramType);
  emitStep(sessionId, 'STEP_START', 'P5-Visualizer', 'diagram-generation');

  const graph = buildModuleGraph(session.summary, session.directoryTree);

  let mermaidCode = null;
  const MAX_ATTEMPTS = 2;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const code = await generateMermaidCode(graph, type, session.summary, sessionId);
      if (isValidMermaid(code)) {
        mermaidCode = code.slice(0, MAX_MERMAID_LENGTH);
        break;
      }
      emitLog(sessionId, 'WARNING', 'P5-Visualizer',
        `Attempt ${attempt}: syntax check failed, retrying...`);
    } catch (err) {
      emitLog(sessionId, 'WARNING', 'P5-Visualizer',
        `Attempt ${attempt} error: ${err.message}`);
      if (attempt === MAX_ATTEMPTS) throw createError('OPENAI_ERROR', 502);
    }
  }

  if (!mermaidCode) throw createError('OPENAI_ERROR', 500);

  emitStep(sessionId, 'STEP_COMPLETE', 'P5-Visualizer', 'diagram-generation');
  emitLog(sessionId, 'INFO', 'P5-Visualizer',
    `Diagram generated (${mermaidCode.length} chars) ✓`);
  return mermaidCode;
}
