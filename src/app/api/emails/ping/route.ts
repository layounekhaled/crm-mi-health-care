import { NextResponse } from 'next/server'
import { ImapFlow } from 'imapflow'
import nodemailer from 'nodemailer'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

// GET /api/emails/ping - Public diagnostic endpoint (no auth required)
// Tests if email ports are reachable from the serverless function
// Does NOT test actual login - just TCP connectivity and module imports
export async function GET() {
  const result: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    environment: {
      nodeVersion: process.version,
      vercel: !!process.env.VERCEL,
      vercelRegion: process.env.VERCEL_REGION || 'unknown',
      platform: process.platform,
    },
  }

  // 1. Test DNS resolution
  result.dnsTest = { status: 'testing...' }
  try {
    const { lookup } = await import('node:dns/promises')
    const imapDns = await lookup('mail.wistyty.com')
    result.dnsTest = {
      status: 'success',
      imap: { address: imapDns.address, family: imapDns.family },
    }
  } catch (dnsErr: unknown) {
    result.dnsTest = {
      status: 'failed',
      error: dnsErr instanceof Error ? dnsErr.message : String(dnsErr),
    }
  }

  // 2. Test raw TCP connection to IMAP port 993
  result.imapTcpTest = { status: 'testing...', host: 'mail.wistyty.com', port: 993 }
  try {
    const net = await import('node:net')
    const socket = new net.Socket()
    const tcpResult = await new Promise<{ success: boolean; error?: string }>((resolve) => {
      socket.setTimeout(10000)
      socket.on('connect', () => { resolve({ success: true }); socket.destroy() })
      socket.on('timeout', () => { resolve({ success: false, error: 'Connection timeout after 10s' }); socket.destroy() })
      socket.on('error', (err) => { resolve({ success: false, error: `${err.message} (code: ${err.code || 'unknown'})` }); socket.destroy() })
      socket.connect(993, 'mail.wistyty.com')
    })
    result.imapTcpTest = { status: tcpResult.success ? 'success' : 'failed', ...tcpResult }
  } catch (tcpErr: unknown) {
    result.imapTcpTest = { status: 'failed', error: tcpErr instanceof Error ? tcpErr.message : String(tcpErr) }
  }

  // 3. Test raw TCP connection to SMTP port 587
  result.smtpTcpTest = { status: 'testing...', host: 'mail.wistyty.com', port: 587 }
  try {
    const net = await import('node:net')
    const socket = new net.Socket()
    const tcpResult = await new Promise<{ success: boolean; error?: string }>((resolve) => {
      socket.setTimeout(10000)
      socket.on('connect', () => { resolve({ success: true }); socket.destroy() })
      socket.on('timeout', () => { resolve({ success: false, error: 'Connection timeout after 10s' }); socket.destroy() })
      socket.on('error', (err) => { resolve({ success: false, error: `${err.message} (code: ${err.code || 'unknown'})` }); socket.destroy() })
      socket.connect(587, 'mail.wistyty.com')
    })
    result.smtpTcpTest = { status: tcpResult.success ? 'success' : 'failed', ...tcpResult }
  } catch (tcpErr: unknown) {
    result.smtpTcpTest = { status: 'failed', error: tcpErr instanceof Error ? tcpErr.message : String(tcpErr) }
  }

  // 4. Test module imports (static - should always work)
  result.imapflowImportTest = { status: 'success', hasImapFlow: typeof ImapFlow === 'function' }
  result.nodemailerImportTest = { status: 'success', hasCreateTransport: typeof nodemailer.createTransport === 'function' }

  return NextResponse.json(result, { status: 200 })
}
