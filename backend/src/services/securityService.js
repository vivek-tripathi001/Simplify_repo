// src/services/securityService.js
// MODULE 4 — Security Gate (P4)
// SRS: FR-4.1 to FR-4.7 | ✅ Gemini 2.5 Flash

import { callGemini } from '../utils/geminiClient.js';
import { emitLog, emitStep } from '../utils/sessionStore.js';
import { createError } from '../middleware/errorHandler.js';

// ── P4.2: CWE Pattern Definitions (FR-4.2) ────────────────────────────────
const CWE_PATTERNS = [
  {
    cweId: 'CWE-89', name: 'SQL Injection',
    patterns: [
      /["'`]\s*\+\s*(req\.|request\.|params\.|query\.|body\.)/gi,
      /execute\s*\(\s*["'`][^"'`]*\$\{/gi,
      /query\s*\(\s*["'`][^"'`]*[+`]/gi,
      /SELECT.*WHERE.*=\s*['"]\s*\+/gi
    ]
  },
  {
    cweId: 'CWE-79', name: 'Cross-Site Scripting (XSS)',
    patterns: [
      /innerHTML\s*=\s*(req\.|request\.|params\.|query\.|body\.|\$\{)/gi,
      /document\.write\s*\([^)]*req\./gi,
      /dangerouslySetInnerHTML/gi,
      /\.html\s*\([^)]*req\./gi
    ]
  },
  {
    cweId: 'CWE-798', name: 'Hardcoded Credentials',
    patterns: [
      /(?:password|passwd|secret|api_?key|apikey|token)\s*[=:]\s*["'`][^"'`]{6,}/gi,
      /(?:AWS|GITHUB|OPENAI|STRIPE)_(?:SECRET|KEY|TOKEN)\s*=\s*["'`][A-Za-z0-9+/=_-]{10,}/gi
    ]
  },
  {
    cweId: 'CWE-502', name: 'Insecure Deserialization',
    patterns: [
      /pickle\.loads?\s*\(/gi,
      /yaml\.load\s*\([^,)]*\)/gi,
      /eval\s*\(\s*(req\.|request\.|params\.|query\.|JSON\.parse)/gi
    ]
  },
  {
    cweId: 'CWE-22', name: 'Path Traversal',
    patterns: [
      /fs\.(readFile|writeFile|unlink|stat)\s*\([^,)]*\+\s*(req\.|params\.|query\.)/gi,
      /path\.join\s*\([^)]*req\./gi,
      /open\s*\([^,)]*\+\s*(request\.|params\.)/gi
    ]
  }
];

const CODE_EXTS = new Set(['.js','.ts','.jsx','.tsx','.py','.java','.php',
  '.rb','.go','.rs','.cs','.cpp','.c','.swift','.kt']);

function getExt(p) { const s = p.split('.'); return s.length > 1 ? `.${s.pop().toLowerCase()}` : ''; }

// ── P4.1: File Loader ─────────────────────────────────────────────────────
function loadCodeFiles(sourceFiles) {
  return sourceFiles.filter(f => CODE_EXTS.has(getExt(f.path)));
}

// ── P4.2: Pattern Matcher ─────────────────────────────────────────────────
function matchCWEPatterns(codeFiles) {
  const candidates = [];
  for (const file of codeFiles) {
    const lines = file.content.split('\n');
    for (const def of CWE_PATTERNS) {
      for (const pattern of def.patterns) {
        for (let i = 0; i < lines.length; i++) {
          if (pattern.test(lines[i])) {
            pattern.lastIndex = 0;
            candidates.push({
              cweId:       def.cweId,
              cweName:     def.name,
              filePath:    file.path,
              lineNumber:  i + 1,
              lineContent: lines[i].trim(),
              context:     lines.slice(Math.max(0, i - 10), i + 11).join('\n')
            });
            break;
          }
          pattern.lastIndex = 0;
        }
      }
    }
  }
  return candidates;
}

// ── P4.3: LLM Context Validator (FR-4.4) ─────────────────────────────────
async function validateWithLLM(candidate, sessionId) {
  emitLog(sessionId, 'INFO', 'P4-Security',
    `Validating ${candidate.cweId} in ${candidate.filePath}:${candidate.lineNumber}`);
  try {
    const raw = await callGemini([
      {
        role: 'system',
        content: `You are a security code auditor. Determine if this ${candidate.cweId} 
(${candidate.cweName}) pattern is a genuine vulnerability or a false positive.
Return ONLY valid JSON with no markdown fences:
{"isVulnerable":true/false,"confidence":"high/medium/low","explanation":"brief reason","severity":"Critical/High/Medium/Low","remediation":"fix suggestion"}`
      },
      {
        role: 'user',
        content: `File: ${candidate.filePath}
Line ${candidate.lineNumber}: ${candidate.lineContent}

Context (±10 lines):
\`\`\`
${candidate.context}
\`\`\``
      }
    ], { maxTokens: 400, temperature: 0.1 });

    return JSON.parse(raw.replace(/```json|```/g, '').trim());
  } catch (_) {
    return { isVulnerable: false, confidence: 'low',
             explanation: 'Validation failed', severity: 'Low', remediation: '' };
  }
}

// ── P4.4: Severity Classifier (FR-4.3) ───────────────────────────────────
const BASE_SEVERITY = {
  'CWE-89': 'Critical', 'CWE-79': 'High',
  'CWE-798': 'Medium',  'CWE-502': 'High', 'CWE-22': 'High'
};

function classifySeverity(cweId, llmSeverity) {
  return llmSeverity || BASE_SEVERITY[cweId] || 'Medium';
}

// ── P4.5: Report Builder (FR-4.5) ────────────────────────────────────────
function buildReport(findings, sessionId) {
  const summary = { Critical: 0, High: 0, Medium: 0, Low: 0 };
  for (const f of findings) summary[f.severity] = (summary[f.severity] || 0) + 1;
  return { timestamp: new Date().toISOString(), sessionId, summary, findings };
}

// ── P4.6: Markdown Exporter (FR-4.7) ─────────────────────────────────────
export function exportToMarkdown(report) {
  const order = ['Critical', 'High', 'Medium', 'Low'];
  let md = `# SimplifyRepo Security Report\n\n**Generated:** ${report.timestamp}\n\n`;
  md += `## Summary\n\n| Severity | Count |\n|----------|-------|\n`;
  for (const s of order) md += `| ${s} | ${report.summary[s] || 0} |\n`;
  md += `\n---\n\n`;
  for (const sev of order) {
    const list = report.findings.filter(f => f.severity === sev);
    if (!list.length) continue;
    md += `## ${sev} Findings\n\n`;
    for (const f of list) {
      md += `### ${f.cweId} — ${f.cweName}\n`;
      md += `- **File:** \`${f.filePath}\` (line ${f.lineNumber})\n`;
      md += `- **Description:** ${f.explanation}\n`;
      md += `- **Remediation:** ${f.remediation}\n\n`;
      md += `\`\`\`\n${f.lineContent}\n\`\`\`\n\n`;
    }
  }
  md += `\n---\n*AI-generated findings are advisory only.*\n`;
  return md;
}

// ── Main scan orchestrator ────────────────────────────────────────────────
export async function runSecurityScan(session, sessionId) {
  emitLog(sessionId, 'INFO', 'P4-Security', 'Starting security scan...');
  emitStep(sessionId, 'STEP_START', 'P4-Security', 'security-scan');

  const codeFiles  = loadCodeFiles(session.sourceFiles || []);
  emitLog(sessionId, 'INFO', 'P4-Security', `Scanning ${codeFiles.length} code files...`);

  const candidates = matchCWEPatterns(codeFiles);
  emitLog(sessionId, 'INFO', 'P4-Security',
    `${candidates.length} candidate findings — running AI validation...`);

  // Validate in batches of 3
  const confirmed = [];
  for (let i = 0; i < candidates.length; i += 3) {
    const batch   = candidates.slice(i, i + 3);
    const results = await Promise.all(batch.map(c => validateWithLLM(c, sessionId)));
    for (let j = 0; j < batch.length; j++) {
      if (results[j].isVulnerable) {
        confirmed.push({
          ...batch[j],
          confirmed:   true,
          severity:    classifySeverity(batch[j].cweId, results[j].severity),
          explanation: results[j].explanation,
          remediation: results[j].remediation,
          confidence:  results[j].confidence
        });
      }
    }
    emitLog(sessionId, 'INFO', 'P4-Security',
      `Validated batch ${Math.floor(i/3)+1}/${Math.ceil(candidates.length/3)}`);
  }

  const report = buildReport(confirmed, sessionId);
  emitStep(sessionId, 'STEP_COMPLETE', 'P4-Security', 'security-scan',
    { findingCount: confirmed.length });
  emitLog(sessionId, 'INFO', 'P4-Security',
    `Scan complete — ${confirmed.length} confirmed findings ✓`);
  return report;
}
