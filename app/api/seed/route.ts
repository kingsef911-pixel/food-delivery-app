// app/api/seed/route.ts
import { NextResponse } from 'next/server';
import { seedDatabase } from '@/scripts/seed'; // adjust import path as needed

export async function GET() {
  try {
    await seedDatabase();
    return NextResponse.json({ success: true, message: 'Seeding completed successfully!' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}