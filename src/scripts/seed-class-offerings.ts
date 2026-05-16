import 'dotenv/config';
import { DataSource } from 'typeorm';
import { getPostgresConnectionFromEnv } from '../database/postgres-env';
import { TYPEORM_ENTITIES } from '../database/typeorm-entities';

async function seed() {
  const config = {
    type: 'postgres' as const,
    ...getPostgresConnectionFromEnv(),
    entities: TYPEORM_ENTITIES,
    synchronize: false,
  };

  const dataSource = new DataSource(config);
  await dataSource.initialize();

  const subjects = await dataSource.query(`SELECT id, name FROM subjects ORDER BY name`);
  const activeYear = await dataSource.query(
    `SELECT id FROM academic_years WHERE is_active = true ORDER BY start_date DESC LIMIT 1`
  );
  if (!activeYear.length) {
    console.error('No active academic year');
    process.exit(1);
  }
  const yearId = activeYear[0].id;

  const gradeSections = await dataSource.query(
    `SELECT g.id AS grade_id, s.id AS section_id, g.name AS grade_name, s.name AS section_name
     FROM grades g
     JOIN grade_sections gs ON gs.grade_id = g.id
     JOIN sections s ON s.id = gs.section_id
     WHERE g.order_index >= 10
     ORDER BY g.order_index, s.name`
  );

  const existing = await dataSource.query(
    `SELECT co.grade_id, co.section_id, COUNT(co.id) AS cnt
     FROM class_offerings co
     JOIN grades g ON g.id = co.grade_id
     WHERE g.order_index >= 10
     GROUP BY co.grade_id, co.section_id`
  );

  const existingMap = new Set(existing.map((r: any) => `${r.grade_id}-${r.section_id}`));

  let created = 0;
  for (const gs of gradeSections) {
    if (existingMap.has(`${gs.grade_id}-${gs.section_id}`)) {
      console.log(`Skip existing: ${gs.grade_name} ${gs.section_name}`);
      continue;
    }
    for (const sub of subjects) {
      await dataSource.query(
        `INSERT INTO class_offerings (academic_year_id, grade_id, section_id, subject_id, name, course_code, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, now(), now())
         ON CONFLICT DO NOTHING`,
        [yearId, gs.grade_id, gs.section_id, sub.id, `${gs.grade_name} ${gs.section_name} ${sub.name}`, `${sub.name.slice(0,3).toUpperCase()}-${gs.grade_name.replace(/\D/g,'')}${gs.section_name}`]
      );
      created++;
    }
    console.log(`Created ${subjects.length} classes for ${gs.grade_name} ${gs.section_name}`);
  }

  console.log(`\nDone: ${created} class offerings created for grades 10-12`);
  await dataSource.destroy();
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
