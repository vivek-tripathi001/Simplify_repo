// src/components/tabs/ChatBotTab.jsx — Module 3 (P3) frontend
// SRS: FR-3.1 to FR-3.7 | SDS §3.4.1 Screen 3
import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { sendChat, clearHistory } from '../../services/api.js';

export default function ChatBotTab({ sessionId, session }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: `Hi! I'm ready to answer questions about **${session?.repoMetadata?.fullName || 'this repository'}**. Ask me about any file, module, function, or architecture decision.` }
  ]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [fallbackMsg, setFallbackMsg] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (e) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setFallbackMsg(null);
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setLoading(true);
    try {
      const { data } = await sendChat(sessionId, text);
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
      if (data.isFallback) setFallbackMsg('I couldn\'t find specific information about that in this repository. Try a more specific question.');
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠ ' + (err.error || 'Request failed. Please try again.') }]);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    try { await clearHistory(sessionId); } catch (_) {}
    setMessages([{ role: 'assistant', content: 'Conversation history cleared. Ask me anything about the repository.' }]);
    setFallbackMsg(null);
  };

  const suggestedQuestions = [
    'What does this project do?',
    'What are the main entry points?',
    'Explain the folder structure',
    'What design patterns are used?',
    'List the main dependencies',
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 220px)', minHeight: 500 }}>
      {/* Context indicator + Clear */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '8px 0 12px', borderBottom: '1px solid var(--border)', marginBottom: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="badge badge-green">● Live context</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
            Grounded in {session?.repoMetadata?.fullName}
          </span>
        </div>
        <button className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '5px 10px' }} onClick={handleClear}>
          Clear history
        </button>
      </div>

      {/* Message list */}
      <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{
            display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            marginBottom: 14
          }}>
            {msg.role === 'assistant' && (
              <div style={{
                width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.85rem', flexShrink: 0, marginRight: 8, marginTop: 2
              }}>🤖</div>
            )}
            <div style={{
              maxWidth: '75%',
              background: msg.role === 'user' ? 'var(--accent)' : 'var(--glass-bg)',
              border: msg.role === 'user' ? 'none' : '1px solid var(--glass-border)',
              borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '4px 14px 14px 14px',
              padding: '10px 14px', fontSize: '0.88rem', lineHeight: 1.6
            }}>
              {msg.role === 'assistant'
                ? <div className="md-body"><ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown></div>
                : <span>{msg.content}</span>}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem' }}>🤖</div>
            <div className="glass" style={{ padding: '10px 14px' }}>
              <span className="spinner" style={{ width: 14, height: 14 }} />
            </div>
          </div>
        )}

        {/* Fallback suggestion (FR-3.6) */}
        {fallbackMsg && (
          <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 'var(--radius-md)', padding: '8px 12px', marginBottom: 10, fontSize: '0.82rem', color: 'var(--yellow)' }}>
            💡 {fallbackMsg}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggested questions */}
      {messages.length <= 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {suggestedQuestions.map(q => (
            <button key={q} className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '5px 10px' }}
              onClick={() => { setInput(q); }}>
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input bar */}
      <form onSubmit={send} style={{ display: 'flex', gap: 10, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <input className="input" style={{ flex: 1 }}
          placeholder="Ask about any file, module, or function…"
          value={input} onChange={e => setInput(e.target.value)} disabled={loading} />
        <button className="btn btn-primary" type="submit" disabled={loading || !input.trim()}>
          {loading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Send ↑'}
        </button>
      </form>
    </div>
  );
}
