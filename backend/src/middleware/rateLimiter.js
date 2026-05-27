// src/middleware/rateLimiter.js — NFR-S5: max 10 analysis requests/IP/hour
import rateLimit from 'express-rate-limit';

export function createRateLimiter(max = 10, windowMs = 3600000) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'Too many analysis requests from this IP. Maximum is 10 per hour. Please try again later.'
    }
  });
}
