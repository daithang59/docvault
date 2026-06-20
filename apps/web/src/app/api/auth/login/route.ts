import { NextRequest, NextResponse } from 'next/server';
import { getRequestOrigin } from '../request-origin';

const KC_BROWSER_BASE =
  process.env.KEYCLOAK_BROWSER_BASE_URL ??
  process.env.KEYCLOAK_BASE_URL ??
  'http://localhost:8080';
const KC_REALM = process.env.KEYCLOAK_REALM ?? 'docvault';
const CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID ?? 'docvault-gateway';

export interface KeycloakAuthUrlOptions {
  keycloakBaseUrl: string;
  realm: string;
  clientId: string;
  callbackUrl: string;
  state: string;
  nonce: string;
  reauth?: boolean;
}

export function buildKeycloakAuthUrl({
  keycloakBaseUrl,
  realm,
  clientId,
  callbackUrl,
  state,
  nonce,
  reauth = false,
}: KeycloakAuthUrlOptions): URL {
  const url = new URL(
    `${keycloakBaseUrl}/realms/${realm}/protocol/openid-connect/auth`,
  );
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    response_type: 'code',
    scope: 'openid profile email',
    state,
    nonce,
    ...(reauth ? { prompt: 'login', max_age: '0' } : {}),
  }).toString();
  return url;
}

export async function GET(req: NextRequest) {
  const state = Math.random().toString(36).slice(2);
  const nonce = Math.random().toString(36).slice(2);
  const callbackUrl = `${getRequestOrigin(req)}/api/auth/callback`;
  const reauth = req.nextUrl.searchParams.get('reauth') === '1';

  const authUrl = buildKeycloakAuthUrl({
    keycloakBaseUrl: KC_BROWSER_BASE,
    realm: KC_REALM,
    clientId: CLIENT_ID,
    callbackUrl,
    state,
    nonce,
    reauth,
  });

  const response = NextResponse.redirect(authUrl);

  response.cookies.set('kc_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 5 * 60,
    path: '/',
  });

  return response;
}
