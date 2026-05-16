import 'dotenv/config';
import { DataSource } from 'typeorm';
import { getPostgresConnectionFromEnv } from '../database/postgres-env';
import { TYPEORM_ENTITIES } from '../database/typeorm-entities';

async function backfill() {
  const config = {
    type: 'postgres' as const,
    ...getPostgresConnectionFromEnv(),
    entities: TYPEORM_ENTITIES,
    synchronize: false,
  };

  const dataSource = new DataSource(config);
  await dataSource.initialize();

  const activeYear = await dataSource.query(
    `SELECT id FROM academic_years WHERE is_active = true ORDER BY start_date DESC LIMIT 1`
  );
  if (!activeYear.length) {
    console.error('No active academic year');
    process.exit(1);
  }
  const yearId = activeYear[0].id;

  const students = await dataSource.query(
    `SELECT u.id, u.grade, u.section
     FROM users u
     WHERE u.role = 'student'
       AND u.grade IS NOT NULL
       AND u.section IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM enrollments e WHERE e.student_id = u.id
       )
     ORDER BY u.grade, u.section`
  );

  console.log(`Found ${students.length} students with no enrollments`);

  let totalEnrolled = 0;
  for (const student of students) {
    const offerings = await dataSource.query(
      `SELECT co.id
       FROM class_offerings co
       JOIN grades g ON g.id = co.grade_id
       JOIN sections s ON s.id = co.section_id
       WHERE g.name = $1 AND s.name = $2 AND co.academic_year_id = $3`,
      [student.grade, student.section, yearId]
    );

    for (const co of offerings) {
      await dataSource.query(
        `INSERT INTO enrollments (student_id, class_offering_id, academic_year_id, status, created_at, updated_at)
         VALUES ($1, $2, $3, 'active', now(), now())
         ON CONFLICT DO NOTHING`,
        [student.id, co.id, yearId]
      );
      totalEnrolled++;
    }
    console.log(`Enrolled ${student.grade} ${student.section} student in ${offerings.length} classes`);
  }

  console.log(`\nDone: ${students.length} students backfilled, ${totalEnrolled} enrollments created`);
  await dataSource.destroy();
  process.exit(0);
}

backfill().catch((err) => {
  console.error(err);
  process.exit(1);
});
