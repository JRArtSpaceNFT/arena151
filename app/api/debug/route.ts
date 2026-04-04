// TEMPORARY DEBUG ENDPOINT — DELETE BEFORE REAL LAUNCH
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const adminSecret = process.env.ADMIN_SECRET
  const heliusSecret = process.env.HELIUS_WEBHOOK_SECRET
  return NextResponse.json({
    adminSecretLen: adminSecret?.length ?? 'NOT SET',
    adminSecretPrefix: adminSecret?.slice(0, 8) ?? 'NOT SET',
    heliusSecretLen: heliusSecret?.length ?? 'NOT SET',
    heliusSecretPrefix: heliusSecret?.slice(0, 8) ?? 'NOT SET',
    authHeader: req.headers.get('authorization')?.slice(0, 8) ?? 'none',
  })
}
