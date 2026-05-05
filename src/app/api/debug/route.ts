import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function GET(request: NextRequest) {
  const debug: Record<string, unknown> = {}

  // Check env vars
  debug.hasNextauthSecret = !!process.env.NEXTAUTH_SECRET
  debug.nextauthUrl = process.env.NEXTAUTH_URL || 'NOT SET'
  debug.hasNextauthUrl = !!process.env.NEXTAUTH_URL
  debug.hasDatabaseUrl = !!process.env.DATABASE_URL
  debug.databaseUrlPrefix = process.env.DATABASE_URL?.substring(0, 30) || 'NOT SET'
  debug.nodeEnv = process.env.NODE_ENV

  // Try to get token
  try {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    })
    debug.tokenFound = !!token
    if (token) {
      debug.tokenEmail = token.email
      debug.tokenRole = token.role
      debug.tokenEmployeId = token.employeId
      debug.tokenId = token.id
    }
  } catch (error) {
    debug.tokenError = error instanceof Error ? error.message : 'Unknown error'
  }

  // Try to connect to DB
  try {
    const { PrismaClient } = await import('@prisma/client')
    const db = new PrismaClient()
    const userCount = await db.user.count()
    debug.dbConnected = true
    debug.userCount = userCount
    await db.$disconnect()
  } catch (error) {
    debug.dbConnected = false
    debug.dbError = error instanceof Error ? error.message : 'Unknown error'
  }

  return NextResponse.json(debug, { status: 200 })
}
