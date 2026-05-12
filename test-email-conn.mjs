import { ImapFlow } from 'imapflow'
import nodemailer from 'nodemailer'

const EMAIL = 'contact@wistyty.com'
const PASS = 'Khaled123@'
const IMAP_HOST = 'mail.wistyty.com'
const IMAP_PORT = 993
const SMTP_HOST = 'mail.wistyty.com'
const SMTP_PORT = 587

console.log('=== Testing IMAP Connection ===')

const imapClient = new ImapFlow({
  host: IMAP_HOST,
  port: IMAP_PORT,
  secure: true,
  auth: { user: EMAIL, pass: PASS },
  tls: { rejectUnauthorized: false },
  logger: false,
  connectionTimeout: 15000,
  greetingTimeout: 15000,
  socketTimeout: 15000,
})

try {
  await imapClient.connect()
  console.log('✅ IMAP connected!')
  const mailboxes = await imapClient.list()
  console.log('Folders:', mailboxes.map(m => `${m.path} (${m.specialUse || 'no-special'})`))
  await imapClient.logout()
  console.log('✅ IMAP test PASSED')
} catch (err) {
  console.error('❌ IMAP FAILED:', err.message, 'Code:', err.code)
}

console.log('\n=== Testing SMTP port 587 STARTTLS ===')
try {
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST, port: SMTP_PORT, secure: false, requireTLS: true,
    auth: { user: EMAIL, pass: PASS },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 15000,
  })
  await transporter.verify()
  console.log('✅ SMTP port 587 STARTTLS PASSED')
  transporter.close()
} catch (err) {
  console.error('❌ SMTP port 587 FAILED:', err.message)
}

console.log('\n=== Testing SMTP port 587 (no requireTLS) ===')
try {
  const t2 = nodemailer.createTransport({
    host: SMTP_HOST, port: 587, secure: false,
    auth: { user: EMAIL, pass: PASS },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 15000,
  })
  await t2.verify()
  console.log('✅ SMTP port 587 (no requireTLS) PASSED')
  t2.close()
} catch (err) {
  console.error('❌ SMTP port 587 (no requireTLS) FAILED:', err.message)
}

console.log('\n=== Testing SMTP port 465 SSL ===')
try {
  const t3 = nodemailer.createTransport({
    host: SMTP_HOST, port: 465, secure: true,
    auth: { user: EMAIL, pass: PASS },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 15000,
  })
  await t3.verify()
  console.log('✅ SMTP port 465 PASSED')
  t3.close()
} catch (err) {
  console.error('❌ SMTP port 465 FAILED:', err.message)
}
