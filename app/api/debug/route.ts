// TEMPORARY DEBUG ENDPOINT — DELETE BEFORE REAL LAUNCH
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const adminSecret = process.env.ADMIN_SECRET ?? ''
  const heliusSecret = process.env.HELIUS_WEBHOOK_SECRET ?? ''
  const authHeader = req.headers.get('authorization') ?? req.headers.get('Authorization') ?? ''
  const rawBody = await req.text()

  const adminMatch = authHeader === `Bearer ${adminSecret}`
  const heliusMatch = authHeader.trim() === heliusSecret.trim()

  return NextResponse.json({
    adminSecretLen: adminSecret.length,
    adminSecretPrefix: adminSecret.slice(0, 8),
    heliusSecretLen: heliusSecret.length,
    heliusSecretPrefix: heliusSecret.slice(0, 8),
    authHeaderLen: authHeader.length,
    authHeaderPrefix: authHeader.slice(0, 8),
    adminMatch,
    heliusMatch,
    bodyLen: rawBody.length,
  })
}

export async function GET(req: NextRequest) {
  const adminSecret = process.env.ADMIN_SECRET ?? ''
  const heliusSecret = process.env.HELIUS_WEBHOOK_SECRET ?? ''
  return NextResponse.json({
    adminSecretLen: adminSecret.length,
    adminSecretPrefix: adminSecret.slice(0, 8),
    heliusSecretLen: heliusSecret.length,
    heliusSecretPrefix: heliusSecret.slice(0, 8),
  })
}
