// lib/models/index.ts
import mongoose, { Schema, Document, Model } from 'mongoose';

// ==========================================
// 1. USER / RIDER MODEL
// ==========================================
export interface IIncidentReport {
    _id?: mongoose.Types.ObjectId;
    reason: string;
    documentUrl?: string;
    filedAt: Date;
    status: 'PENDING_REVIEW' | 'RESOLVED' | 'DISMISSED';
}

export interface IUser extends Document {
    name: string;
    phone: string;
    role: 'ADMIN' | 'RIDER';
    password: string;
    registeredDeviceId?: string;
    status: 'OFFLINE' | 'AVAILABLE' | 'BUSY';
    queuePosition: number;
    declineCount: number;
    isSuspended: boolean;
    incidentReports: Array<IIncidentReport>;
    activeShiftStartTime?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
    {
        name: { type: String, required: true },
        phone: { type: String, required: true, unique: true, index: true },
        role: { type: String, enum: ['ADMIN', 'RIDER'], default: 'RIDER' },
        password: { type: String, required: true },
        registeredDeviceId: { type: String, default: null },
        status: { type: String, enum: ['OFFLINE', 'AVAILABLE', 'BUSY'], default: 'OFFLINE' },
        queuePosition: { type: Number, default: 0 },
        declineCount: { type: Number, default: 0 },
        isSuspended: { type: Boolean, default: false },
        incidentReports: [
            {
                reason: { type: String, required: true },
                documentUrl: { type: String, default: '' },
                filedAt: { type: Date, default: Date.now },
                status: { type: String, enum: ['PENDING_REVIEW', 'RESOLVED', 'DISMISSED'], default: 'PENDING_REVIEW' }
            }
        ],
        activeShiftStartTime: { type: Date, default: null },
    },
    { timestamps: true }
);

// ==========================================
// 2. CUSTOMER MODEL
// ==========================================
export interface ICustomer extends Document {
    phone: string;
    name: string;
    defaultAddress?: string;
    totalOrders: number;
    totalSpent: number;
    lastOrderAt: Date;
    marketingOptIn: boolean;
    optInDate?: Date;
    notes?: string;
}

const CustomerSchema = new Schema<ICustomer>(
    {
        phone: { type: String, required: true, unique: true, index: true },
        name: { type: String, required: true },
        defaultAddress: { type: String, default: '' },
        totalOrders: { type: Number, default: 0 },
        totalSpent: { type: Number, default: 0 },
        lastOrderAt: { type: Date, default: Date.now },
        marketingOptIn: { type: Boolean, default: false },
        optInDate: { type: Date },
        notes: { type: String, default: '' },
    },
    { timestamps: true }
);

// ==========================================
// 3. ORDER MODEL (UPDATED WITH COORDINATES & ROUTE GEOMETRY)
// ==========================================
const CoordinateSchema = new Schema(
    {
        lat: { type: Number, required: true },
        lon: { type: Number, required: true },
    },
    { _id: false }
);

export interface IOrder extends Document {
    orderNumber: string;
    customerId: mongoose.Types.ObjectId;
    customerName: string;
    customerPhone: string;
    pickupAddress: string;
    pickupGmapsUrl: string;
    pickupCoords?: { lat: number; lon: number };
    dropoffAddress: string;
    dropoffGmapsUrl: string;
    dropoffCoords?: { lat: number; lon: number };
    distanceKm: number;
    deliveryFee: number;
    routeGeometry: [number, number][];
    itemDescription?: string;
    status:
    | 'PENDING_ASSIGNMENT'
    | 'OFFERED'
    | 'ACCEPTED'
    | 'ARRIVED_STORE'
    | 'PICKED_UP'
    | 'ARRIVED_DROPOFF'
    | 'DELIVERED'
    | 'CANCELLED'
    | 'ABANDONED'
    | 'UNASSIGNED_ALERT';
    currentRiderId?: mongoose.Types.ObjectId;
    offerExpiresAt?: Date;
    acceptedAt?: Date;
    arrivedStoreAt?: Date;
    pickedUpAt?: Date;
    arrivedDropoffAt?: Date;
    completedAt?: Date;
    totalDeliveryTimeMinutes?: number;
    assignmentHistory: Array<{
        riderId: mongoose.Types.ObjectId;
        action:
        | 'OFFERED'
        | 'ACCEPTED'
        | 'DECLINED'
        | 'TIMEOUT'
        | 'ARRIVED_STORE'
        | 'PICKED_UP'
        | 'ARRIVED_DROPOFF'
        | 'DELIVERED';
        timestamp: Date;
    }>;
}

