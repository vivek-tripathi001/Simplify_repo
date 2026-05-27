// src/App.jsx — Root component
// Global session state + tab routing for all 7 SimplifyRepo modules
import { useState, useCallback } from 'react';
import { analyzeRepo, getSession } from './services/api.js';
import { useSSE } from './hooks/useSSE.js';
import SummaryTab    from './components/tabs/SummaryTab.jsx';
import ChatBotTab    from './components/tabs/ChatBotTab.jsx';
import SecurityTab   from './components/tabs/SecurityTab.jsx';
import VisualizerTab from './components/tabs/VisualizerTab.jsx';
import WikiTab       from './components/tabs/WikiTab.jsx';
import TerminalTab   from './components/tabs/TerminalTab.jsx';

const TABS = [
  { id: 'summary',    label: '📋 Summary',   req: true  },
  { id: 'chat',       label: '💬 ChatBot',    req: true  },
  { id: 'security',   label: '🔒 Security',   req: true  },
  { id: 'visualizer', label: '🗺 Visualizer', req: true  },
  { id: 'wiki',       label: '📖 Wiki',       req: true  },
  { id: 'terminal',   label: '⚡ Terminal',   req: false },
];

export default function App() {
  const [urlInput, setUrlInput]           = useState('');
  const [sessionId, setSessionId]         = useState(null);
  const [activeTab, setActiveTab]         = useState('terminal');
  const [analyzing, setAnalyzing]         = useState(false);
  const [analysisReady, setAnalysisReady] = useState(false);
  const [sessionData, setSessionData]     = useState(null);
  const [logs, setLogs]                   = useState([]);
  const [steps, setSteps]                 = useState({});
  const [error, setError]                 = useState(null);

  // ── SSE callbacks (P7) ────────────────────────────────────────────────
  const onLog  = useCallback(log  => setLogs(prev => [...prev.slice(-999), log]), []);
  const onStep = useCallback(step => setSteps(prev => ({
    ...prev, [`${step.module}::${step.step}`]: step
  })), []);

  const onAnalysisComplete = useCallback(async () => {
    if (!sessionId) return;
    try {
      const { data } = await getSession(sessionId);
      setSessionData(data);
      setAnalysisReady(true);
      setAnalyzing(false);
      setActiveTab('summary');
    } catch (_) { setAnalyzing(false); }
  }, [sessionId]);

  const onAnalysisError = useCallback((errMsg) => {
    setError(errMsg || 'Analysis failed. Please try again.');
    setAnalyzing(false);
  }, []);

  useSSE(sessionId, onLog, onStep, onAnalysisComplete, onAnalysisError);

  // ── Analyze handler ───────────────────────────────────────────────────
  const handleAnalyze = async (e) => {
    e.preventDefault();
    const url = urlInput.trim();
    if (!url) return;

    setError(null);
    setAnalyzing(true);
    setAnalysisReady(false);
    setSessionData(null);
    setLogs([]);
    setSteps({});
    setActiveTab('terminal');

    try {
      const { data } = await analyzeRepo(url);
      setSessionId(data.sessionId);
    } catch (err) {
      setError(err.error || 'Failed to start analysis. Check the URL and try again.');
      setAnalyzing(false);
    }
  };

  const refreshSession = useCallback(async () => {
    if (!sessionId) return;
    try {
      const { data } = await getSession(sessionId);
      setSessionData(data);
    } catch (_) {}
  }, [sessionId]);

  const meta = sessionData?.repoMetadata;

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* ─ Header ─ */}
      <header style={{
        background: 'rgba(13,17,23,0.97)', backdropFilter: 'blur(14px)',
        borderBottom: '1px solid var(--border)',
        padding: '0 24px', height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '1.35rem' }}>🔬</span>
          <span style={{ fontWeight: 700, fontSize: '1.05rem', letterSpacing: '-0.2px' }}>
            SimplifyRepo
          </span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.73rem' }}>
            AI GitHub Analyzer
          </span>
        </div>
        {meta && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span className="badge badge-blue" style={{
              maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
            }}>{meta.fullName}</span>
            <span className="badge badge-gray">{meta.language}</span>
            <span className="badge badge-gray">⭐ {meta.stars?.toLocaleString()}</span>
            <span className="badge badge-gray">{meta.sizeMB} MB</span>
          </div>
        )}
      </header>

      {/* ─ URL Input Bar ─ */}
      <div style={{
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
        padding: '12px 24px'
      }}>
        <form onSubmit={handleAnalyze} style={{ display: 'flex', gap: 10, maxWidth: 900 }}>
          <input
            className="input"
            style={{ flex: 1 }}
            placeholder="https://github.com/owner/repository"
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            disabled={analyzing}
          />
          <button
            className="btn btn-primary"
            type="submit"
            disabled={analyzing || !urlInput.trim()}
          >
            {analyzing
              ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Analyzing…</>
              : '🔍 Analyze'}
          </button>
        </form>
        {error && (
          <div style={{ color: 'var(--red)', fontSize: '0.82rem', marginTop: 6 }}>
            ⚠ {error}
          </div>
        )}
      </div>

      {/* ─ Tab Bar ─ */}
      {sessionId && (
        <div style={{
          padding: '8px 24px 0',
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border)'
        }}>
          <div className="tab-bar" style={{ maxWidth: 900 }}>
            {TABS.map(t => (
              <button
                key={t.id}
                className={`tab ${activeTab === t.id ? 'active' : ''}`}
                disabled={t.req && !analysisReady}
                onClick={() => setActiveTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─ Main Content ─ */}
      <main style={{
        flex: 1, padding: '24px',
        maxWidth: 1200, width: '100%', margin: '0 auto'
      }}>
        {/* Welcome screen */}
        {!sessionId && !analyzing && <WelcomeScreen />}

        {/* Mid-analysis — not on terminal tab */}
        {analyzing && !analysisReady && activeTab !== 'terminal' && (
          <div style={{ textAlign: 'center', paddingTop: 80, color: 'var(--text-secondary)' }}>
            <div className="spinner" style={{ width: 36, height: 36, margin: '0 auto 16px' }} />
            <p style={{ fontWeight: 500 }}>Analyzing repository…</p>
            <p style={{ fontSize: '0.82rem', marginTop: 8 }}>
              Switch to <strong>⚡ Terminal</strong> to watch live progress.
            </p>
          </div>
        )}

        {/* Tab panels */}
        {sessionId && (
          <>
            {activeTab === 'summary'    && analysisReady &&
              <SummaryTab session={sessionData} />}
            {activeTab === 'chat'       && analysisReady &&
              <ChatBotTab sessionId={sessionId} session={sessionData} />}
            {activeTab === 'security'   && analysisReady &&
              <SecurityTab sessionId={sessionId} onRefresh={refreshSession} />}
            {activeTab === 'visualizer' && analysisReady &&
              <VisualizerTab sessionId={sessionId} session={sessionData} />}
            {activeTab === 'wiki'       && analysisReady &&
              <WikiTab sessionId={sessionId} onRefresh={refreshSession} />}
            {activeTab === 'terminal' &&
              <TerminalTab
                logs={logs}
                steps={steps}
                sessionId={sessionId}
                analyzing={analyzing}
              />}
          </>
        )}
      </main>
    </div>
  );
}

// ── Welcome screen ─────────────────────────────────────────────────────────
function WelcomeScreen() {
  const features = [
    { icon: '📋', title: 'AI Summary',
      desc: 'Plain-language overview, module descriptions, dependency & design pattern analysis' },
    { icon: '💬', title: 'ChatBot',
      desc: 'Ask natural-language questions grounded in live repository context' },
    { icon: '🔒', title: 'Security Gate',
      desc: 'CWE-89 / CWE-79 / CWE-798 / CWE-502 / CWE-22 scanning with AI false-positive reduction' },
    { icon: '🗺', title: 'Visualizer',
      desc: 'Mermaid.js flowchart, sequence, class, and ER diagrams with SVG/PNG export' },
    { icon: '📖', title: 'Wiki',
      desc: 'Complete Markdown docs with 7 sections + README gap analysis' },
    { icon: '⚡', title: 'Terminal',
      desc: 'Real-time pipeline progress via SSE — step badges, level filter, log download' },
  ];

  return (
    <div style={{ maxWidth: 860, margin: '40px auto', textAlign: 'center' }}>
      <h1 style={{ fontSize: '2.4rem', fontWeight: 700, lineHeight: 1.2, marginBottom: 12 }}>
        Understand any GitHub repo<br />
        <span style={{ color: 'var(--accent)' }}>in seconds.</span>
      </h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', marginBottom: 44 }}>
        Paste a public GitHub URL above and let AI analyze the entire codebase for you.
      </p>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 14, textAlign: 'left'
      }}>
        {features.map(f => (
          <div key={f.title} className="glass" style={{ padding: '18px 16px' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>{f.icon}</div>
            <div style={{ fontWeight: 600, marginBottom: 4, fontSize: '0.93rem' }}>
              {f.title}
            </div>
            <div style={{
              color: 'var(--text-secondary)', fontSize: '0.79rem', lineHeight: 1.55
            }}>
              {f.desc}
            </div>
          </div>
        ))}
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.74rem', marginTop: 36 }}>
        Public repositories only &nbsp;•&nbsp; No persistent code storage &nbsp;•&nbsp;
        Sessions expire in 60 minutes
      </p>
    </div>
  );
}
