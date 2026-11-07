import { connectToDatabase } from '@/lib/db';
import { User } from '@/lib/models';

export async function seedDatabase() {
  await connectToDatabase();

  // Clear or upsert default accounts
  const usersToSeed = [
    {
      name: 'Super Admin',
      email: 'admin@fooddelivery.com',
      phone: '09170000000',
      password: 'adminpassword123', // In production, hash this with bcrypt!
      role: 'ADMIN',
      status: 'AVAILABLE',
      queuePosition: 0,
    },
    {
      name: 'Juan Dela Cruz',
      email: 'rider1@fooddelivery.com',
      phone: '09170000001',
      password: 'riderpassword123',
      role: 'RIDER',
      status: 'AVAILABLE',
      queuePosition: 1,
    },
    {
      name: 'Pedro Penduko',
      email: 'rider2@fooddelivery.com',
      phone: '09170000002',
      password: 'riderpassword123',
      role: 'RIDER',
      status: 'AVAILABLE',
      queuePosition: 2,
    },
    {
      name: 'Maria Clara',
      email: 'rider3@fooddelivery.com',
      phone: '09170000003',
      password: 'riderpassword123',
      role: 'RIDER',
      status: 'AVAILABLE',
      queuePosition: 3,
    },
  ];

  for (const userData of usersToSeed) {
    await User.findOneAndUpdate(
      { phone: userData.phone },
      userData,
      { upsert: true, new: true }
    );
  }

  console.log('Database seeded successfully with Admin and Riders!');
}