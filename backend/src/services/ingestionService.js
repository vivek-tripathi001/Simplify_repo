// src/services/ingestionService.js
// MODULE 1 — Repository Ingestion Engine (P1)
// SRS: FR-1.1 to FR-1.9 | SDS: §2.6.3, DFD Level 2 P1
// Sub-processes: P1.1 URL Validation → P1.2 Metadata Fetcher → P1.3 Git Clone & Parse
//                → P1.4 Entry Point Detector → P1.5 Tech Stack Identifier

import { execSync, execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import axios from 'axios';
import { emitLog, emitStep, updateSession } from '../utils/sessionStore.js';
import { createError } from '../middleware/errorHandler.js';

const execFileAsync = promisify(execFile);
const MAX_SIZE_MB = parseInt(process.env.MAX_REPO_SIZE_MB) || 500;
const CLONE_TIMEOUT = parseInt(process.env.CLONE_TIMEOUT_MS) || 30000;

// ── P1.1: URL Validation (FR-1.1) ─────────────────────────────────────────
const GITHUB_URL_REGEX = /^https?:\/\/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)(\/.*)?$/;

export function validateGitHubURL(url) {
  if (!url || typeof url !== 'string') throw createError('INVALID_URL', 400);
  const trimmed = url.trim().replace(/\.git$/, '').replace(/\/$/, '');
  const match = trimmed.match(GITHUB_URL_REGEX);
  if (!match) throw createError('INVALID_URL', 400);
  return { validatedURL: trimmed, owner: match[1], repo: match[2] };
}

// ── P1.2: Metadata Fetcher (FR-1.5) ───────────────────────────────────────
export async function fetchRepoMetadata(owner, repo, sessionId) {
  emitLog(sessionId, 'INFO', 'P1-Ingestion', `Fetching GitHub metadata for ${owner}/${repo}`);
  try {
    const headers = { Accept: 'application/vnd.github.v3+json' };
    if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

    const { data } = await axios.get(`https://api.github.com/repos/${owner}/${repo}`, { headers });

    if (data.private) throw createError('PRIVATE_REPO', 403);

    // FR-1.8: Size validation
    const sizeMB = data.size / 1024;
    if (sizeMB > MAX_SIZE_MB) throw createError('REPO_TOO_LARGE', 400);

    return {
      name: data.name,
      owner: data.owner?.login,
      fullName: data.full_name,
      description: data.description || '',
      language: data.language || 'Unknown',
      stars: data.stargazers_count,
      forks: data.forks_count,
      license: data.license?.name || 'None',
      lastCommit: data.pushed_at,
      defaultBranch: data.default_branch,
      sizeMB: Math.round(sizeMB * 10) / 10,
      topics: data.topics || [],
      htmlUrl: data.html_url
    };
  } catch (err) {
    if (err.code) throw err; // re-throw our own errors
    if (err.response?.status === 404) throw createError('PRIVATE_REPO', 404);
    throw createError('GITHUB_API_ERROR', 502);
  }
}

// ── P1.3: Git Clone & Parse (FR-1.2, FR-1.3, FR-1.7) ─────────────────────
export async function cloneAndParse(repoURL, sessionId) {
  const cloneDir = path.join(os.tmpdir(), `simplifyrepo_${sessionId}`);
  emitLog(sessionId, 'INFO', 'P1-Ingestion', `Cloning repository to ${cloneDir}`);
  emitStep(sessionId, 'STEP_START', 'P1-Ingestion', 'git-clone');

  try {
    await execFileAsync('git', ['clone', '--depth=1', '--single-branch', repoURL, cloneDir], {
      timeout: CLONE_TIMEOUT
    });
  } catch (err) {
    throw createError('CLONE_TIMEOUT', 504);
  }

  emitStep(sessionId, 'STEP_COMPLETE', 'P1-Ingestion', 'git-clone');
  emitLog(sessionId, 'INFO', 'P1-Ingestion', 'Repository cloned. Parsing directory tree...');

  const directoryTree = buildDirectoryTree(cloneDir, cloneDir);
  const sourceFiles = collectSourceFiles(cloneDir);

  emitLog(sessionId, 'INFO', 'P1-Ingestion', `Parsed ${sourceFiles.length} source files`);
  return { cloneDir, directoryTree, sourceFiles };
}

// FR-1.3: Recursive directory tree builder, FR-1.7: filtering
const EXCLUDED_DIRS = new Set(['.git', 'node_modules', '__pycache__', '.venv', 'venv',
  'dist', 'build', '.next', 'target', 'vendor', '.idea', '.vscode']);
const EXCLUDED_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff',
  '.woff2', '.ttf', '.eot', '.pdf', '.zip', '.tar', '.gz', '.exe', '.bin', '.so', '.dll']);

function buildDirectoryTree(dirPath, rootPath) {
  const name = path.basename(dirPath);
  const relativePath = path.relative(rootPath, dirPath);

  try {
    const stat = fs.statSync(dirPath);
    if (stat.isDirectory()) {
      if (EXCLUDED_DIRS.has(name)) return null;
      const children = fs.readdirSync(dirPath)
        .map(child => buildDirectoryTree(path.join(dirPath, child), rootPath))
        .filter(Boolean);
      return { name, type: 'directory', path: relativePath || '.', children };
    } else {
      const ext = path.extname(name).toLowerCase();
      if (EXCLUDED_EXTS.has(ext)) return null;
      return { name, type: 'file', path: relativePath, ext };
    }
  } catch (_) { return null; }
}

