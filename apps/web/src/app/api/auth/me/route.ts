import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const accessToken = req.cookies.get('dv_access_token')?.value;
  const userCookie = req.cookies.get('dv_user')?.value;

  if (!accessToken || !userCookie) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const user = JSON.parse(userCookie);
    return NextResponse.json({ accessToken, user });
  } catch {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }
}
