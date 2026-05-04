import { NextResponse } from 'next/server';
import { db, ensureDbInitialized } from '@/lib/db';

export async function GET() {
  try {
    await ensureDbInitialized();
    
    const count = await db.prospect.count();
    
    return NextResponse.json({ 
      success: true, 
      prospectCount: count,
      dbUrl: process.env.DATABASE_URL,
    });
  } catch (error: any) {
    return NextResponse.json({ 
      success: false, 
      error: error?.message || String(error),
      code: error?.code,
      meta: error?.meta,
      dbUrl: process.env.DATABASE_URL,
    }, { status: 500 });
  }
}
