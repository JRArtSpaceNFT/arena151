// TEMPORARY DEBUG ENDPOINT — DELETE BEFORE REAL LAUNCH
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const adminSecret = process.env.ADMIN_SECRET ?? ''
  const heliusSecret = process.env.HELIUS_WEBHOOK_SECRET ?? ''

  // Check all possible header names
  const headers: Record<string, string> = {}
  req.headers.forEach((value, key) => {
    headers[key] = value.slice(0, 16) + (value.length > 16 ? '...' : '')
  })

  return NextResponse.json({
    adminSecretLen: adminSecret.length,
    heliusSecretLen: heliusSecret.length,
    allHeaders: headers,
  })
}

export async function GET(_req: NextRequest) {
  const adminSecret = process.env.ADMIN_SECRET ?? ''
  const heliusSecret = process.env.HELIUS_WEBHOOK_SECRET ?? ''
  return NextResponse.json({
    adminSecretLen: adminSecret.length,
    adminSecretPrefix: adminSecret.slice(0, 8),
    heliusSecretLen: heliusSecret.length,
    heliusSecretPrefix: heliusSecret.slice(0, 8),
  })
}
