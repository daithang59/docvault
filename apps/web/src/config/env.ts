/**
 * Typed environment configuration.
 * Throws at startup if required public env vars are missing.
 */

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const env = {
  APP_NAME: process.env.NEXT_PUBLIC_APP_NAME ?? 'DocVault',
  API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080/api',
} as const;

export type Env = typeof env;
