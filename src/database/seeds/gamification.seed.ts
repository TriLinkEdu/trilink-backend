import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

export async function seedGamification(dataSource: DataSource) {
  console.log('🎮 Seeding gamification data...');

  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    // 1. Create Academic Year
    const academicYearId = 'a0000000-0000-0000-0000-000000000001';
    await queryRunner.query(`
      INSERT INTO academic_years (id, label, start_date, end_date, is_active)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id) DO NOTHING
    `, [academicYearId, '2024-2025', '2024-09-01', '2025-06-30', true]);
    console.log('✅ Academic year created');

    // 2. Create Grade (Grade 9)
    const gradeId = 'f0000000-0000-0000-0000-000000000001';
    await queryRunner.query(`
      INSERT INTO grades (id, name, created_at, updated_at)
      VALUES ($1, $2, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `, [gradeId, '9']);
    console.log('✅ Grade created');

    // 3. Create Sections (A and B)
    const sectionAId = 'f0000000-0000-0000-0000-000000000002';
    const sectionBId = 'f0000000-0000-0000-0000-000000000003';
    await queryRunner.query(`
      INSERT INTO sections (id, name, created_at, updated_at)
      VALUES ($1, $2, NOW(), NOW()), ($3, $4, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `, [sectionAId, 'A', sectionBId, 'B']);
    console.log('✅ Sections created');

    // 4. Create Subjects (with specific UUIDs for AI engine linking)
    const subjects = [
      { id: 'b0000000-0000-0000-0000-000000000001', name: 'Mathematics', code: 'MATH' },
      { id: 'b0000000-0000-0000-0000-000000000002', name: 'Science', code: 'SCI' },
      { id: 'b0000000-0000-0000-0000-000000000003', name: 'English', code: 'ENG' },
      { id: 'b0000000-0000-0000-0000-000000000004', name: 'History', code: 'HIST' },
      { id: 'b0000000-0000-0000-0000-000000000005', name: 'Art', code: 'ART' },
    ];

    for (const subject of subjects) {
      await queryRunner.query(`
        INSERT INTO subjects (id, name, code, created_at, updated_at)
        VALUES ($1, $2, $3, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
      `, [subject.id, subject.name, subject.code]);
    }
    console.log(`✅ ${subjects.length} subjects created`);

    // 5. Create Teacher User
    const teacherId = 'c0000000-0000-0000-0000-000000000001';
    const hashedPassword = await bcrypt.hash('Teacher@123', 10);
    await queryRunner.query(`
      INSERT INTO users (
        id, email, password_hash, role, first_name, last_name, 
        must_change_password, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      ON CONFLICT (email) DO NOTHING
    `, [teacherId, 'teacher@trilink.edu', hashedPassword, 'teacher', 'John', 'Teacher', false]);
    console.log('✅ Teacher user created');

    // 6. Create Class Offerings (2 per subject)
    const classOfferings = [
      { id: 'd0000000-0000-0000-0000-000000000001', subjectId: 'b0000000-0000-0000-0000-000000000001', sectionId: sectionAId, name: 'Math - Grade 9A' },
      { id: 'd0000000-0000-0000-0000-000000000002', subjectId: 'b0000000-0000-0000-0000-000000000001', sectionId: sectionBId, name: 'Math - Grade 9B' },
      { id: 'd0000000-0000-0000-0000-000000000003', subjectId: 'b0000000-0000-0000-0000-000000000002', sectionId: sectionAId, name: 'Science - Grade 9A' },
      { id: 'd0000000-0000-0000-0000-000000000004', subjectId: 'b0000000-0000-0000-0000-000000000002', sectionId: sectionBId, name: 'Science - Grade 9B' },
      { id: 'd0000000-0000-0000-0000-000000000005', subjectId: 'b0000000-0000-0000-0000-000000000003', sectionId: sectionAId, name: 'English - Grade 9A' },
      { id: 'd0000000-0000-0000-0000-000000000006', subjectId: 'b0000000-0000-0000-0000-000000000003', sectionId: sectionBId, name: 'English - Grade 9B' },
      { id: 'd0000000-0000-0000-0000-000000000007', subjectId: 'b0000000-0000-0000-0000-000000000004', sectionId: sectionAId, name: 'History - Grade 9A' },
      { id: 'd0000000-0000-0000-0000-000000000008', subjectId: 'b0000000-0000-0000-0000-000000000004', sectionId: sectionBId, name: 'History - Grade 9B' },
      { id: 'd0000000-0000-0000-0000-000000000009', subjectId: 'b0000000-0000-0000-0000-000000000005', sectionId: sectionAId, name: 'Art - Grade 9A' },
      { id: 'd0000000-0000-0000-0000-00000000000a', subjectId: 'b0000000-0000-0000-0000-000000000005', sectionId: sectionBId, name: 'Art - Grade 9B' },
    ];

    for (const classOffering of classOfferings) {
      await queryRunner.query(`
        INSERT INTO class_offerings (
          id, subject_id, teacher_id, academic_year_id, grade_id, section_id, name, 
          created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
      `, [classOffering.id, classOffering.subjectId, teacherId, academicYearId, gradeId, classOffering.sectionId, classOffering.name]);
    }
    console.log(`✅ ${classOfferings.length} class offerings created`);

    // 7. Create Test Students
    const students = [];
    for (let i = 1; i <= 10; i++) {
      const studentId = `e0000000-0000-0000-0000-00000000000${i.toString(16)}`;
      const sectionId = i <= 5 ? sectionAId : sectionBId;
      const hashedPwd = await bcrypt.hash(`Student${i}@123`, 10);
      
      await queryRunner.query(`
        INSERT INTO users (
          id, email, password_hash, role, first_name, last_name, 
          grade, section, must_change_password, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
      `, [
        studentId, 
        `student${i}@trilink.edu`, 
        hashedPwd, 
        'student', 
        `Student${i}`, 
        'Test', 
        '9', 
        i <= 5 ? 'A' : 'B', 
        false
      ]);
      
      students.push({ id: studentId, sectionId });
    }
    console.log(`✅ ${students.length} test students created`);

    // 8. Create Enrollments (each student enrolled in 4 classes)
    let enrollmentCount = 0;
    for (const student of students) {
      const studentClasses = classOfferings.filter(c => c.sectionId === student.sectionId);
      
      for (const classOffering of studentClasses.slice(0, 4)) {
        await queryRunner.query(`
          INSERT INTO enrollments (
            id, student_id, class_offering_id, academic_year_id, status, created_at, updated_at
          )
          VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW(), NOW())
          ON CONFLICT DO NOTHING
        `, [student.id, classOffering.id, academicYearId, 'active']);
        enrollmentCount++;
      }
    }
    console.log(`✅ ${enrollmentCount} enrollments created`);

    await queryRunner.commitTransaction();
    console.log('🎉 Gamification seed completed successfully!');
    
    console.log('\n📊 Summary:');
    console.log(`   - 1 academic year`);
    console.log(`   - ${subjects.length} subjects`);
    console.log(`   - 1 teacher`);
    console.log(`   - ${classOfferings.length} class offerings`);
    console.log(`   - ${students.length} students`);
    console.log(`   - ${enrollmentCount} enrollments`);
    console.log('\n🔗 Students can now see quizzes that use AI engine questions!');

  } catch (error) {
    await queryRunner.rollbackTransaction();
    console.error('❌ Seed failed:', error);
    throw error;
  } finally {
    await queryRunner.release();
  }
}