const OrderSchema = new Schema<IOrder>(
    {
        orderNumber: { type: String, required: true, unique: true },
        customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
        customerName: { type: String, required: true },
        customerPhone: { type: String, required: true },
        pickupAddress: { type: String, required: true },
        pickupGmapsUrl: { type: String, required: true },
        pickupCoords: { type: CoordinateSchema, default: null }, // <-- Added schema definition
        dropoffAddress: { type: String, required: true },
        dropoffGmapsUrl: { type: String, required: true },
        dropoffCoords: { type: CoordinateSchema, default: null }, // <-- Added schema definition
        distanceKm: { type: Number, required: true },
        deliveryFee: { type: Number, required: true },
        routeGeometry: { type: [[Number]], default: [] },
        itemDescription: { type: String, default: '' },
        status: {
            type: String,
            enum: [
                'PENDING_ASSIGNMENT',
                'OFFERED',
                'ACCEPTED',
                'ARRIVED_STORE',
                'PICKED_UP',
                'ARRIVED_DROPOFF',
                'DELIVERED',
                'CANCELLED',
                'UNASSIGNED_ALERT',
                'ABANDONED'
            ],
            default: 'PENDING_ASSIGNMENT',
        },
        currentRiderId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
        offerExpiresAt: { type: Date, default: null },
        acceptedAt: { type: Date, default: null },
        arrivedStoreAt: { type: Date, default: null },
        pickedUpAt: { type: Date, default: null },
        arrivedDropoffAt: { type: Date, default: null },
        completedAt: { type: Date, default: null },
        totalDeliveryTimeMinutes: { type: Number, default: null },
        assignmentHistory: [
            {
                riderId: { type: Schema.Types.ObjectId, ref: 'User' },
                action: {
                    type: String,
                    enum: [
                        'OFFERED',
                        'ACCEPTED',
                        'DECLINED',
                        'TIMEOUT',
                        'ARRIVED_STORE',
                        'PICKED_UP',
                        'ARRIVED_DROPOFF',
                        'DELIVERED'
                    ]
                },
                timestamp: { type: Date, default: Date.now },
            },
        ],
    },
    { timestamps: true }
);

// ==========================================
// 4. SHIFT LOG MODEL
// ==========================================
export interface IShiftLog extends Document {
    riderId: mongoose.Types.ObjectId;
    date: string;
    activeMinutes: number;
    inactiveMinutes: number;
    deliveriesCompleted: number;
    sessions: Array<{
        startTime: Date;
        endTime?: Date;
        durationMinutes?: number;
    }>;
}

const ShiftLogSchema = new Schema<IShiftLog>(
    {
        riderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        date: { type: String, required: true, index: true },
        activeMinutes: { type: Number, default: 0 },
        inactiveMinutes: { type: Number, default: 0 },
        deliveriesCompleted: { type: Number, default: 0 },
        sessions: [
            {
                startTime: { type: Date, required: true },
                endTime: { type: Date },
                durationMinutes: { type: Number, default: 0 },
            },
        ],
    },
    { timestamps: true }
);

export const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
export const Customer: Model<ICustomer> = mongoose.models.Customer || mongoose.model<ICustomer>('Customer', CustomerSchema);
export const Order: Model<IOrder> = mongoose.models.Order || mongoose.model<IOrder>('Order', OrderSchema);
export const ShiftLog: Model<IShiftLog> = mongoose.models.ShiftLog || mongoose.model<IShiftLog>('ShiftLog', ShiftLogSchema);