import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'

// Webhook receiver for GitHub push events
// Triggers Coolify deployment when code is pushed to main
// Secured with HMAC-SHA256 signature verification
const COOLIFY_HOST = process.env.COOLIFY_HOST || 'http://156.67.26.104:8000'
const COOLIFY_TOKEN = process.env.COOLIFY_TOKEN || ''
const COOLIFY_APP_UUID = process.env.COOLIFY_APP_UUID || ''
const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || ''

function verifySignature(payload: string, signature: string | null): boolean {
  if (!WEBHOOK_SECRET) {
    console.warn('[WEBHOOK] No GITHUB_WEBHOOK_SECRET set — skipping signature verification')
    return true // Allow if no secret configured (backward compatible)
  }

  if (!signature) return false

  const expected = 'sha256=' + createHmac('sha256', WEBHOOK_SECRET).update(payload).digest('hex')
  return expected === signature
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    const signature = request.headers.get('x-hub-signature-256')

    // Verify GitHub webhook signature
    if (!verifySignature(rawBody, signature)) {
      console.warn('[WEBHOOK] Invalid signature — rejected')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
    }

    const payload = JSON.parse(rawBody)
    
    // Only deploy on push to main
    const ref = payload.ref
    if (!ref || !ref.endsWith('/main')) {
      return NextResponse.json({ message: 'Not a push to main, skipping' })
    }

    // Trigger Coolify deployment
    if (!COOLIFY_TOKEN || !COOLIFY_APP_UUID) {
      console.error('[WEBHOOK] Missing COOLIFY_TOKEN or COOLIFY_APP_UUID env vars')
      return NextResponse.json({ error: 'Coolify not configured' }, { status: 500 })
    }

    const deployUrl = `${COOLIFY_HOST}/api/v1/deploy?uuid=${COOLIFY_APP_UUID}`
    const deployRes = await fetch(deployUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${COOLIFY_TOKEN}`,
        'Content-Type': 'application/json',
      },
    })

    const deployData = await deployRes.json()

    if (deployRes.ok) {
      console.log('[WEBHOOK] Deployment triggered')
      return NextResponse.json({ 
        success: true, 
        message: 'Deployment triggered',
      })
    } else {
      console.error('[WEBHOOK] Deploy failed')
      return NextResponse.json({ 
        error: 'Deploy failed',
      }, { status: 500 })
    }
  } catch (error) {
    console.error('[WEBHOOK] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
