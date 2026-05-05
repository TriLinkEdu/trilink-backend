const { Client } = require('pg');

const DB = 'postgresql://neondb_owner:npg_fa4TZAOhNX5q@ep-green-snow-anmten42-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require&uselibpqcompat=true';

async function main() {
  const client = new Client({ connectionString: DB });
  await client.connect();
  console.log('Connected to Neon DB');

  // Get all grades
  const grades = await client.query('SELECT id, name FROM grades ORDER BY name');
  console.log('Grades found:', grades.rows.map(g => g.name).join(', '));

  // Get section A and B ids
  const sections = await client.query("SELECT id, name FROM sections WHERE name IN ('A','B') ORDER BY name");
  console.log('Sections A/B found:', sections.rows.map(s => `${s.name}:${s.id}`).join(', '));

  if (sections.rows.length === 0) {
    console.log('ERROR: No sections A or B found in database!');
    await client.end();
    return;
  }

  // For each grade, assign A and B if not already assigned
  let inserted = 0;
  let skipped = 0;
  for (const grade of grades.rows) {
    for (const section of sections.rows) {
      const result = await client.query(
        'INSERT INTO grade_sections (id, grade_id, section_id, created_at) VALUES (gen_random_uuid(), $1, $2, NOW()) ON CONFLICT DO NOTHING',
        [grade.id, section.id]
      );
      if (result.rowCount > 0) {
        inserted++;
        console.log(`  Assigned: ${grade.name} -> Section ${section.name}`);
      } else {
        skipped++;
        console.log(`  Already exists: ${grade.name} -> Section ${section.name}`);
      }
    }
  }

  console.log(`\nDone: ${inserted} inserted, ${skipped} already existed`);

  // Verify final state
  const result = await client.query(
    'SELECT g.name as grade, s.name as section FROM grade_sections gs JOIN grades g ON g.id=gs.grade_id JOIN sections s ON s.id=gs.section_id ORDER BY g.name, s.name'
  );
  console.log('\nFinal grade_sections:');
  result.rows.forEach(r => console.log(`  ${r.grade} -> Section ${r.section}`));

  await client.end();
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
