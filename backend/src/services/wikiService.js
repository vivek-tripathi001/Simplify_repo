// src/services/wikiService.js
// MODULE 6 — Wiki Generator (P6)
// SRS: FR-6.1 to FR-6.6 | ✅ Gemini 2.5 Flash

import { callGemini } from '../utils/geminiClient.js';
import { emitLog, emitStep } from '../utils/sessionStore.js';

// ── P6.1: Data Collector ──────────────────────────────────────────────────
function collectWikiData(session) {
  const readme = (session.sourceFiles || []).find(f =>
    f.path.toLowerCase() === 'readme.md' ||
    f.path.toLowerCase().endsWith('/readme.md')
  );
  return {
    metadata:       session.repoMetadata  || {},
    techStack:      session.techStack     || {},
    summary:        session.summary       || {},
    entryPoints:    session.entryPoints   || [],
    securityReport: session.securityReport || null,
    readmeContent:  readme?.content       || null
  };
}

// ── P6.2: Section Generator (FR-6.2) ─────────────────────────────────────
async function generateSection(name, prompt, sessionId) {
  emitLog(sessionId, 'INFO', 'P6-Wiki', `Generating section: ${name}`);
  try {
    return await callGemini([
      {
        role: 'system',
        content: `You are a technical writer generating the "${name}" section of a project wiki.
Write in clear, developer-friendly Markdown.
Return ONLY the body content — no section header, no preamble.`
      },
      { role: 'user', content: prompt }
    ], { maxTokens: 600, temperature: 0.3 });
  } catch (_) {
    return `*Section generation failed — please try regenerating.*`;
  }
}

async function generateAllSections(data, sessionId) {
  const { metadata: meta, summary, techStack: stack, entryPoints, securityReport } = data;

  const sectionPrompts = {
    'Project Overview': `Write a project overview for "${meta.fullName}".
Description: ${meta.description || 'N/A'}
AI Summary: ${summary.overview?.slice(0, 800) || ''}
Design patterns: ${(summary.designPatterns || []).join(', ')}`,

    'Installation & Setup': `Write installation and setup instructions for "${meta.fullName}".
Language: ${meta.language}
Frameworks: ${(stack.frameworks || []).join(', ')}
Package managers: ${(stack.packageManagers || []).join(', ')}
Entry points: ${entryPoints.join(', ') || 'N/A'}
Include prerequisites, environment setup, and step-by-step install commands.`,

    'Architecture Overview': `Write an architecture overview for "${meta.fullName}".
Modules: ${JSON.stringify(summary.moduleSummaries || [])}
Design patterns: ${(summary.designPatterns || []).join(', ')}`,

    'Module Descriptions': `Write a "Module Descriptions" section listing each module and its purpose.
Format each as a subsection with its name and description.
Modules: ${JSON.stringify(summary.moduleSummaries || [])}`,

    'API Reference': `Write an API reference section for "${meta.fullName}".
If no explicit REST API is detected, describe the main entry points and public interfaces.
Entry points: ${entryPoints.join(', ') || 'N/A'}
Tech stack: ${JSON.stringify(stack)}`,

    'Security Notes': securityReport
      ? `Write a security notes section. A scan found these issues:
${JSON.stringify(securityReport.summary)}
Mention that a full report is available. Include general security recommendations.`
      : `Write general security best practices for a ${meta.language} project using
${(stack.frameworks || []).join(', ')}.`,

    'Contributing Guidelines': `Write contributing guidelines for "${meta.fullName}".
Cover: forking, branch naming, commit conventions, pull request process, code style.
Tech stack: ${JSON.stringify(stack)}`
  };

  // Generate all sections — sequentially to avoid Gemini rate limits
  const results = {};
  for (const [name, prompt] of Object.entries(sectionPrompts)) {
    results[name] = await generateSection(name, prompt, sessionId);
  }
  return results;
}

// ── P6.3: README Comparator (FR-6.3) ─────────────────────────────────────
function compareWithReadme(sections, readmeContent) {
  if (!readmeContent) {
    return { readmeExists: false, missingInReadme: Object.keys(sections), outdatedInReadme: [] };
  }
  const lower = readmeContent.toLowerCase();
  const keywords = {
    'Project Overview':      ['overview', 'about', 'description', 'what is'],
    'Installation & Setup':  ['install', 'setup', 'getting started', 'requirements'],
    'Architecture Overview': ['architecture', 'design', 'structure'],
    'Module Descriptions':   ['module', 'component', 'service'],
    'API Reference':         ['api', 'endpoint', 'reference'],
    'Security Notes':        ['security', 'vulnerability', 'cve'],
    'Contributing Guidelines':['contributing', 'contribution', 'pull request']
  };
  const missing = Object.entries(keywords)
    .filter(([, kws]) => !kws.some(kw => lower.includes(kw)))
    .map(([name]) => name);
  return { readmeExists: true, missingInReadme: missing, outdatedInReadme: [] };
}

// ── P6.4: Markdown Assembler (FR-6.1, FR-6.6) ────────────────────────────
function assembleMarkdown(sections, gapReport, metadata, commitHash) {
  const now      = new Date().toISOString();
  const repoName = metadata?.fullName || 'Repository';

  const toc = Object.keys(sections)
    .map(s => `- [${s}](#${s.toLowerCase().replace(/[^a-z0-9]+/g, '-')})`)
    .join('\n');

  let md = `# ${repoName} — Project Wiki\n\n`;
  md += `> Auto-generated by SimplifyRepo • ${now}\n\n`;
  md += `## Table of Contents\n\n${toc}\n\n---\n\n`;

  for (const [name, content] of Object.entries(sections)) {
    const anchor = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    md += `## ${name} {#${anchor}}\n\n${content}\n\n---\n\n`;
  }

  if (gapReport.readmeExists && gapReport.missingInReadme.length > 0) {
    md += `## README Gap Report\n\nThe following sections are missing from your README.md:\n\n`;
    gapReport.missingInReadme.forEach(s => { md += `- ${s}\n`; });
    md += '\n---\n\n';
  }

  md += `\n*Generated by SimplifyRepo v1.0 | ${now}`;
  if (commitHash) md += ` | Commit: ${commitHash}`;
  md += '*\n';
  return md;
}

// ── Main wiki generator ────────────────────────────────────────────────────
export async function generateWiki(session, sessionId) {
  emitStep(sessionId, 'STEP_START', 'P6-Wiki', 'wiki-generation');
  emitLog(sessionId, 'INFO', 'P6-Wiki', 'Starting wiki generation...');

  const data      = collectWikiData(session);
  const sections  = await generateAllSections(data, sessionId);
  const gapReport = compareWithReadme(sections, data.readmeContent);

  emitLog(sessionId, 'INFO', 'P6-Wiki',
    `Gap analysis: ${gapReport.missingInReadme.length} sections missing from README`);

  const commitHash  = session.repoMetadata?.lastCommit?.slice(0, 7) || null;
  const wikiMarkdown = assembleMarkdown(sections, gapReport, session.repoMetadata, commitHash);

  emitStep(sessionId, 'STEP_COMPLETE', 'P6-Wiki', 'wiki-generation');
  emitLog(sessionId, 'INFO', 'P6-Wiki', `Wiki generated (${wikiMarkdown.length} chars) ✓`);
  return { wikiMarkdown, gapReport };
}
