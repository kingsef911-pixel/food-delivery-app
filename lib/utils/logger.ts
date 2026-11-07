// lib/utils/logger.ts
import { connectToDatabase } from '@/lib/db';
import mongoose from 'mongoose';

interface LogOptions {
  userId?: string;
  userRole?: 'ADMIN' | 'RIDER' | 'SYSTEM' | 'GUEST';
  action: string;
  targetId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
}

/**
 * Centralized audit logger for LocalFleet
 */
export async function logEvent(options: LogOptions) {
  try {
    // Console log for immediate server debugging
    console.log(`[AUDIT] [${options.action}] Role: ${options.userRole || 'SYSTEM'} | User: ${options.userId || 'N/A'}`, options.details || '');

    // Connect and save to DB asynchronously (non-blocking if desired, or awaited)
    await connectToDatabase();
    const AuditLog = mongoose.models.AuditLog;
    if (!AuditLog) {
      throw new Error('AuditLog model is not registered');
    }
    await AuditLog.create({
      userId: options.userId || undefined,
      userRole: options.userRole || 'SYSTEM',
      action: options.action,
      targetId: options.targetId || undefined,
      details: options.details || {},
      ipAddress: options.ipAddress || 'unknown',
    });
  } catch (error) {
    // Fail-safe: Never crash the user request if logging fails
    console.error('Failed to write audit log to database:', error);
  }
}