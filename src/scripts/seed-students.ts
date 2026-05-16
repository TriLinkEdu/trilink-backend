import 'dotenv/config';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { getPostgresConnectionFromEnv } from '../database/postgres-env';
import { TYPEORM_ENTITIES } from '../database/typeorm-entities';
import { User, UserRole } from '../modules/users/entities/user.entity';

const firstNames = [
  'Abebe', 'Hanna', 'Dawit', 'Meron', 'Yonas',
  'Selam', 'Bereket', 'Tigist', 'Kaleb', 'Eden',
  'Natan', 'Liya', 'Samuel', 'Rahel', 'Daniel',
  'Milkessa', 'Fatuma', 'Tewodros', 'Hiwot', 'Ephrem',
  'Aster', 'Gemechu', 'Beza', 'Solomon', 'Kidist',
  'Mulugeta', 'Yemsrach', 'Biruk', 'Sosena', 'Amanuel',
  'Eyerusalem', 'Fikadu', 'Meheret', 'Nebiyu', 'Tsehay',
  'Abel', 'Winta', 'Yared', 'Hirut', 'Kassahun',
  'Mahlet', 'Dereje', 'Bethel', 'Girma', 'Segen',
  'Adane', 'Rediet', 'Temesgen', 'Mihret', 'Ashenafi',
  'Tsion', 'Behailu', 'Helen', 'Getachew', 'Sinkinesh',
  'Kibrom', 'Wubit', 'Zelalem', 'Amsale', 'Chala',
  'Firehiwot', 'Henok', 'Meskerem', 'Teferi', 'Serkalem',
  'Wondimu', 'Birtukan', 'Ermias', 'Genet', 'Haile',
  'Tigist', 'Tadesse', 'Alem', 'Desta', 'Fekadu',
  'Habtamu', 'Kebede', 'Mekdes', 'Nardos', 'Shiferaw',
  'Tigabu', 'Worku', 'Abeba', 'Banchi', 'Demeke',
  'Fenta', 'Gizachew', 'Hailu', 'Iskinder', 'Jember',
  'Kassa', 'Lemma', 'Mengistu', 'Nega', 'Oljira',
  'Petros', 'Qelemu', 'Robe', 'Sisay', 'Tilahun',
  'Wallelign', 'Yilma', 'Zewdu', 'Abreham', 'Belay',
];

const lastNames = [
  'Kebede', 'Tadesse', 'Bekele', 'Alemu', 'Mekonnen',
  'Getachew', 'Asfaw', 'Demeke', 'Girma', 'Hailu',
  'Lemma', 'Desta', 'Abebe', 'Ayele', 'Wolde',
  'Birhanu', 'Yohannes', 'Tessema', 'Mamo', 'Shibru',
  'Teshome', 'Fekadu', 'Negash', 'Benti', 'Wondimu',
  'Kassa', 'Habte', 'Worku', 'Teka', 'Mulu',
  'Kifle', 'Gidey', 'Arega', 'Welde', 'Bogale',
  'Adane', 'Mekuria', 'Tiruneh', 'Belay', 'Beyene',
  'Berhe', 'Sisay', 'Eshete', 'Gebru', 'Haile',
  'Tafesse', 'Aberra', 'Boru', 'Fufa', 'Gashaw',
  'Jember', 'Kassa', 'Lemma', 'Mekonnen', 'Nega',
  'Oljira', 'Petros', 'Qelemu', 'Robe', 'Sisay',
  'Tilahun', 'Wallelign', 'Yilma', 'Zewdu', 'Abreham',
  'Belay', 'Benti', 'Demeke', 'Eshete', 'Fekadu',
  'Girma', 'Habte', 'Jember', 'Kassa', 'Lemma',
  'Mamo', 'Negash', 'Oljira', 'Petros', 'Qelemu',
  'Robe', 'Sisay', 'Tilahun', 'Wallelign', 'Yilma',
  'Zewdu', 'Abreham', 'Belay', 'Benti', 'Demeke',
  'Eshete', 'Fekadu', 'Girma', 'Habte', 'Jember',
];

async function seed() {
  const config = {
    type: 'postgres' as const,
    ...getPostgresConnectionFromEnv(),
    entities: TYPEORM_ENTITIES,
    synchronize: false,
  };

  const dataSource = new DataSource(config);
  await dataSource.initialize();

  const academicYear = await dataSource.query(
    `SELECT id FROM academic_years WHERE is_active = true ORDER BY start_date DESC LIMIT 1`
  );
  if (!academicYear.length) {
    console.error('No active academic year found');
    process.exit(1);
  }
  const academicYearId = academicYear[0].id;

  const gradeSections = await dataSource.query(
    `SELECT g.id AS grade_id, s.id AS section_id, g.name AS grade_name, s.name AS section_name
     FROM grades g
     JOIN grade_sections gs ON gs.grade_id = g.id
     JOIN sections s ON gs.section_id = s.id
     ORDER BY g.order_index, s.name`
  );

  const classOfferings = await dataSource.query(
    `SELECT id, grade_id, section_id FROM class_offerings WHERE academic_year_id = $1`,
    [academicYearId]
  );

  const userRepo = dataSource.getRepository(User);
  const passwordHash = await bcrypt.hash('Student@123', 10);

  let totalCreated = 0;
  let totalEnrolled = 0;

  for (const gs of gradeSections) {
    const offerings = classOfferings.filter(
      (co: any) => co.grade_id === gs.grade_id && co.section_id === gs.section_id
    );

    for (let i = 1; i <= 10; i++) {
      const fnIdx = Math.floor(Math.random() * firstNames.length);
      const lnIdx = Math.floor(Math.random() * lastNames.length);
      const firstName = firstNames[fnIdx];
      const lastName = lastNames[lnIdx];
      const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@${gs.grade_name.replace(/\s/g, '').toLowerCase()}${gs.section_name.toLowerCase()}.trilink.edu`;

      const existing = await userRepo.findOne({ where: { email } });
      if (existing) {
        console.log(`Skip existing: ${email}`);
        continue;
      }

      const student = userRepo.create({
        email,
        passwordHash,
        role: UserRole.STUDENT,
        firstName,
        lastName,
        grade: gs.grade_name,
        section: gs.section_name,
        mustChangePassword: false,
      });

      const saved = await userRepo.save(student);
      totalCreated++;

      for (const co of offerings) {
        await dataSource.query(
          `INSERT INTO enrollments (student_id, class_offering_id, academic_year_id, status, created_at, updated_at)
           VALUES ($1, $2, $3, 'active', now(), now())
           ON CONFLICT DO NOTHING`,
          [saved.id, co.id, academicYearId]
        );
        totalEnrolled++;
      }

      console.log(`Created student ${totalCreated}: ${email} (${gs.grade_name} ${gs.section_name})`);
    }
  }

  console.log(`\nDone: ${totalCreated} students created, ${totalEnrolled} enrollments inserted.`);
  await dataSource.destroy();
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
