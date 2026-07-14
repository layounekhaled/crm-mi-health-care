import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// POST /api/db-migrate - Run pending schema migrations (one-time use)
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (token !== (process.env.MIGRATION_SECRET || 'dalia-migrate-2024-minio-secure')) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }

  const results: string[] = []

  try {
    // Add 'type' column to ChatMessage if not exists
    const typeCheck = await db.$queryRaw`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'ChatMessage' AND column_name = 'type'
    ` as any[]

    if (typeCheck.length === 0) {
      await db.$executeRaw`ALTER TABLE "ChatMessage" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'text'`
      results.push('Added column: ChatMessage.type')
    } else {
      results.push('Column already exists: ChatMessage.type')
    }

    // Add 'imageUrl' column to ChatMessage if not exists
    const imageUrlCheck = await db.$queryRaw`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'ChatMessage' AND column_name = 'imageUrl'
    ` as any[]

    if (imageUrlCheck.length === 0) {
      await db.$executeRaw`ALTER TABLE "ChatMessage" ADD COLUMN "imageUrl" TEXT`
      results.push('Added column: ChatMessage.imageUrl')
    } else {
      results.push('Column already exists: ChatMessage.imageUrl')
    }

    return NextResponse.json({ success: true, migrations: results })
  } catch (error: any) {
    console.error('[DB_MIGRATE]', error)
    return NextResponse.json({ error: error.message, partial: results }, { status: 500 })
  }
}
