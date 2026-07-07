import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-helpers'
import { testCompanySmtp, getCompanySmtpInfo } from '@/lib/email'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

// GET /api/emails/company-smtp - Get company SMTP config info
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser || !authUser.employeId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const info = getCompanySmtpInfo()
    return NextResponse.json({ config: info })
  } catch (error) {
    console.error('[COMPANY_SMTP_GET]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST /api/emails/company-smtp - Test company SMTP connection
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser || !authUser.employeId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // Only admin can test company SMTP
    if (authUser.role !== 'admin') {
      return NextResponse.json({ error: 'Accès réservé aux administrateurs' }, { status: 403 })
    }

    const result = await testCompanySmtp()

    return NextResponse.json({
      success: result.success,
      message: result.message,
      config: getCompanySmtpInfo(),
    })
  } catch (error) {
    console.error('[COMPANY_SMTP_TEST]', error)
    const message = error instanceof Error ? error.message : 'Erreur inconnue'
    return NextResponse.json({ error: 'Erreur serveur', details: message }, { status: 500 })
  }
}
