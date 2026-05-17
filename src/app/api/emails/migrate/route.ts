import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-helpers'
import { db } from '@/lib/db'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

// GET /api/emails/migrate - Check and fix email config table schema
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser || !authUser.employeId || authUser.role !== 'admin') {
      return NextResponse.json({ error: 'Non autorisé (admin uniquement)' }, { status: 401 })
    }

    const result: Record<string, unknown> = {}

    // Check if signature column exists by trying to query it
    result.signatureCheck = { status: 'testing...' }
    try {
      const configs = await db.emailConfig.findMany({
        select: { id: true, email: true, signature: true },
        take: 1,
      })
      result.signatureCheck = { status: 'success', message: 'Column "signature" exists', sampleCount: configs.length }
    } catch (sigErr: unknown) {
      const err = sigErr instanceof Error ? sigErr : new Error(String(sigErr))
      result.signatureCheck = { status: 'failed', error: err.message, code: (err as any)?.code }
    }

    // Check all EmailConfig columns by doing a raw query
    result.rawSchemaCheck = { status: 'testing...' }
    try {
      const columns = await db.$queryRaw`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'EmailConfig' 
        ORDER BY ordinal_position
      `
      result.rawSchemaCheck = { status: 'success', columns }
    } catch (rawErr: unknown) {
      const err = rawErr instanceof Error ? rawErr : new Error(String(rawErr))
      result.rawSchemaCheck = { status: 'failed', error: err.message }
    }

    // Try to add missing columns
    result.addColumnAttempt = { status: 'testing...' }
    try {
      await db.$executeRawUnsafe(`
        ALTER TABLE "EmailConfig" 
        ADD COLUMN IF NOT EXISTS "signature" TEXT
      `)
      result.addColumnAttempt = { status: 'success', message: 'signature column ensured' }
    } catch (alterErr: unknown) {
      const err = alterErr instanceof Error ? alterErr : new Error(String(alterErr))
      result.addColumnAttempt = { status: 'failed', error: err.message, code: (err as any)?.code }
    }

    // Verify again
    result.verifyAfterFix = { status: 'testing...' }
    try {
      const configs = await db.emailConfig.findMany({
        select: { id: true, email: true, signature: true },
        take: 1,
      })
      result.verifyAfterFix = { status: 'success', message: 'signature column verified', sampleCount: configs.length }
    } catch (sigErr: unknown) {
      const err = sigErr instanceof Error ? sigErr : new Error(String(sigErr))
      result.verifyAfterFix = { status: 'failed', error: err.message }
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('[EMAIL_MIGRATE]', error)
    const message = error instanceof Error ? error.message : 'Erreur inconnue'
    return NextResponse.json({ error: 'Erreur serveur', details: message }, { status: 500 })
  }
}
