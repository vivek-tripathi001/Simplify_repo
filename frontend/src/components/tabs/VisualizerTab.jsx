// src/components/tabs/VisualizerTab.jsx — Module 5 (P5) frontend
// SRS: FR-5.1 to FR-5.6 | SDS §3.4.1 Screen 5
import { useState, useEffect, useRef } from 'react';
import { generateDiagram } from '../../services/api.js';

const DIAGRAM_TYPES = [
  { value: 'flowchart',    label: '🔄 Flowchart' },
  { value: 'sequence',     label: '📡 Sequence' },
  { value: 'classDiagram', label: '🏗 Class Diagram' },
  { value: 'erDiagram',    label: '🗃 ER Diagram' },
];

export default function VisualizerTab({ sessionId, session }) {
  const [diagramType, setDiagramType] = useState('flowchart');
  const [mermaidCode, setMermaidCode] = useState('');
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState(null);
  const [showRaw, setShowRaw]         = useState(false);
  const containerRef = useRef(null);

  const generate = async (type = diagramType) => {
    setLoading(true); setError(null); setMermaidCode('');
    try {
      const { data } = await generateDiagram(sessionId, type);
      setMermaidCode(data.mermaidCode);
    } catch (err) {
      setError(err.error || 'Diagram generation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Render Mermaid diagram when code changes (FR-5.4: client-side rendering)
  useEffect(() => {
    if (!mermaidCode || !containerRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({ startOnLoad: false, theme: 'dark', darkMode: true,
          themeVariables: { background: '#0d1117', primaryColor: '#3b82f6', primaryTextColor: '#e6edf3' }
        });
        const id = 'mermaid-' + Date.now();
        const { svg } = await mermaid.render(id, mermaidCode);
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
          // Make SVG responsive
          const svgEl = containerRef.current.querySelector('svg');
          if (svgEl) {
            svgEl.style.width = '100%';
            svgEl.style.height = 'auto';
            svgEl.style.maxHeight = '600px';
          }
        }
      } catch (e) {
        if (!cancelled) setError('Diagram rendering failed. Showing raw source below.');
      }
    })();
    return () => { cancelled = true; };
  }, [mermaidCode]);

  // FR-5.5: SVG export
  const exportSVG = () => {
    const svg = containerRef.current?.querySelector('svg');
    if (!svg) return;
    const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'diagram.svg'; a.click();
  };

  // FR-5.5: PNG export via canvas
  const exportPNG = async () => {
    const svg = containerRef.current?.querySelector('svg');
    if (!svg) return;
    const img = new Image();
    const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml' });
    img.src = URL.createObjectURL(blob);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width || 1200; canvas.height = img.height || 800;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#0d1117'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      const a = document.createElement('a'); a.href = canvas.toDataURL('image/png');
      a.download = 'diagram.png'; a.click();
    };
  };

  // FR-5.5: Raw Mermaid source download
  const exportMMD = () => {
    const blob = new Blob([mermaidCode], { type: 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'diagram.mmd'; a.click();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <select
          value={diagramType}
          onChange={e => { setDiagramType(e.target.value); }}
          style={{
            background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
            borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
            padding: '8px 12px', fontSize: '0.85rem', cursor: 'pointer'
          }}
        >
          {DIAGRAM_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>

        <button className="btn btn-primary" onClick={() => generate(diagramType)} disabled={loading}>
          {loading ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Generating…</> : '⚡ Generate Diagram'}
        </button>

        {mermaidCode && (
          <>
            <button className="btn btn-secondary" onClick={exportSVG}>⬇ SVG</button>
            <button className="btn btn-secondary" onClick={exportPNG}>⬇ PNG</button>
            <button className="btn btn-secondary" onClick={exportMMD}>⬇ .mmd</button>
            <button className="btn btn-secondary" onClick={() => setShowRaw(p => !p)}>
              {showRaw ? 'Hide Source' : 'Show Source'}
            </button>
          </>
        )}
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', padding: '10px 14px', color: 'var(--red)', fontSize: '0.85rem' }}>
          ⚠ {error}
        </div>
      )}

      {loading && (
        <div className="glass" style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
          <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 14px' }} />
          <div>Generating {diagramType} diagram with AI…</div>
        </div>
      )}

      {!mermaidCode && !loading && !error && (
        <div className="glass" style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🗺</div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>No diagram generated yet</div>
          <div style={{ fontSize: '0.85rem' }}>Select a diagram type and click Generate.</div>
        </div>
      )}

      {/* SVG rendering container (FR-5.4) */}
      {mermaidCode && !loading && (
        <div className="glass" style={{ padding: 20, overflow: 'auto' }}>
          <div ref={containerRef} style={{ minHeight: 200 }} />
        </div>
      )}

      {/* Raw Mermaid source (FR-5.5 fallback) */}
      {showRaw && mermaidCode && (
        <div className="glass" style={{ padding: 16 }}>
          <h4 style={{ marginBottom: 10, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Raw Mermaid Source</h4>
          <pre style={{
            fontFamily: 'var(--font-mono)', fontSize: '0.78rem',
            overflowX: 'auto', lineHeight: 1.6, color: 'var(--text-primary)'
          }}>{mermaidCode}</pre>
        </div>
      )}
    </div>
  );
}
