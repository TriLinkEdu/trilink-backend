import 'dotenv/config';
import { DataSource } from 'typeorm';
import { getPostgresConnectionFromEnv } from '../database/postgres-env';
import { TYPEORM_ENTITIES } from '../database/typeorm-entities';

async function test() {
  const config = {
    type: 'postgres' as const,
    ...getPostgresConnectionFromEnv(),
    entities: TYPEORM_ENTITIES,
    synchronize: false,
  };

  const dataSource = new DataSource(config);
  await dataSource.initialize();

  try {
    // Get all teachers
    const teachers = await dataSource.query(
      `SELECT id, email, role FROM users WHERE role = 'teacher' ORDER BY email`
    );
    console.log(`Found ${teachers.length} teachers`);

    // Get all class offerings with their teachers
    const classOfferings = await dataSource.query(
      `SELECT co.id, co.teacher_id, u.email as teacher_email
       FROM class_offerings co
       LEFT JOIN users u ON u.id = co.teacher_id
       WHERE co.teacher_id IS NOT NULL
       ORDER BY co.id`
    );
    console.log(`Found ${classOfferings.length} class offerings with teachers`);

    // Find mismatched grade entries
    const mismatched = await dataSource.query(
      `SELECT ge.id as entry_id, ge.teacher_id as entry_teacher, ge.class_offering_id as co_id,
              ge.title, co.teacher_id as co_teacher,
              et.email as entry_teacher_email, ct.email as co_teacher_email
       FROM grade_entries ge
       JOIN class_offerings co ON co.id = ge.class_offering_id
       LEFT JOIN users et ON et.id = ge.teacher_id
       LEFT JOIN users ct ON ct.id = co.teacher_id
       WHERE ge.teacher_id != co.teacher_id`
    );
    console.log(`\nFound ${mismatched.length} grade entries with teacher/class mismatch`);

    for (const m of mismatched) {
      console.log(`  Entry ${m.entry_id} "${m.title}"`);
      console.log(`    Entry teacher: ${m.entry_teacher} (${m.entry_teacher_email})`);
      console.log(`    Class teacher: ${m.co_teacher} (${m.co_teacher_email})`);
    }

    // Simulate permission check for each teacher on each class
    console.log('\n--- Simulating permission checks ---');
    for (const teacher of teachers.slice(0, 2)) {
      console.log(`\nTeacher: ${teacher.email} (${teacher.id})`);
      const ownedClasses = classOfferings.filter((co: any) => co.teacher_id === teacher.id);
      console.log(`  Owns ${ownedClasses.length} classes`);

      for (const co of ownedClasses.slice(0, 2)) {
        const entries = await dataSource.query(
          `SELECT id, teacher_id, title FROM grade_entries WHERE class_offering_id = $1`,
          [co.id]
        );
        console.log(`  Class ${co.id}: ${entries.length} entries`);
        for (const entry of entries.slice(0, 3)) {
          const isOwner = entry.teacher_id === teacher.id;
          console.log(`    Entry "${entry.title}": creator=${isOwner ? 'YES' : 'NO (other)'}`);
        }
      }
    }
  } finally {
    await dataSource.destroy();
  }
}

test().catch((err) => {
  console.error(err);
  process.exit(1);
});
