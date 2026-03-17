import { NextResponse } from 'next/server';

export function GET() {
  return NextResponse.json({
    status: 'ok',
    app: process.env.NEXT_PUBLIC_APP_NAME ?? 'DocVault',
    timestamp: new Date().toISOString(),
  });
}
