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

  const teachers = await dataSource.query(`SELECT id, email FROM users WHERE role = 'teacher' ORDER BY email`);
  if (!teachers.length) {
    console.error('No teachers found');
    process.exit(1);
  }

  const classOfferings = await dataSource.query(
    `SELECT co.id, sub.name AS subject_name
     FROM class_offerings co
     LEFT JOIN subjects sub ON sub.id = co.subject_id
     ORDER BY co.grade_id, co.section_id, sub.name`
  );

  const subjectOrder = [...new Set(classOfferings.map((co: any) => co.subject_name).filter((s: string) => s))];
  const subjectToTeacher: Record<string, number> = {};
  subjectOrder.forEach((sub: string, idx: number) => { subjectToTeacher[sub] = idx % teachers.length; });

  let updated = 0;
  for (const co of classOfferings) {
    const ti = subjectToTeacher[co.subject_name] ?? 0;
    await dataSource.query(`UPDATE class_offerings SET teacher_id = $1 WHERE id = $2`, [teachers[ti].id, co.id]);
    updated++;
  }

  console.log(`Assigned teachers to ${updated} class offerings across all grades`);
  await dataSource.destroy();
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