function collectSourceFiles(cloneDir) {
  const files = [];
  const walk = (dir) => {
    const base = path.basename(dir);
    if (EXCLUDED_DIRS.has(base)) return;
    let entries;
    try { entries = fs.readdirSync(dir); } catch (_) { return; }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else {
        const ext = path.extname(entry).toLowerCase();
        if (!EXCLUDED_EXTS.has(ext)) {
          // Only read files < 200KB to avoid memory issues
          if (stat.size < 200 * 1024) {
            try {
              const content = fs.readFileSync(fullPath, 'utf-8');
              files.push({ path: path.relative(cloneDir, fullPath), content, size: stat.size });
            } catch (_) {}
          } else {
            files.push({ path: path.relative(cloneDir, fullPath), content: '[File too large to read]', size: stat.size });
          }
        }
      }
    }
  };
  walk(cloneDir);
  return files;
}

// ── P1.4: Entry Point Detector (FR-1.4) ───────────────────────────────────
const ENTRY_PATTERNS = [
  /^index\.(js|ts|jsx|tsx|py|rb|go|php)$/,
  /^main\.(js|ts|py|go|rs|java|cpp|c)$/,
  /^app\.(js|ts|jsx|tsx|py)$/i,
  /^App\.(jsx|tsx)$/,
  /^server\.(js|ts)$/,
  /^manage\.py$/,
  /^pom\.xml$/,
  /^build\.gradle(\.kts)?$/,
  /^Cargo\.toml$/,
  /^go\.mod$/,
  /^__main__\.py$/
];

export function detectEntryPoints(sourceFiles) {
  return sourceFiles
    .filter(f => ENTRY_PATTERNS.some(rx => rx.test(path.basename(f.path))))
    .map(f => f.path);
}

// ── P1.5: Tech Stack Identifier (FR-1.6) ──────────────────────────────────
export function identifyTechStack(sourceFiles, directoryTree) {
  const languages = new Set();
  const frameworks = new Set();
  const packageManagers = new Set();

  const fileNames = sourceFiles.map(f => path.basename(f.path).toLowerCase());
  const allPaths = sourceFiles.map(f => f.path.toLowerCase());

  // Language detection from extensions
  const extLangMap = {
    '.js': 'JavaScript', '.ts': 'TypeScript', '.jsx': 'JavaScript/React',
    '.tsx': 'TypeScript/React', '.py': 'Python', '.java': 'Java',
    '.go': 'Go', '.rs': 'Rust', '.rb': 'Ruby', '.php': 'PHP',
    '.cs': 'C#', '.cpp': 'C++', '.c': 'C', '.swift': 'Swift'
  };
  for (const f of sourceFiles) {
    const lang = extLangMap[path.extname(f.path).toLowerCase()];
    if (lang) languages.add(lang);
  }

  // Package manager detection
  if (fileNames.includes('package.json')) packageManagers.add('npm/yarn');
  if (fileNames.includes('yarn.lock')) packageManagers.add('yarn');
  if (fileNames.includes('pnpm-lock.yaml')) packageManagers.add('pnpm');
  if (fileNames.includes('requirements.txt') || fileNames.includes('pipfile')) packageManagers.add('pip');
  if (fileNames.includes('pom.xml')) packageManagers.add('Maven');
  if (fileNames.includes('build.gradle') || fileNames.includes('build.gradle.kts')) packageManagers.add('Gradle');
  if (fileNames.includes('cargo.toml')) packageManagers.add('Cargo');
  if (fileNames.includes('gemfile')) packageManagers.add('Bundler');
  if (fileNames.includes('go.mod')) packageManagers.add('Go Modules');

  // Framework detection from package.json
  const pkgJsonFile = sourceFiles.find(f => f.path === 'package.json' || f.path.endsWith('/package.json'));
  if (pkgJsonFile) {
    try {
      const pkg = JSON.parse(pkgJsonFile.content);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps.react) frameworks.add('React.js');
      if (deps.next) frameworks.add('Next.js');
      if (deps.vue) frameworks.add('Vue.js');
      if (deps.express) frameworks.add('Express.js');
      if (deps.nestjs || deps['@nestjs/core']) frameworks.add('NestJS');
      if (deps.angular || deps['@angular/core']) frameworks.add('Angular');
      if (deps.svelte) frameworks.add('Svelte');
      if (deps.fastify) frameworks.add('Fastify');
    } catch (_) {}
  }

  // Framework detection from Python
  const reqFile = sourceFiles.find(f => f.path === 'requirements.txt');
  if (reqFile) {
    const content = reqFile.content.toLowerCase();
    if (content.includes('django')) frameworks.add('Django');
    if (content.includes('flask')) frameworks.add('Flask');
    if (content.includes('fastapi')) frameworks.add('FastAPI');
    if (content.includes('sqlalchemy')) frameworks.add('SQLAlchemy');
  }

  return {
    languages: [...languages],
    frameworks: [...frameworks],
    packageManagers: [...packageManagers]
  };
}
