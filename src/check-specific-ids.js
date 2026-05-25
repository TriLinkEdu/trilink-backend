
const { Client } = require('pg');

async function check() {
  const client = new Client({
    connectionString: "postgresql://neondb_owner:npg_NXEgOI1f5mMw@ep-withered-grass-ap4yif3c-pooler.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require",
  });

  try {
    await client.connect();
    console.log('--- CHECKING SPECIFIC IDS ---');

    const studentId = 'd58a5af8-2179-4402-9e87-e43964209cca';
    const subjectId = '5ebaf94c-2d0e-44ba-99e5-e99857345833';

    const resStudent = await client.query('SELECT id, first_name, last_name FROM users WHERE id = $1', [studentId]);
    console.log('Student:', resStudent.rows);

    const resSubject = await client.query('SELECT id, name FROM subjects WHERE id = $1', [subjectId]);
    console.log('Subject:', resSubject.rows);

    const resGrades = await client.query(`
      SELECT ge.id, ge.title, ge.score, ge.max_score, co.subject_id
      FROM grade_entries ge
      JOIN class_offerings co ON ge.class_offering_id = co.id
      WHERE ge.student_id = $1
    `, [studentId]);
    console.log(`Grades for student (all subjects): ${resGrades.rows.length}`);
    console.log('Unique subject IDs for student grades:', [...new Set(resGrades.rows.map(r => r.subject_id))]);

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

check();
