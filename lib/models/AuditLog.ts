// lib/models/AuditLog.ts
import mongoose, { Schema, model, models } from 'mongoose';

const AuditLogSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: false },
  userRole: { type: String, enum: ['ADMIN', 'RIDER', 'SYSTEM', 'GUEST'], default: 'SYSTEM' },
  action: { type: String, required: true }, // e.g., 'LOGIN', 'ORDER_CREATED', 'STATUS_UPDATE', 'LOGOUT'
  targetId: { type: Schema.Types.ObjectId, required: false }, // e.g., Order ID or Rider ID affected
  details: { type: Schema.Types.Mixed, required: false }, // JSON payload with metadata (ip, changes, etc.)
  ipAddress: { type: String, required: false },
  timestamp: { type: Date, default: Date.now },
});

// Index for high-performance log querying by date or user
AuditLogSchema.index({ timestamp: -1 });
AuditLogSchema.index({ action: 1 });

export const AuditLog = models.AuditLog || model('AuditLog', AuditLogSchema);