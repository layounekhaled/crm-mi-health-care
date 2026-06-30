import { NextRequest, NextResponse } from 'next/server'

// Webhook receiver for GitHub push events
// Triggers Coolify deployment when code is pushed to main
const COOLIFY_HOST = process.env.COOLIFY_HOST || 'http://156.67.26.104:8000'
const COOLIFY_TOKEN = process.env.COOLIFY_TOKEN || ''
const COOLIFY_APP_UUID = process.env.COOLIFY_APP_UUID || ''

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json()
    
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
      console.log('[WEBHOOK] Deployment triggered:', deployData)
      return NextResponse.json({ 
        success: true, 
        message: 'Deployment triggered',
        deployment: deployData 
      })
    } else {
      console.error('[WEBHOOK] Deploy failed:', deployData)
      return NextResponse.json({ 
        error: 'Deploy failed', 
        details: deployData 
      }, { status: 500 })
    }
  } catch (error) {
    console.error('[WEBHOOK] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
