import { describe, expect, it } from 'vitest';
import { buildKeycloakAuthUrl } from './route';

describe('auth login route helpers', () => {
  it('adds OIDC re-auth parameters when sensitive action reauth is requested', () => {
    const url = buildKeycloakAuthUrl({
      keycloakBaseUrl: 'http://keycloak:8080',
      realm: 'docvault',
      clientId: 'docvault-gateway',
      callbackUrl: 'http://localhost:3006/api/auth/callback',
      state: 'state-1',
      nonce: 'nonce-1',
      reauth: true,
    });

    expect(url.searchParams.get('prompt')).toBe('login');
    expect(url.searchParams.get('max_age')).toBe('0');
    expect(url.searchParams.get('client_id')).toBe('docvault-gateway');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'http://localhost:3006/api/auth/callback',
    );
  });
});
