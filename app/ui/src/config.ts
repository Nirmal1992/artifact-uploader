/**
 * Application configuration
 */

export const config = {
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  apiTimeout: Number(import.meta.env.VITE_API_TIMEOUT) || 30000,
  
  // Upload defaults
  defaultChunkSize: 5 * 1024 * 1024, // 5MB
  defaultMaxParallelChunks: 3,
  defaultMaxRetries: 3,
  defaultRetryDelay: 1000,
} as const;

