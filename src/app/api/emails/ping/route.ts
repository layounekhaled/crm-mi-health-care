import { NextResponse } from 'next/server'

export const maxDuration = 60

// GET /api/emails/ping - Public diagnostic endpoint (no auth required)
// Tests if IMAP/SMTP connections work from the Vercel serverless function
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
      socket.on('connect', () => {
        resolve({ success: true })
        socket.destroy()
      })
      socket.on('timeout', () => {
        resolve({ success: false, error: 'Connection timeout after 10s' })
        socket.destroy()
      })
      socket.on('error', (err) => {
        resolve({ success: false, error: `${err.message} (code: ${err.code || 'unknown'})` })
        socket.destroy()
      })
      socket.connect(993, 'mail.wistyty.com')
    })
    result.imapTcpTest = { status: tcpResult.success ? 'success' : 'failed', ...tcpResult }
  } catch (tcpErr: unknown) {
    result.imapTcpTest = {
      status: 'failed',
      error: tcpErr instanceof Error ? tcpErr.message : String(tcpErr),
    }
  }

  // 3. Test raw TCP connection to SMTP port 587
  result.smtpTcpTest = { status: 'testing...', host: 'mail.wistyty.com', port: 587 }
  try {
    const net = await import('node:net')
    const socket = new net.Socket()
    const tcpResult = await new Promise<{ success: boolean; error?: string }>((resolve) => {
      socket.setTimeout(10000)
      socket.on('connect', () => {
        resolve({ success: true })
        socket.destroy()
      })
      socket.on('timeout', () => {
        resolve({ success: false, error: 'Connection timeout after 10s' })
        socket.destroy()
      })
      socket.on('error', (err) => {
        resolve({ success: false, error: `${err.message} (code: ${err.code || 'unknown'})` })
        socket.destroy()
      })
      socket.connect(587, 'mail.wistyty.com')
    })
    result.smtpTcpTest = { status: tcpResult.success ? 'success' : 'failed', ...tcpResult }
  } catch (tcpErr: unknown) {
    result.smtpTcpTest = {
      status: 'failed',
      error: tcpErr instanceof Error ? tcpErr.message : String(tcpErr),
    }
  }

  // 4. Test raw TCP connection to SMTP port 465
  result.smtp465TcpTest = { status: 'testing...', host: 'mail.wistyty.com', port: 465 }
  try {
    const net = await import('node:net')
    const socket = new net.Socket()
    const tcpResult = await new Promise<{ success: boolean; error?: string }>((resolve) => {
      socket.setTimeout(10000)
      socket.on('connect', () => {
        resolve({ success: true })
        socket.destroy()
      })
      socket.on('timeout', () => {
        resolve({ success: false, error: 'Connection timeout after 10s' })
        socket.destroy()
      })
      socket.on('error', (err) => {
        resolve({ success: false, error: `${err.message} (code: ${err.code || 'unknown'})` })
        socket.destroy()
      })
      socket.connect(465, 'mail.wistyty.com')
    })
    result.smtp465TcpTest = { status: tcpResult.success ? 'success' : 'failed', ...tcpResult }
  } catch (tcpErr: unknown) {
    result.smtp465TcpTest = {
      status: 'failed',
      error: tcpErr instanceof Error ? tcpErr.message : String(tcpErr),
    }
  }

  // 5. Test imapflow import
  result.imapflowImportTest = { status: 'testing...' }
  try {
    const imapModule = await import('imapflow')
    result.imapflowImportTest = {
      status: 'success',
      hasImapFlow: typeof imapModule.ImapFlow === 'function',
    }
  } catch (importErr: unknown) {
    result.imapflowImportTest = {
      status: 'failed',
      error: importErr instanceof Error ? importErr.message : String(importErr),
    }
  }

  // 6. Test nodemailer import
  result.nodemailerImportTest = { status: 'testing...' }
  try {
    const nodemailerModule = await import('nodemailer')
    result.nodemailerImportTest = {
      status: 'success',
      hasCreateTransport: typeof nodemailerModule.createTransport === 'function',
    }
  } catch (importErr: unknown) {
    result.nodemailerImportTest = {
      status: 'failed',
      error: importErr instanceof Error ? importErr.message : String(importErr),
    }
  }

  // 7. Test full IMAP connection
  result.imapFullTest = { status: 'testing...' }
  try {
    const { ImapFlow } = await import('imapflow')
    const client = new ImapFlow({
      host: 'mail.wistyty.com',
      port: 993,
      secure: true,
      auth: {
        user: 'contact@wistyty.com',
        pass: 'Khaled123@',
      },
      tls: { rejectUnauthorized: false },
      logger: false as unknown as undefined,
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 15000,
    })
    await client.connect()
    const mailboxes = await client.list()
    await client.logout()
    result.imapFullTest = {
      status: 'success',
      folders: mailboxes.map(m => `${m.path} (${m.specialUse || 'no-special'})`),
    }
  } catch (imapErr: unknown) {
    const err = imapErr instanceof Error ? imapErr : new Error(String(imapErr))
    result.imapFullTest = {
      status: 'failed',
      error: err.message,
      code: (err as any)?.code || '',
    }
  }

  // 8. Test full SMTP connection
  result.smtpFullTest = { status: 'testing...', port: 587 }
  try {
    const nodemailer = await import('nodemailer')
    const transporter = nodemailer.createTransport({
      host: 'mail.wistyty.com',
      port: 587,
      secure: false,
      auth: {
        user: 'contact@wistyty.com',
        pass: 'Khaled123@',
      },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 15000,
    })
    await transporter.verify()
    transporter.close()
    result.smtpFullTest = { status: 'success' }
  } catch (smtpErr: unknown) {
    const err = smtpErr instanceof Error ? smtpErr : new Error(String(smtpErr))
    result.smtpFullTest = {
      status: 'failed',
      error: err.message,
      code: (err as any)?.code || '',
    }
  }

  return NextResponse.json(result, { status: 200 })
}
