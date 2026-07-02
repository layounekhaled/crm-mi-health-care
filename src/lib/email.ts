/**
 * Dalia CRM — Centralised Email Utility
 *
 * Sends emails via Nodemailer with two strategies:
 *   1. Per-employee SMTP config from DB (EmailConfig) — takes priority
 *   2. Company-wide Office 365 SMTP (env vars) — fallback default
 *
 * Office 365 connector details:
 *   Host: mihealthcare-com0e.mail.protection.outlook.com
 *   Port: 25 (TLS / STARTTLS)
 */

import nodemailer from 'nodemailer'
import { db } from '@/lib/db'

// ── Types ────────────────────────────────────────────────────
export interface SendEmailOptions {
  to: string | string[]
  cc?: string | string[]
  bcc?: string | string[]
  subject: string
  text?: string
  html?: string
  replyTo?: string
  inReplyTo?: string
  /** If provided, overrides the "from" name */
  fromName?: string
}

export interface SendEmailResult {
  success: boolean
  messageId?: string
  from?: string
  method?: 'personal' | 'company'
  error?: string
}

// ── Company Office 365 SMTP config (from env) ────────────────
function getCompanySmtpConfig() {
  const host = process.env.COMPANY_SMTP_HOST || 'mihealthcare-com0e.mail.protection.outlook.com'
  const port = Number(process.env.COMPANY_SMTP_PORT) || 25

  return {
    host,
    port,
    secure: false, // Port 25/587 use STARTTLS
    requireTLS: true, // Force STARTTLS upgrade
    tls: {
      rejectUnauthorized: false,
    },
    // Office 365 connector on port 25 typically does NOT require auth
    // (IP-based auth via SPF/connector rules)
    // If auth is needed (e.g. smtp.office365.com:587), provide COMPANY_SMTP_USER/PASS
    auth: process.env.COMPANY_SMTP_USER
      ? {
          user: process.env.COMPANY_SMTP_USER,
          pass: process.env.COMPANY_SMTP_PASS || '',
        }
      : undefined,
  }
}

// ── Create transporter ───────────────────────────────────────
function createTransporter(config: {
  host: string
  port: number
  secure?: boolean
  requireTLS?: boolean
  tls?: any
  auth?: { user: string; pass: string } | undefined
}) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure ?? (config.port === 465),
    requireTLS: config.requireTLS,
    auth: config.auth,
    tls: config.tls || { rejectUnauthorized: false },
    connectionTimeout: 20000,
    greetingTimeout: 20000,
    socketTimeout: 45000,
  })
}

// ── Send email (main function) ───────────────────────────────
export async function sendEmail(
  employeId: string,
  options: SendEmailOptions
): Promise<SendEmailResult> {
  // 1. Try per-employee config first
  const emailConfig = await db.emailConfig.findUnique({
    where: { employeId },
  })

  let transporter: nodemailer.Transporter
  let fromAddress: string
  let method: 'personal' | 'company'

  if (emailConfig?.smtpHost && emailConfig?.emailPassword) {
    // ── Personal SMTP (employee's own config) ──
    method = 'personal'
    fromAddress = `"${options.fromName || emailConfig.email}" <${emailConfig.email}>`
    transporter = createTransporter({
      host: emailConfig.smtpHost,
      port: emailConfig.smtpPort,
      tls: { rejectUnauthorized: false },
      auth: {
        user: emailConfig.email,
        pass: emailConfig.emailPassword,
      },
    })
  } else {
    // ── Company SMTP (Office 365 fallback) ──
    method = 'company'
    const companyConfig = getCompanySmtpConfig()

    // Get employee email for "from" address
    const employee = await db.employee.findUnique({
      where: { id: employeId },
      select: { email: true, nom: true },
    })

    const fromEmail = employee?.email || process.env.COMPANY_SMTP_FROM || 'noreply@mi-healthcare.com'
    const fromName = options.fromName || employee?.nom || 'MI HEALTH CARE'
    fromAddress = `"${fromName}" <${fromEmail}>`

    transporter = createTransporter(companyConfig)
  }

  try {
    const info = await transporter.sendMail({
      from: fromAddress,
      to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
      cc: options.cc ? (Array.isArray(options.cc) ? options.cc.join(', ') : options.cc) : undefined,
      bcc: options.bcc ? (Array.isArray(options.bcc) ? options.bcc.join(', ') : options.bcc) : undefined,
      subject: options.subject,
      text: options.text || '',
      html: options.html || undefined,
      replyTo: options.replyTo || undefined,
      inReplyTo: options.inReplyTo || undefined,
    })

    transporter.close()

    return {
      success: true,
      messageId: info.messageId,
      from: fromAddress,
      method,
    }
  } catch (error) {
    transporter.close()
    const message = error instanceof Error ? error.message : 'Erreur inconnue'
    const code = (error as any)?.code || ''

    let userMessage = "Impossible d'envoyer l'email"
    if (message.includes('Invalid login') || message.includes('AUTH') || message.includes('credentials')) {
      userMessage = 'Identifiants SMTP incorrects. Vérifiez votre configuration email.'
    } else if (message.includes('ENOTFOUND') || message.includes('getaddrinfo')) {
      userMessage = 'Serveur SMTP introuvable. Vérifiez la configuration.'
    } else if (message.includes('ECONNREFUSED')) {
      userMessage = 'Connexion SMTP refusée. Le port est peut-être bloqué.'
    } else if (message.includes('ETIMEDOUT') || message.includes('timeout') || code === 'ETIMEDOUT') {
      userMessage = "Délai d'attente SMTP dépassé. Le port est peut-être bloqué."
    } else if (message.includes('EHOSTUNREACH') || code === 'EHOSTUNREACH') {
      userMessage = 'Impossible de joindre le serveur SMTP. Port probablement bloqué.'
    } else if (message.includes('Sender rejected') || message.includes('550 5.7.1')) {
      userMessage = "Expéditeur rejeté par le serveur. Vérifiez que l'adresse d'envoi est autorisée (SPF/DKIM)."
    } else if (message.includes('Must issue a STARTTLS')) {
      userMessage = 'Le serveur requiert STARTTLS. Vérifiez la configuration TLS.'
    }

    return {
      success: false,
      from: fromAddress,
      method,
      error: userMessage,
    }
  }
}

