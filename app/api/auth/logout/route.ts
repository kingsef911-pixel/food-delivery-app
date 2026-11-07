// app/api/auth/logout/route.ts
import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true, message: 'Logged out successfully' });
  
  // Clear session cookie
  response.cookies.set({
    name: 'session_user_id',
    value: '',
    httpOnly: true,
    path: '/',
    maxAge: 0,
  });

  return response;
}