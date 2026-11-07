import { CorsOptions } from 'cors';

export function allowedOrigins(value = process.env.CORS_ORIGINS): Set<string> {
  const defaults = process.env.NODE_ENV === 'production'
    ? 'https://betguess.mytepeapi.com.tr'
    : 'http://localhost:5173,http://127.0.0.1:5173,https://betguess.mytepeapi.com.tr';
  return new Set((value ?? defaults).split(',').map(origin => origin.trim()).filter(Boolean).map(origin => {
    const url = new URL(origin);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin) throw new Error('Invalid CORS_ORIGINS entry');
    return origin;
  }));
}

export function corsPolicy(origins: Set<string>): CorsOptions {
  return { credentials: true, origin: (origin, callback) => callback(null, !!origin && origins.has(origin)) };
}
