// src/components/tabs/SummaryTab.jsx — Module 2 (P2) frontend
// SRS: FR-2.1 to FR-2.4, FR-2.6 | SDS: §3.4.1 Screen 2
import { useState } from 'react';

export default function SummaryTab({ session }) {
  const [expanded, setExpanded] = useState({});
  if (!session) return null;
  const { repoMetadata: meta, techStack: stack, summary } = session;

  const toggle = (key) => setExpanded(p => ({ ...p, [key]: !p[key] }));

  const severityColor = { Critical: 'red', High: 'orange', Medium: 'yellow', Low: 'blue' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Repo Metadata Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[
          { label: 'Language', value: meta?.language },
          { label: 'Stars',    value: `⭐ ${meta?.stars?.toLocaleString()}` },
          { label: 'Forks',    value: `🍴 ${meta?.forks?.toLocaleString()}` },
          { label: 'License',  value: meta?.license || 'None' },
        ].map(c => (
          <div key={c.label} className="glass" style={{ padding: '14px 16px' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* AI Overview (FR-2.1) */}
      <div className="glass" style={{ padding: 20 }}>
        <h3 style={{ marginBottom: 12, fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
          🤖 AI Overview
        </h3>
        <p style={{ lineHeight: 1.7, fontSize: '0.9rem' }}>{summary?.overview || 'Generating…'}</p>
      </div>

      {/* Tech Stack + Design Patterns row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="glass" style={{ padding: 18 }}>
          <h3 style={{ marginBottom: 12, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>⚙️ Tech Stack</h3>
          {stack?.languages?.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginBottom: 6 }}>LANGUAGES</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {stack.languages.map(l => <span key={l} className="badge badge-blue">{l}</span>)}
              </div>
            </div>
          )}
          {stack?.frameworks?.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginBottom: 6 }}>FRAMEWORKS</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {stack.frameworks.map(f => <span key={f} className="badge badge-purple">{f}</span>)}
              </div>
            </div>
          )}
          {stack?.packageManagers?.length > 0 && (
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginBottom: 6 }}>PACKAGE MANAGERS</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {stack.packageManagers.map(p => <span key={p} className="badge badge-gray">{p}</span>)}
              </div>
            </div>
          )}
        </div>

        {/* Design Patterns (FR-2.4) */}
        <div className="glass" style={{ padding: 18 }}>
          <h3 style={{ marginBottom: 12, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>🧩 Design Patterns</h3>
          {summary?.designPatterns?.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {summary.designPatterns.map(p => (
                <span key={p} className="badge badge-green" style={{ fontSize: '0.8rem', padding: '4px 10px' }}>{p}</span>
              ))}
            </div>
          ) : (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>No patterns detected</span>
          )}
        </div>
      </div>

      {/* Module Summaries — expandable cards (FR-2.2) */}
      {summary?.moduleSummaries?.length > 0 && (
        <div className="glass" style={{ padding: 18 }}>
          <h3 style={{ marginBottom: 14, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>📦 Module Summaries</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {summary.moduleSummaries.map((mod, i) => (
              <div key={i} style={{
                background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
                borderRadius: 'var(--radius-md)', overflow: 'hidden'
              }}>
                <button onClick={() => toggle(`mod_${i}`)} style={{
                  width: '100%', padding: '10px 14px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', fontSize: '0.88rem', fontWeight: 500
                }}>
                  <span>📁 {mod.name}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{expanded[`mod_${i}`] ? '▲' : '▼'}</span>
                </button>
                {expanded[`mod_${i}`] && (
                  <div style={{ padding: '0 14px 12px', color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.6 }}>
                    {mod.description}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dependencies (FR-2.3) */}
      {summary?.dependencies?.length > 0 && (
        <div className="glass" style={{ padding: 18 }}>
          <h3 style={{ marginBottom: 14, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>📦 Key Dependencies</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
            {summary.dependencies.map((dep, i) => (
              <div key={i} style={{
                background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
                borderRadius: 'var(--radius-md)', padding: '10px 12px'
              }}>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 4 }}>
                  {dep.name} {dep.version && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>v{dep.version}</span>}
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', lineHeight: 1.5 }}>{dep.role}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
