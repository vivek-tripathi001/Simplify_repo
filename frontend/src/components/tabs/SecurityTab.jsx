// src/components/tabs/SecurityTab.jsx — Module 4 (P4) frontend
// SRS: FR-4.1 to FR-4.7 | SDS §3.4.1 Screen 4
import { useState } from 'react';
import { runSecurity, exportSecurity } from '../../services/api.js';

const SEVERITY_CONFIG = {
  Critical: { badge: 'badge-red',    icon: '🔴', order: 0 },
  High:     { badge: 'badge-orange', icon: '🟠', order: 1 },
  Medium:   { badge: 'badge-yellow', icon: '🟡', order: 2 },
  Low:      { badge: 'badge-blue',   icon: '🔵', order: 3 },
};

export default function SecurityTab({ sessionId, onRefresh }) {
  const [scanning, setScanning]     = useState(false);
  const [report, setReport]         = useState(null);
  const [error, setError]           = useState(null);
  const [expanded, setExpanded]     = useState({});

  const handleScan = async () => {
    setScanning(true); setError(null);
    try {
      const { data } = await runSecurity(sessionId);
      setReport(data);
      onRefresh?.();
    } catch (err) {
      setError(err.error || 'Security scan failed. Please try again.');
    } finally {
      setScanning(false);
    }
  };

  const toggle = (key) => setExpanded(p => ({ ...p, [key]: !p[key] }));

  const sortedFindings = report?.findings?.slice().sort((a, b) =>
    (SEVERITY_CONFIG[a.severity]?.order ?? 9) - (SEVERITY_CONFIG[b.severity]?.order ?? 9)
  ) || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Action bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="btn btn-primary" onClick={handleScan} disabled={scanning}>
          {scanning ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Scanning…</> : '🔍 Run Security Scan'}
        </button>
        {report && (
          <a href={exportSecurity(sessionId)} download style={{ textDecoration: 'none' }}>
            <button className="btn btn-secondary">⬇ Export Markdown</button>
          </a>
        )}
        <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
          Checks: CWE-89 · CWE-79 · CWE-798 · CWE-502 · CWE-22
        </span>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', padding: '10px 14px', color: 'var(--red)', fontSize: '0.85rem' }}>
          ⚠ {error}
        </div>
      )}

      {scanning && (
        <div className="glass" style={{ padding: 30, textAlign: 'center', color: 'var(--text-secondary)' }}>
          <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 14px' }} />
          <div>Running CWE pattern matching and AI validation…</div>
          <div style={{ fontSize: '0.78rem', marginTop: 6, color: 'var(--text-muted)' }}>This may take 30–60 seconds</div>
        </div>
      )}

      {report && !scanning && (
        <>
          {/* Summary badges (FR-4.3) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            {['Critical', 'High', 'Medium', 'Low'].map(s => (
              <div key={s} className="glass" style={{ padding: '14px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.6rem', marginBottom: 4 }}>{SEVERITY_CONFIG[s].icon}</div>
                <div style={{ fontWeight: 700, fontSize: '1.4rem' }}>{report.summary?.[s] ?? 0}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{s}</div>
              </div>
            ))}
          </div>

          {/* No findings */}
          {sortedFindings.length === 0 && (
            <div className="glass" style={{ padding: 30, textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 10 }}>✅</div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>No issues found</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>All CWE checks passed.</div>
            </div>
          )}

          {/* Findings table */}
          {sortedFindings.length > 0 && (
            <div className="glass" style={{ padding: 18 }}>
              <h3 style={{ marginBottom: 14, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                🔎 Findings ({sortedFindings.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {sortedFindings.map((f, i) => (
                  <div key={i} style={{
                    background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
                    borderRadius: 'var(--radius-md)', overflow: 'hidden'
                  }}>
                    <button onClick={() => toggle(i)} style={{
                      width: '100%', padding: '10px 14px',
                      display: 'flex', alignItems: 'center', gap: 10,
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', fontSize: '0.85rem', textAlign: 'left'
                    }}>
                      <span className={`badge ${SEVERITY_CONFIG[f.severity]?.badge}`}>{f.severity}</span>
                      <span className="badge badge-gray">{f.cweId}</span>
                      <span style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        {f.filePath}:{f.lineNumber}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{expanded[i] ? '▲' : '▼'}</span>
                    </button>
                    {expanded[i] && (
                      <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--glass-border)' }}>
                        <p style={{ marginTop: 10, marginBottom: 8, fontSize: '0.85rem', lineHeight: 1.6 }}>{f.explanation}</p>
                        {f.lineContent && (
                          <pre style={{
                            background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-sm)', padding: '8px 10px',
                            fontFamily: 'var(--font-mono)', fontSize: '0.78rem',
                            overflowX: 'auto', marginBottom: 8
                          }}>{f.lineContent}</pre>
                        )}
                        {f.remediation && (
                          <div style={{
                            background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
                            borderRadius: 'var(--radius-sm)', padding: '8px 12px',
                            fontSize: '0.82rem', color: 'var(--green)'
                          }}>
                            🔧 <strong>Fix:</strong> {f.remediation}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <p style={{ color: 'var(--text-muted)', fontSize: '0.73rem' }}>
            * AI-generated findings are advisory and do not constitute a professional security audit.
          </p>
        </>
      )}
    </div>
  );
}
