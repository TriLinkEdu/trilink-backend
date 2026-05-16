import 'dotenv/config';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { getPostgresConnectionFromEnv } from '../database/postgres-env';
import { TYPEORM_ENTITIES } from '../database/typeorm-entities';
import { User, UserRole } from '../modules/users/entities/user.entity';

const teacherNames = [
  { first: 'Alemayehu', last: 'Tadesse' },
  { first: 'Birtukan', last: 'Kebede' },
  { first: 'Desta', last: 'Mekonnen' },
];

interface StudentRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  grade: string;
  section: string;
}

interface ClassOfferingRow {
  id: string;
  grade_name: string;
  section_name: string;
  subject_name: string;
}

async function seed() {
  const config = {
    type: 'postgres' as const,
    ...getPostgresConnectionFromEnv(),
    entities: TYPEORM_ENTITIES,
    synchronize: false,
  };

  const dataSource = new DataSource(config);
  await dataSource.initialize();

  const passwordHash = await bcrypt.hash('Teacher@123', 10);
  const parentPasswordHash = await bcrypt.hash('Parent@123', 10);

  // ── 1. Create 3 teachers ───────────────────────────────────────
  const teachers: User[] = [];
  for (let i = 0; i < teacherNames.length; i++) {
    const t = teacherNames[i];
    const email = `${t.first.toLowerCase()}.${t.last.toLowerCase()}@trilink.edu`;

    let teacher = await dataSource.getRepository(User).findOne({ where: { email } });
    if (!teacher) {
      teacher = await dataSource.getRepository(User).save(
        dataSource.getRepository(User).create({
          email,
          passwordHash,
          role: UserRole.TEACHER,
          firstName: t.first,
          lastName: t.last,
          mustChangePassword: false,
        })
      );
      console.log(`Created teacher: ${email}`);
    } else {
      console.log(`Teacher exists: ${email}`);
    }
    teachers.push(teacher);
  }

  // ── 2. Assign teachers to class offerings (grades 10-12) ───────
  const classOfferings: ClassOfferingRow[] = await dataSource.query(
    `SELECT co.id, g.name AS grade_name, s.name AS section_name, sub.name AS subject_name
     FROM class_offerings co
     JOIN grades g ON co.grade_id = g.id
     JOIN sections s ON co.section_id = s.id
     LEFT JOIN subjects sub ON co.subject_id = sub.id
     WHERE g.order_index >= 10
     ORDER BY g.order_index, s.name, sub.name`
  );

  const subjectOrder = [...new Set(classOfferings.map((co) => co.subject_name).filter((s): s is string => !!s))];
  const subjectToTeacher: Record<string, number> = {};
  subjectOrder.forEach((sub, idx) => { subjectToTeacher[sub] = idx % teachers.length; });

  for (const co of classOfferings) {
    const ti = subjectToTeacher[co.subject_name] ?? 0;
    await dataSource.query(`UPDATE class_offerings SET teacher_id = $1 WHERE id = $2`, [teachers[ti].id, co.id]);
  }
  console.log(`Assigned teachers to ${classOfferings.length} class offerings (grades 10-12)`);

  // ── 3. Get all existing students ────────────────────────────────
  const students: StudentRow[] = await dataSource.query(
    `SELECT id, first_name, last_name, email, grade, section FROM users WHERE role = 'student' ORDER BY grade, section, first_name`
  );
  console.log(`Found ${students.length} existing students`);

  // ── 4. Create parents & parent-student links ───────────────────
  const parentFirst = ['Abebe','Hanna','Dawit','Meron','Yonas','Selam','Bereket','Tigist','Kaleb','Eden','Natan','Liya','Samuel','Rahel','Daniel','Milkessa','Fatuma','Tewodros','Hiwot','Ephrem','Aster','Gemechu','Beza','Solomon','Kidist','Mulugeta','Yemsrach','Biruk','Sosena','Amanuel','Eyerusalem','Fikadu','Meheret','Nebiyu','Tsehay','Abel','Winta','Yared','Hirut','Kassahun','Mahlet','Dereje','Bethel','Girma','Segen','Adane','Rediet','Temesgen','Mihret','Ashenafi','Tsion','Behailu','Helen','Getachew','Sinkinesh','Kibrom','Wubit','Zelalem','Amsale','Chala','Firehiwot','Henok','Meskerem','Teferi','Serkalem','Wondimu','Birtukan','Ermias','Genet','Haile','Tigist','Tadesse','Alem','Desta','Fekadu','Habtamu','Kebede','Mekdes','Nardos','Shiferaw','Tigabu','Worku','Abeba','Banchi','Demeke','Fenta','Gizachew','Hailu','Iskinder','Jember','Kassa','Lemma','Mengistu','Nega','Oljira','Petros','Qelemu','Robe','Sisay','Tilahun','Wallelign','Yilma','Zewdu','Abreham','Belay'];
  const parentLast = ['Kebede','Tadesse','Bekele','Alemu','Mekonnen','Getachew','Asfaw','Demeke','Girma','Hailu','Lemma','Desta','Abebe','Ayele','Wolde','Birhanu','Yohannes','Tessema','Mamo','Shibru','Teshome','Fekadu','Negash','Benti','Wondimu','Kassa','Habte','Worku','Teka','Mulu','Kifle','Gidey','Arega','Welde','Bogale','Adane','Mekuria','Tiruneh','Belay','Beyene','Berhe','Sisay','Eshete','Gebru'];

  let parentsCreated = 0;
  let linksCreated = 0;
  const usedParentEmails = new Set<string>();

  for (let i = 0; i < students.length; i++) {
    const student = students[i];
    let parentId: string;
    let shareParent = i > 0 && Math.random() < 0.25;

    if (shareParent) {
      const prevStudent = students[i - 1];
      const prevLink = await dataSource.query(
        `SELECT parent_id FROM parent_students WHERE student_id = $1 LIMIT 1`, [prevStudent.id]
      );
      if (prevLink.length) {
        parentId = prevLink[0].parent_id;
        console.log(`Sharing parent for ${student.first_name} (sibling with ${prevStudent.first_name})`);
      } else {
        shareParent = false;
      }
    }

    if (!shareParent) {
      const pfn = parentFirst[Math.floor(Math.random() * parentFirst.length)];
      const pln = parentLast[Math.floor(Math.random() * parentLast.length)];
      let pemail = `${pfn.toLowerCase()}.${pln.toLowerCase()}${Math.floor(Math.random()*900+100)}@parent.trilink.edu`;
      while (usedParentEmails.has(pemail)) {
        pemail = `${pfn.toLowerCase()}.${pln.toLowerCase()}${Math.floor(Math.random()*900+100)}@parent.trilink.edu`;
      }
      usedParentEmails.add(pemail);

      const parent = await dataSource.getRepository(User).save(
        dataSource.getRepository(User).create({
          email: pemail,
          passwordHash: parentPasswordHash,
          role: UserRole.PARENT,
          firstName: pfn,
          lastName: pln,
          mustChangePassword: false,
        })
      );
      parentId = parent.id;
      parentsCreated++;
      console.log(`Created parent ${parentsCreated}: ${pemail} for ${student.first_name}`);
    } else {
      // Already set parentId above
      parentId = parentId!;
    }

    await dataSource.query(
      `INSERT INTO parent_students (parent_id, student_id, relation, is_primary, created_at, updated_at)
       VALUES ($1, $2, 'Guardian', true, now(), now())
       ON CONFLICT DO NOTHING`,
      [parentId, student.id]
    );
    linksCreated++;
  }

  const multiParentCount = await dataSource.query(
    `SELECT COUNT(*) FROM (SELECT parent_id FROM parent_students GROUP BY parent_id HAVING COUNT(*) > 1) t`
  );

  console.log(`\nDone:`);
  console.log(`  ${teachers.length} teachers created/verified`);
  console.log(`  ${parentsCreated} parents created`);
  console.log(`  ${linksCreated} parent-student links created`);
  console.log(`  ${multiParentCount[0].count} parents have multiple children`);

  await dataSource.destroy();
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
