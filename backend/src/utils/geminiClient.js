// src/utils/geminiClient.js
// Gemini 2.5 Flash — drop-in helper used by all service modules
// Replaces OpenAI SDK throughout the project

import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * callGemini({ messages, maxTokens, temperature })
 *
 * Accepts the same OpenAI-style messages array:
 *   [ { role: 'system'|'user'|'assistant', content: '...' } ]
 *
 * Returns the response text as a plain string.
 */
export async function callGemini(messages, { maxTokens = 1000, temperature = 0.3 } = {}) {
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash-preview-04-17';

  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature
    }
  });

  // Pull out system message (Gemini handles it as a prefix on the first user turn)
  const systemMsg = messages.find(m => m.role === 'system')?.content || '';
  const turns     = messages.filter(m => m.role !== 'system');

  // Build Gemini history from all turns except the final user message
  const history = [];
  for (let i = 0; i < turns.length - 1; i++) {
    history.push({
      role:  turns[i].role === 'assistant' ? 'model' : 'user',
      parts: [{ text: turns[i].content }]
    });
  }

  // The last turn is the actual message we're sending
  const lastContent = turns[turns.length - 1]?.content || '';
  const fullPrompt  = systemMsg
    ? `${systemMsg}\n\n${lastContent}`
    : lastContent;

  const chat   = model.startChat({ history });
  const result = await chat.sendMessage(fullPrompt);
  return result.response.text();
}

/**
 * callGeminiWithRetry — wraps callGemini with exponential backoff
 * for rate-limit (429) errors. Used by summary and security services.
 */
export async function callGeminiWithRetry(messages, options = {}, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await callGemini(messages, options);
    } catch (err) {
      const isRateLimit = err.message?.includes('429') ||
                          err.message?.includes('quota') ||
                          err.status === 429;
      if (isRateLimit && attempt < maxRetries - 1) {
        const delay = 2000 * (attempt + 1);
        console.warn(`[Gemini] Rate limit hit, retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      console.error('[Gemini Error]', err.message);
      throw err;
    }
  }
}
