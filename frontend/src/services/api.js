// src/services/api.js — centralized Axios API client
import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({ baseURL: BASE, timeout: 120000 });

// Intercept responses — normalize errors (NFR-U4)
api.interceptors.response.use(
  r => r,
  err => Promise.reject(err.response?.data || { error: 'Network error. Please check your connection.' })
);

export const analyzeRepo      = (url)            => api.post('/analyze', { url });
export const getSession       = (sessionId)      => api.get(`/analyze/${sessionId}`);
export const sendChat         = (sessionId, message) => api.post('/chat', { sessionId, message });
export const clearHistory     = (sessionId)      => api.delete(`/chat/${sessionId}/history`);
export const runSecurity      = (sessionId)      => api.post('/security/scan', { sessionId });
export const exportSecurity   = (sessionId)      => `${BASE}/security/${sessionId}/export`;
export const generateDiagram  = (sessionId, diagramType) => api.post('/visualizer/generate', { sessionId, diagramType });
export const generateWiki     = (sessionId)      => api.post('/wiki/generate', { sessionId });
export const exportWiki       = (sessionId)      => `${BASE}/wiki/${sessionId}/export`;
export const getLogs          = (sessionId, level) => api.get(`/terminal/logs/${sessionId}`, { params: level ? { level } : {} });
export const exportLogs       = (sessionId)      => `${BASE}/terminal/logs/${sessionId}/export`;
export const sseUrl           = (sessionId)      => `${BASE}/terminal/stream?sessionId=${sessionId}`;
