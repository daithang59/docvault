import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const accessToken = req.cookies.get('dv_access_token')?.value;

  if (!accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const gatewayUrl = process.env.GATEWAY_URL ?? 'http://localhost:3000';
    const response = await fetch(`${gatewayUrl}/api/users/profile`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      credentials: 'include',
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch profile' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
