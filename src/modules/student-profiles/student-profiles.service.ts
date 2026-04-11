import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { StudentProfile } from './entities/student-profile.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { ParentStudent } from '../parent-students/entities/parent-student.entity';
import { Enrollment } from '../enrollments/entities/enrollment.entity';
import { ClassOffering } from '../class-offerings/entities/class-offering.entity';
import { Grade } from '../school-structure/entities/grade.entity';
import { Section } from '../school-structure/entities/section.entity';
import { Subject } from '../school-structure/entities/subject.entity';

@Injectable()
export class StudentProfilesService {
  constructor(
    @InjectRepository(StudentProfile) private readonly repo: Repository<StudentProfile>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(ParentStudent) private readonly psRepo: Repository<ParentStudent>,
    @InjectRepository(Enrollment) private readonly enrollmentRepo: Repository<Enrollment>,
    @InjectRepository(ClassOffering) private readonly classRepo: Repository<ClassOffering>,
    @InjectRepository(Grade) private readonly gradeRepo: Repository<Grade>,
    @InjectRepository(Section) private readonly sectionRepo: Repository<Section>,
    @InjectRepository(Subject) private readonly subjectRepo: Repository<Subject>,
  ) {}

  private async assertStudent(userId: string) {
    const u = await this.userRepo.findOne({ where: { id: userId } });
    if (!u || u.role !== UserRole.STUDENT) throw new ForbiddenException('Profile is for students only');
  }

  async assertViewer(viewer: User, studentUserId: string) {
    if (viewer.role === UserRole.ADMIN || viewer.role === UserRole.TEACHER) return;
    if (viewer.role === UserRole.STUDENT && viewer.id === studentUserId) return;
    if (viewer.role === UserRole.PARENT) {
      const link = await this.psRepo.findOne({ where: { parentId: viewer.id, studentId: studentUserId } });
      if (link) return;
    }
    throw new ForbiddenException('Cannot view this profile');
  }

  async getOrCreate(studentUserId: string) {
    await this.assertStudent(studentUserId);
    let p = await this.repo.findOne({ where: { userId: studentUserId } });
    if (!p) p = await this.repo.save(this.repo.create({ userId: studentUserId }));
    return p;
  }

  async getForViewer(studentUserId: string, viewer: User) {
    await this.assertViewer(viewer, studentUserId);
    return this.getOrCreate(studentUserId);
  }

  async getDetailedForViewer(studentUserId: string, viewer: User) {
    await this.assertViewer(viewer, studentUserId);

    const student = await this.userRepo.findOne({ where: { id: studentUserId } });
    if (!student || student.role !== UserRole.STUDENT) {
      throw new ForbiddenException('Student not found');
    }

    const profile = await this.getOrCreate(studentUserId);

    const enrollments = await this.enrollmentRepo.find({
      where: { studentId: studentUserId, status: 'active' },
      order: { createdAt: 'DESC' },
    });

    const offeringIds = Array.from(new Set(enrollments.map((e) => e.classOfferingId)));
    const offerings = offeringIds.length
      ? await this.classRepo.findBy({ id: In(offeringIds) })
      : [];

    const gradeIds = Array.from(new Set(offerings.map((o) => o.gradeId)));
    const sectionIds = Array.from(new Set(offerings.map((o) => o.sectionId)));
    const subjectIds = Array.from(new Set(offerings.map((o) => o.subjectId)));
    const teacherIds = Array.from(new Set(offerings.map((o) => o.teacherId)));

    const [grades, sections, subjects, teachers] = await Promise.all([
      gradeIds.length ? this.gradeRepo.findBy({ id: In(gradeIds) }) : Promise.resolve([]),
      sectionIds.length ? this.sectionRepo.findBy({ id: In(sectionIds) }) : Promise.resolve([]),
      subjectIds.length ? this.subjectRepo.findBy({ id: In(subjectIds) }) : Promise.resolve([]),
      teacherIds.length ? this.userRepo.findBy({ id: In(teacherIds) }) : Promise.resolve([]),
    ]);

    const gradeMap = new Map(grades.map((g) => [g.id, g]));
    const sectionMap = new Map(sections.map((s) => [s.id, s]));
    const subjectMap = new Map(subjects.map((s) => [s.id, s]));
    const teacherMap = new Map(teachers.map((t) => [t.id, t]));
    const offeringMap = new Map(offerings.map((o) => [o.id, o]));

    const classes = enrollments
      .map((enrollment) => {
        const offering = offeringMap.get(enrollment.classOfferingId);
        if (!offering) return null;

        const grade = gradeMap.get(offering.gradeId);
        const section = sectionMap.get(offering.sectionId);
        const subject = subjectMap.get(offering.subjectId);
        const teacher = teacherMap.get(offering.teacherId);

        return {
          enrollmentId: enrollment.id,
          academicYearId: enrollment.academicYearId,
          classOfferingId: offering.id,
          className: offering.name,
          grade: grade ? { id: grade.id, name: grade.name } : null,
          section: section ? { id: section.id, name: section.name } : null,
          subject: subject ? { id: subject.id, name: subject.name, code: subject.code } : null,
          teacher: teacher
            ? {
                id: teacher.id,
                firstName: teacher.firstName,
                lastName: teacher.lastName,
                email: teacher.email,
                subject: teacher.subject,
                department: teacher.department,
              }
            : null,
        };
      })
      .filter((row) => row !== null);

    return {
      student: {
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email,
        phone: student.phone,
        grade: student.grade,
        section: student.section,
        profileImageFileId: student.profileImageFileId,
        createdAt: student.createdAt,
      },
      profile,
      classes,
    };
  }

  async patchMe(studentUserId: string, viewer: User, body: Partial<Pick<StudentProfile, 'bio' | 'avatarFileId' | 'extraJson'>>) {
    if (viewer.role !== UserRole.STUDENT || viewer.id !== studentUserId) {
      throw new ForbiddenException('Only the student can edit their profile');
    }
    await this.assertStudent(studentUserId);
    let p = await this.repo.findOne({ where: { userId: studentUserId } });
    if (!p) p = this.repo.create({ userId: studentUserId });
    if (body.bio !== undefined) p.bio = body.bio;
    if (body.avatarFileId !== undefined) p.avatarFileId = body.avatarFileId;
    if (body.extraJson !== undefined) p.extraJson = body.extraJson;
    return this.repo.save(p);
  }
}
