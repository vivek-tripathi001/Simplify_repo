// src/hooks/useSSE.js — P7: SSE client hook (FR-7.1)
// Connects to /api/terminal/stream and dispatches events to App state
import { useEffect, useRef, useCallback } from 'react';
import { sseUrl } from '../services/api.js';

export function useSSE(sessionId, onLog, onStep, onAnalysisComplete, onAnalysisError) {
  const esRef = useRef(null);

  const connect = useCallback(() => {
    if (!sessionId) return;
    if (esRef.current) esRef.current.close();

    const es = new EventSource(sseUrl(sessionId));
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        switch (payload.type) {
          case 'log':              onLog?.(payload.data);    break;
          case 'step':             onStep?.(payload.data);   break;
          case 'analysis_complete': onAnalysisComplete?.();  break;
          case 'analysis_error':   onAnalysisError?.(payload.error); break;
          default: break;
        }
      } catch (_) {}
    };

    // Browser EventSource auto-reconnects on error
    es.onerror = () => {};

  }, [sessionId, onLog, onStep, onAnalysisComplete, onAnalysisError]);

  useEffect(() => {
    connect();
    return () => esRef.current?.close();
  }, [connect]);

  return { disconnect: () => esRef.current?.close() };
}
