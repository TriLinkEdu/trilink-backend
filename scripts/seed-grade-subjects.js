const { Client } = require('pg');

const DB = 'postgresql://neondb_owner:npg_fa4TZAOhNX5q@ep-green-snow-anmten42-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require&uselibpqcompat=true';

async function main() {
  const client = new Client({ connectionString: DB });
  await client.connect();
  console.log('Connected to Neon DB');

  // Create grade_subjects table if it doesn't exist
  await client.query(`
    CREATE TABLE IF NOT EXISTS grade_subjects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      grade_id UUID NOT NULL REFERENCES grades(id) ON DELETE CASCADE,
      subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT NOW(),
      CONSTRAINT unique_grade_subject UNIQUE(grade_id, subject_id)
    )
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_grade_subjects_grade_id ON grade_subjects(grade_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_grade_subjects_subject_id ON grade_subjects(subject_id)`);
  console.log('grade_subjects table ready');

  // Get all grades
  const grades = await client.query('SELECT id, name FROM grades ORDER BY name');
  console.log('Grades:', grades.rows.map(g => g.name).join(', '));

  // Get all subjects
  const subjects = await client.query('SELECT id, name FROM subjects ORDER BY name');
  console.log('Subjects:', subjects.rows.map(s => s.name).join(', '));

  // Assign all subjects to all grades
  let inserted = 0;
  let skipped = 0;
  for (const grade of grades.rows) {
    for (const subject of subjects.rows) {
      const result = await client.query(
        'INSERT INTO grade_subjects (id, grade_id, subject_id, created_at) VALUES (gen_random_uuid(), $1, $2, NOW()) ON CONFLICT DO NOTHING',
        [grade.id, subject.id]
      );
      if (result.rowCount > 0) {
        inserted++;
        console.log(`  Assigned: ${grade.name} -> ${subject.name}`);
      } else {
        skipped++;
        console.log(`  Already exists: ${grade.name} -> ${subject.name}`);
      }
    }
  }

  console.log(`\nDone: ${inserted} inserted, ${skipped} already existed`);

  // Verify
  const result = await client.query(
    'SELECT g.name as grade, s.name as subject FROM grade_subjects gs JOIN grades g ON g.id=gs.grade_id JOIN subjects s ON s.id=gs.subject_id ORDER BY g.name, s.name'
  );
  console.log('\nFinal grade_subjects:');
  result.rows.forEach(r => console.log(`  ${r.grade} -> ${r.subject}`));

  await client.end();
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
