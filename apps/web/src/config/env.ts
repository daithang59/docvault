export const env = {
  APP_NAME: process.env.NEXT_PUBLIC_APP_NAME ?? 'DocVault',
  API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api',
} as const;

export type Env = typeof env;