// ── Test SMTP connection ─────────────────────────────────────
export async function testSmtpConnection(config: {
  host: string
  port: number
  secure?: boolean
  user?: string
  pass?: string
  tls?: boolean
}): Promise<{ success: boolean; message: string }> {
  try {
    const transporter = createTransporter({
      host: config.host,
      port: config.port,
      tls: { rejectUnauthorized: false },
      auth: config.user ? { user: config.user, pass: config.pass || '' } : undefined,
    })

    await transporter.verify()
    transporter.close()

    return { success: true, message: 'Connexion SMTP réussie' }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue'
    const code = (error as any)?.code || ''

    let userMessage = message
    if (message.includes('Invalid login') || message.includes('AUTH') || message.includes('credentials')) {
      userMessage = 'Identifiants SMTP incorrects.'
    } else if (message.includes('ENOTFOUND') || message.includes('getaddrinfo')) {
      userMessage = `Serveur "${config.host}" introuvable.`
    } else if (message.includes('ECONNREFUSED')) {
      userMessage = `Connexion refusée par ${config.host}:${config.port}.`
    } else if (message.includes('ETIMEDOUT') || code === 'ETIMEDOUT') {
      userMessage = `Délai dépassé pour ${config.host}:${config.port}.`
    } else if (message.includes('EHOSTUNREACH') || code === 'EHOSTUNREACH') {
      userMessage = `Impossible de joindre ${config.host}:${config.port}. Port bloqué.`
    }

    return { success: false, message: userMessage }
  }
}

// ── Test company SMTP ────────────────────────────────────────
export async function testCompanySmtp(): Promise<{ success: boolean; message: string }> {
  const config = getCompanySmtpConfig()
  return testSmtpConnection({
    host: config.host,
    port: config.port,
    secure: config.secure,
    user: config.auth?.user,
    pass: config.auth?.pass,
  })
}

// ── Get company SMTP info (for UI display) ───────────────────
export function getCompanySmtpInfo() {
  return {
    host: process.env.COMPANY_SMTP_HOST || 'mihealthcare-com0e.mail.protection.outlook.com',
    port: Number(process.env.COMPANY_SMTP_PORT) || 25,
    tls: true,
    from: process.env.COMPANY_SMTP_FROM || 'noreply@mi-healthcare.com',
  }
}

// ── Save sent copy to IMAP ───────────────────────────────────
export async function saveToImapSent(
  emailConfig: { imapHost: string; imapPort: number; imapTls: boolean; email: string; emailPassword: string },
  messageData: {
    from: string; to: string | string[]; cc?: string | string[];
    subject: string; text?: string; html?: string;
    replyTo?: string; messageId?: string;
  }
): Promise<boolean> {
  try {
    const { ImapFlow } = await import('imapflow')
    const MailComposer = require('nodemailer/lib/mail-composer')

    const composer = new MailComposer({
      from: messageData.from,
      to: Array.isArray(messageData.to) ? messageData.to.join(', ') : messageData.to,
      cc: messageData.cc ? (Array.isArray(messageData.cc) ? messageData.cc.join(', ') : messageData.cc) : undefined,
      subject: messageData.subject,
      text: messageData.text || '',
      html: messageData.html || undefined,
      replyTo: messageData.replyTo || undefined,
      date: new Date(),
      messageId: messageData.messageId,
    })

    const mimeNode = composer.compile()
    const rawMessage = await new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = []
      const stream = mimeNode.createReadStream()
      stream.on('data', (chunk: Buffer) => chunks.push(chunk))
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
      stream.on('error', reject)
    })

    const imapClient = new ImapFlow({
      host: emailConfig.imapHost,
      port: emailConfig.imapPort,
      secure: emailConfig.imapTls,
      auth: {
        user: emailConfig.email,
        pass: emailConfig.emailPassword,
      },
      tls: { rejectUnauthorized: false },
      logger: false as unknown as undefined,
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 30000,
    })

    await imapClient.connect()

    const mailboxes = await imapClient.list()
    const sentFolder = mailboxes.find(m => {
      if (m.specialUse === '\\Sent') return true
      const lowerPath = m.path.toLowerCase()
      return lowerPath.includes('sent') ||
        lowerPath.includes('envoy') ||
        lowerPath.includes('éléments envoyés')
    })

    if (sentFolder) {
      const contentBuffer = Buffer.from(rawMessage, 'utf-8')
      await imapClient.append(sentFolder.path, contentBuffer, ['\\Seen'], new Date())
      await imapClient.logout()
      return true
    } else {
      console.warn('[EMAIL_IMAP_APPEND] Dossier Envoyés non trouvé. Dossiers:', mailboxes.map(m => m.path).join(', '))
      await imapClient.logout()
      return false
    }
  } catch (error) {
    console.error('[EMAIL_IMAP_APPEND] Erreur:', error)
    return false
  }
}
