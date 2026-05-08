#!/usr/bin/env ts-node
/**
 * migrate-gamification-profiles.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * One-time data migration: seeds the new `gamification_profiles` table from
 * the historical `user_badges` audit log.
 *
 * Run once after deploying the GamificationProfile entity migration:
 *
 *   npx ts-node src/scripts/migrate-gamification-profiles.ts
 *
 * Safe to run multiple times — uses INSERT ... ON CONFLICT DO UPDATE.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import 'dotenv/config';
import { createConnection } from 'typeorm';
import * as path from 'path';

async function main() {
  console.log('🚀 Connecting to database...');

  const conn = await createConnection({
    type   : 'postgres',
    url    : process.env.DATABASE_URL,
    ssl    : process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    entities: [path.join(__dirname, '/../**/*.entity.{ts,js}')],
    synchronize: false,
    logging    : false,
  });

  console.log('✅ Connected.\n');

  const XP_PER_LEVEL = 100;

  console.log('📊 Calculating historical XP totals from user_badges...');
  const rows: Array<{ user_id: string; total_xp: string }> = await conn.query(`
    SELECT
      ub.user_id,
      COALESCE(SUM(ub.points_earned), 0) AS total_xp
    FROM user_badges ub
    INNER JOIN users u ON u.id = ub.user_id
    WHERE u.role = 'student'
    GROUP BY ub.user_id
  `);

  console.log(`  Found ${rows.length} student(s) with badge points.\n`);

  let upserted = 0;
  let skipped  = 0;

  for (const row of rows) {
    const totalXp = parseInt(row.total_xp, 10) || 0;
    const level   = Math.max(1, Math.floor(totalXp / XP_PER_LEVEL));

    try {
      await conn.query(`
        INSERT INTO gamification_profiles (user_id, total_xp, level, grade, section, created_at, updated_at)
        SELECT
          u.id,
          $1::int   AS total_xp,
          $2::int   AS level,
          u.grade,
          u.section,
          NOW(),
          NOW()
        FROM users u
        WHERE u.id = $3
        ON CONFLICT (user_id) DO UPDATE
          SET total_xp   = EXCLUDED.total_xp,
              level      = EXCLUDED.level,
              updated_at = NOW()
      `, [totalXp, level, row.user_id]);
      upserted++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`  ⚠️  Failed for user ${row.user_id}: ${msg}`);
      skipped++;
    }
  }

  console.log(`✅ Migration complete:`);
  console.log(`   Upserted : ${upserted}`);
  console.log(`   Skipped  : ${skipped}`);

  // Also seed empty profiles for students with zero XP so they appear in leaderboards
  console.log('\n📊 Seeding profiles for students with no badge activity...');
  const { count: seeded } = await conn.query(`
    INSERT INTO gamification_profiles (user_id, total_xp, level, grade, section, created_at, updated_at)
    SELECT u.id, 0, 1, u.grade, u.section, NOW(), NOW()
    FROM   users u
    WHERE  u.role = 'student'
    AND    NOT EXISTS (
      SELECT 1 FROM gamification_profiles gp WHERE gp.user_id = u.id
    )
    ON CONFLICT (user_id) DO NOTHING
    RETURNING *
  `).then((r: unknown[]) => ({ count: r.length }));

  console.log(`   Seeded ${seeded} additional student profile(s).\n`);

  await conn.close();
  console.log('🎉 Done. gamification_profiles is fully populated.');
}

main().catch((err) => {
  console.error('💥 Migration failed:', err);
  process.exit(1);
});
