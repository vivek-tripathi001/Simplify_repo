// src/components/tabs/TerminalTab.jsx — Module 7 (P7) frontend
// SRS: FR-7.1 to FR-7.5 | SDS §3.4.1 Screen 7
import { useState, useRef, useEffect } from 'react';
import { exportLogs } from '../../services/api.js';

const LEVEL_COLORS = { INFO: '#e6edf3', WARNING: '#f59e0b', ERROR: '#ef4444' };
const MODULE_COLORS = {
  'P1-Ingestion':    '#3b82f6',
  'P2-Summarization':'#8b5cf6',
  'P3-ChatBot':      '#22c55e',
  'P4-Security':     '#ef4444',
  'P5-Visualizer':   '#f59e0b',
  'P6-Wiki':         '#06b6d4',
};

// FR-7.2: Step status indicators
const STEP_STATUS = {
  STEP_START:    { icon: '⚡', color: '#f59e0b', label: 'Running' },
  STEP_COMPLETE: { icon: '✅', color: '#22c55e', label: 'Done' },
  STEP_ERROR:    { icon: '❌', color: '#ef4444', label: 'Error' },
};

export default function TerminalTab({ logs, steps, sessionId, analyzing }) {
  // FR-7.3: Log level filter
  const [filter, setFilter] = useState('ALL');
  const [autoScroll, setAutoScroll] = useState(true);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (autoScroll) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs, autoScroll]);

  const filtered = filter === 'ALL'
    ? logs
    : logs.filter(l => l.level === filter);

  const stepEntries = Object.values(steps);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Pipeline step status tracker (FR-7.2) */}
      {(analyzing || stepEntries.length > 0) && (
        <div className="glass" style={{ padding: '12px 16px' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 8 }}>PIPELINE STATUS</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {stepEntries.length === 0 && analyzing && (
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                <span className="spinner" style={{ width: 12, height: 12, marginRight: 6 }} />
                Starting…
              </span>
            )}
            {stepEntries.map((step, i) => {
              const cfg = STEP_STATUS[step.type] || STEP_STATUS.STEP_START;
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
                  borderRadius: 20, padding: '3px 10px', fontSize: '0.75rem'
                }}>
                  <span>{cfg.icon}</span>
                  <span style={{ color: MODULE_COLORS[step.module] || 'var(--text-secondary)' }}>{step.module}</span>
                  <span style={{ color: 'var(--text-muted)' }}>›</span>
                  <span>{step.step}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Terminal window */}
      <div className="glass" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Toolbar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 14px', borderBottom: '1px solid var(--glass-border)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Traffic lights */}
            {['#ef4444','#f59e0b','#22c55e'].map((c,i) => (
              <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
            ))}
            <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginLeft: 6 }}>
              Developer Terminal
              {analyzing && <><span className="spinner" style={{ width: 10, height: 10, marginLeft: 8 }} /> live</>}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* FR-7.3: filter */}
            {['ALL','INFO','WARNING','ERROR'].map(lvl => (
              <button key={lvl} onClick={() => setFilter(lvl)}
                style={{
                  background: filter === lvl ? 'var(--accent)' : 'transparent',
                  border: '1px solid var(--glass-border)',
                  color: filter === lvl ? '#fff' : 'var(--text-muted)',
                  borderRadius: 4, padding: '2px 8px', fontSize: '0.72rem',
                  cursor: 'pointer', fontFamily: 'var(--font-sans)'
                }}>
                {lvl}
              </button>
            ))}
            <button onClick={() => setAutoScroll(p => !p)} style={{
              background: autoScroll ? 'rgba(34,197,94,0.1)' : 'transparent',
              border: '1px solid var(--glass-border)', borderRadius: 4,
              padding: '2px 8px', fontSize: '0.72rem', cursor: 'pointer',
              color: autoScroll ? 'var(--green)' : 'var(--text-muted)',
              fontFamily: 'var(--font-sans)'
            }}>Auto-scroll</button>
            {/* FR-7.4: Export logs */}
            {sessionId && logs.length > 0 && (
              <a href={exportLogs(sessionId)} download style={{ textDecoration: 'none' }}>
                <button style={{
                  background: 'transparent', border: '1px solid var(--glass-border)',
                  borderRadius: 4, padding: '2px 8px', fontSize: '0.72rem',
                  cursor: 'pointer', color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)'
                }}>⬇ Logs</button>
              </a>
            )}
          </div>
        </div>

        {/* Log lines (FR-7.1) */}
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: '0.78rem', lineHeight: 1.7,
          padding: '12px 14px', overflowY: 'auto',
          height: 'calc(100vh - 380px)', minHeight: 300,
          background: 'rgba(0,0,0,0.3)'
        }}>
          {filtered.length === 0 && (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', paddingTop: 40 }}>
              {analyzing ? 'Waiting for log events…' : 'No log events yet. Start an analysis to see output here.'}
            </div>
          )}
          {filtered.map((log, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 2 }}>
              <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <span style={{
                color: MODULE_COLORS[log.module] || 'var(--text-secondary)',
                flexShrink: 0, minWidth: 120
              }}>[{log.module}]</span>
              {/* FR-7.3: level color coding */}
              <span style={{ color: LEVEL_COLORS[log.level] || 'var(--text-primary)' }}>
                {log.message}
              </span>
            </div>
          ))}
          {/* FR-7.5: Error detail display */}
          {filtered.some(l => l.level === 'ERROR') && (
            <div style={{ marginTop: 8, padding: '6px 10px', background: 'rgba(239,68,68,0.08)', borderRadius: 4, fontSize: '0.75rem', color: 'var(--red)' }}>
              ⚠ Errors detected. Check the relevant tab for details and retry options.
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}
