// src/components/tabs/WikiTab.jsx — Module 6 (P6) frontend
// SRS: FR-6.1 to FR-6.6 | SDS §3.4.1 Screen 6
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { generateWiki, exportWiki } from '../../services/api.js';

export default function WikiTab({ sessionId, onRefresh }) {
  const [generating, setGenerating] = useState(false);
  const [wiki, setWiki]             = useState(null);
  const [gapReport, setGapReport]   = useState(null);
  const [error, setError]           = useState(null);
  const [copied, setCopied]         = useState(false);

  const handleGenerate = async () => {
    setGenerating(true); setError(null);
    try {
      const { data } = await generateWiki(sessionId);
      setWiki(data.wikiMarkdown);
      setGapReport(data.gapReport);
      onRefresh?.();
    } catch (err) {
      setError(err.error || 'Wiki generation failed. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  // FR-6.5: Copy to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(wiki);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {
      // fallback: select text
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Action bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button className="btn btn-primary" onClick={handleGenerate} disabled={generating}>
          {generating ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Generating Wiki…</> : '📖 Generate Wiki'}
        </button>
        {wiki && (
          <>
            <a href={exportWiki(sessionId)} download style={{ textDecoration: 'none' }}>
              <button className="btn btn-secondary">⬇ Download .md</button>
            </a>
            <button className="btn btn-secondary" onClick={handleCopy}>
              {copied ? '✅ Copied!' : '📋 Copy'}
            </button>
          </>
        )}
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', padding: '10px 14px', color: 'var(--red)', fontSize: '0.85rem' }}>
          ⚠ {error}
        </div>
      )}

      {generating && (
        <div className="glass" style={{ padding: 30, textAlign: 'center', color: 'var(--text-secondary)' }}>
          <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 14px' }} />
          <div>Generating wiki sections with AI… this may take a minute.</div>
        </div>
      )}

      {!wiki && !generating && (
        <div className="glass" style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📖</div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>No wiki generated yet</div>
          <div style={{ fontSize: '0.85rem' }}>Click "Generate Wiki" to create complete Markdown documentation.</div>
        </div>
      )}

      {wiki && !generating && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 16, alignItems: 'start' }}>
          {/* FR-6.4: Live Markdown preview */}
          <div className="glass" style={{ padding: 24 }}>
            <div className="md-body">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{wiki}</ReactMarkdown>
            </div>
          </div>

          {/* FR-6.3: Gap Report panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="glass" style={{ padding: 16 }}>
              <h4 style={{ marginBottom: 10, fontSize: '0.85rem' }}>📋 README Gap Report</h4>
              {!gapReport?.readmeExists && (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No README.md found in repository.</div>
              )}
              {gapReport?.readmeExists && gapReport.missingInReadme?.length === 0 && (
                <div style={{ color: 'var(--green)', fontSize: '0.8rem' }}>✅ README appears complete!</div>
              )}
              {gapReport?.missingInReadme?.length > 0 && (
                <>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: 8 }}>
                    Sections missing from README:
                  </div>
                  {gapReport.missingInReadme.map(s => (
                    <div key={s} style={{
                      background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
                      borderRadius: 'var(--radius-sm)', padding: '5px 8px', marginBottom: 4,
                      fontSize: '0.78rem', color: 'var(--yellow)'
                    }}>
                      ⚠ {s}
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* FR-6.6: Version stamp info */}
            <div className="glass" style={{ padding: 14 }}>
              <h4 style={{ marginBottom: 8, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>ℹ Generation Info</h4>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.7 }}>
                <div>Generated: {new Date().toLocaleDateString()}</div>
                <div>Sections: 7 standard sections</div>
                <div>Format: GitHub-flavored Markdown</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
