import { PrismaPg } from '@prisma/adapter-pg';

import { env } from '../src/config/env.js';
import { PrismaClient } from '../src/generated/prisma/client.js';

// Standalone client, not the app's cached singleton — this script runs
// once via the Prisma CLI, outside the running application.
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) });

async function main(): Promise<void> {
  // claude.md §96: admins are provisioned directly (seed script or manual
  // DB insert), never via public self-registration.
  const admin = await prisma.user.upsert({
    where: { email: 'admin@rydex.local' },
    update: {},
    create: {
      email: 'admin@rydex.local',
      phone: '+910000000000',
      name: 'Rydex Admin',
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });

  console.log(`Seeded admin user: ${admin.email} (${admin.id})`);
}

main()
  .catch((err: unknown) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
