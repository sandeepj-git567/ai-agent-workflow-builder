import { runMigrations } from './migrate';
import { inMemoryDb } from './index';

async function seed() {
  console.log('[Seed] Seeding databases...');
  await runMigrations();
  inMemoryDb.reset();
  console.log('[Seed] Database seeded with Org A and Org B accounts.');
}

if (require.main === module) {
  seed();
}

export { seed };
