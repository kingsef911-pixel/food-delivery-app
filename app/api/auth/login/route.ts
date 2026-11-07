// app/api/auth/login/route.ts
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { User } from '@/lib/models';
import { logEvent } from '@/lib/utils/logger';

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const { emailOrPhone, password } = await request.json();

    if (!emailOrPhone || !password) {
      return NextResponse.json({ success: false, error: 'Please provide credentials and password.' }, { status: 400 });
    }

    // Find user by email or phone number
    const user = await User.findOne({
      $or: [{ email: emailOrPhone }, { phone: emailOrPhone }, { name: emailOrPhone }]
    });

    if (!user || user.password !== password) { // Note: use bcrypt.compare in production
      // Optional: Log failed login attempts for security monitoring
      await logEvent({
        userRole: 'GUEST',
        action: 'LOGIN_FAILED',
        details: { attemptedCredential: emailOrPhone, reason: 'Invalid credentials' },
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      });

      return NextResponse.json({ success: false, error: 'Invalid credentials.' }, { status: 401 });
    }

    if (user.isSuspended) {
      return NextResponse.json({ success: false, error: 'Account is suspended. Contact admin.' }, { status: 403 });
    }

    // LOG SUCCESSFUL LOGIN EVENT
    await logEvent({
      userId: user._id.toString(),
      userRole: user.role,
      action: 'USER_LOGIN',
      details: { phone: user.phone, name: user.name },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
    });

    // Return user session payload (In production, sign a secure HTTP-only JWT cookie here)
    const response = NextResponse.json({
      success: true,
      message: 'Logged in successfully',
      user: {
        id: user._id,
        name: user.name,
        role: user.role, // 'ADMIN' or 'RIDER'
      }
    });

    // Set a basic session cookie
    response.cookies.set({
      name: 'session_user_id',
      value: user._id.toString(),
      httpOnly: true,
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 1 week
    });

    return response;
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}