import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReportCardRemark } from './entities/report-card-remark.entity';
import { Term } from '../academic-years/entities/term.entity';
import { AcademicYear } from '../academic-years/entities/academic-year.entity';
import { Enrollment } from '../enrollments/entities/enrollment.entity';
import { ClassOffering } from '../class-offerings/entities/class-offering.entity';
import { GradeEntry } from '../grades/entities/grade-entry.entity';
import { AttendanceSession } from '../attendance/entities/attendance-session.entity';
import { AttendanceMark } from '../attendance/entities/attendance-mark.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { Subject } from '../school-structure/entities/subject.entity';
import { ParentStudent } from '../parent-students/entities/parent-student.entity';
import { HomeroomAssignment } from '../homeroom/entities/homeroom-assignment.entity';
import { CreateRemarkDto } from './dto/create-remark.dto';

// ─── Grade helpers ────────────────────────────────────────────────────────────

export function percentToLetterGrade(percent: number): string {
  if (percent >= 90) return 'A+';
  if (percent >= 85) return 'A';
  if (percent >= 80) return 'A-';
  if (percent >= 75) return 'B+';
  if (percent >= 70) return 'B';
  if (percent >= 65) return 'B-';
  if (percent >= 60) return 'C+';
  if (percent >= 55) return 'C';
  if (percent >= 50) return 'C-';
  if (percent >= 45) return 'D';
  return 'F';
}

export function letterGradeToGpa(letter: string): number {
  switch (letter) {
    case 'A+':
    case 'A':
      return 4.0;
    case 'A-':
      return 3.7;
    case 'B+':
      return 3.3;
    case 'B':
      return 3.0;
    case 'B-':
      return 2.7;
    case 'C+':
      return 2.3;
    case 'C':
      return 2.0;
    case 'C-':
      return 1.7;
    case 'D':
      return 1.0;
    default:
      return 0.0;
  }
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class ReportCardsService {
  constructor(
    @InjectRepository(ReportCardRemark)
    private readonly remarkRepo: Repository<ReportCardRemark>,
    @InjectRepository(Term)
    private readonly termRepo: Repository<Term>,
    @InjectRepository(AcademicYear)
    private readonly yearRepo: Repository<AcademicYear>,
    @InjectRepository(Enrollment)
    private readonly enrollmentRepo: Repository<Enrollment>,
    @InjectRepository(ClassOffering)
    private readonly coRepo: Repository<ClassOffering>,
    @InjectRepository(GradeEntry)
    private readonly gradeEntryRepo: Repository<GradeEntry>,
    @InjectRepository(AttendanceSession)
    private readonly sessionRepo: Repository<AttendanceSession>,
    @InjectRepository(AttendanceMark)
    private readonly markRepo: Repository<AttendanceMark>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Subject)
    private readonly subjectRepo: Repository<Subject>,
    @InjectRepository(ParentStudent)
    private readonly psRepo: Repository<ParentStudent>,
    @InjectRepository(HomeroomAssignment)
    private readonly homeroomRepo: Repository<HomeroomAssignment>,
  ) {}

  // ─── Access helpers ───────────────────────────────────────────────────────

  private async assertCanViewStudent(viewer: User, studentId: string): Promise<void> {
    if (viewer.role === UserRole.ADMIN) return;
    if (viewer.role === UserRole.TEACHER) return; // teachers can view any student
    if (viewer.role === UserRole.STUDENT && viewer.id === studentId) return;
    if (viewer.role === UserRole.PARENT) {
      const link = await this.psRepo.findOne({ where: { parentId: viewer.id, studentId } });
      if (link) return;
    }
    throw new ForbiddenException('You do not have permission to view this student\'s report card');
  }

  private async assertIsHomeroomTeacherForStudentInTerm(
    viewer: User,
    studentId: string,
    termId: string,
  ): Promise<void> {
    if (viewer.role === UserRole.ADMIN) return;

    const term = await this.termRepo.findOne({ where: { id: termId } });
    if (!term) throw new NotFoundException('Term not found');

    const assignment = await this.homeroomRepo.findOne({
      where: { teacherId: viewer.id, academicYearId: term.academicYearId },
    });
    if (!assignment) {
      throw new ForbiddenException('You are not a homeroom teacher in this academic year');
    }

    // Verify the student is in this homeroom class
    const classOfferings = await this.coRepo.find({
      where: {
        academicYearId: term.academicYearId,
        gradeId: assignment.gradeId,
        sectionId: assignment.sectionId,
      },
    });
    if (!classOfferings.length) {
      throw new ForbiddenException('No class offerings found for your homeroom class');
    }

    const coIds = classOfferings.map((co) => co.id);
    const enrollment = await this.enrollmentRepo
      .createQueryBuilder('e')
      .where('e.student_id = :studentId', { studentId })
      .andWhere('e.class_offering_id IN (:...ids)', { ids: coIds })
      .getOne();

    if (!enrollment) {
      throw new ForbiddenException('This student is not in your homeroom class');
    }
  }

  // ─── Remarks ──────────────────────────────────────────────────────────────

  async upsertRemark(dto: CreateRemarkDto, viewer: User): Promise<ReportCardRemark> {
    await this.assertIsHomeroomTeacherForStudentInTerm(viewer, dto.studentId, dto.termId);

    const term = await this.termRepo.findOne({ where: { id: dto.termId } });
    if (!term) throw new NotFoundException('Term not found');

    const existing = await this.remarkRepo.findOne({
      where: { studentId: dto.studentId, termId: dto.termId },
    });

    if (existing) {
      existing.remark = dto.remark;
      existing.conductGrade = dto.conductGrade ?? existing.conductGrade;
      return this.remarkRepo.save(existing);
    }

    return this.remarkRepo.save(
      this.remarkRepo.create({
        studentId: dto.studentId,
        termId: dto.termId,
        academicYearId: term.academicYearId,
        homeroomTeacherId: viewer.id,
        remark: dto.remark,
        conductGrade: dto.conductGrade ?? null,
      }),
    );
  }

  // ─── Full report card ─────────────────────────────────────────────────────

  async getStudentTermReportCard(studentId: string, termId: string, viewer: User) {
    await this.assertCanViewStudent(viewer, studentId);

    // 1. Load term → get academicYearId and date range
    const term = await this.termRepo.findOne({ where: { id: termId } });
    if (!term) throw new NotFoundException('Term not found');

    const academicYear = await this.yearRepo.findOne({ where: { id: term.academicYearId } });
    if (!academicYear) throw new NotFoundException('Academic year not found');

    const student = await this.userRepo.findOne({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Student not found');

    // 2. Find all enrollments for student in that academic year
    const enrollments = await this.enrollmentRepo.find({
      where: { studentId, academicYearId: term.academicYearId },
    });

    const classOfferingIds = enrollments.map((e) => e.classOfferingId);

    // 3. For each classOffering, get subject info
    const subjectData: Array<{
      classOfferingId: string;
      subjectId: string;
      subjectName: string;
      teacherName: string;
    }> = [];

    for (const coId of classOfferingIds) {
      const co = await this.coRepo.findOne({ where: { id: coId } });
      if (!co) continue;
      const subject = await this.subjectRepo.findOne({ where: { id: co.subjectId } });
      const teacher = await this.userRepo.findOne({ where: { id: co.teacherId } });
      subjectData.push({
        classOfferingId: coId,
        subjectId: co.subjectId,
        subjectName: subject?.name ?? 'Unknown Subject',
        teacherName: teacher ? `${teacher.firstName} ${teacher.lastName}` : 'Unknown Teacher',
      });
    }

    // 4. For each classOffering, get GradeEntries
    const subjectResults = await Promise.all(
      subjectData.map(async (sd) => {
        const entries = await this.getGradeEntriesForTerm(studentId, sd.classOfferingId, termId, term.startDate, term.endDate);

        const scoredEntries = entries.filter((e) => e.score != null && e.maxScore > 0);
        const averagePercent =
          scoredEntries.length > 0
            ? Math.round(
                (scoredEntries.reduce((sum, e) => sum + (e.score! / e.maxScore) * 100, 0) /
                  scoredEntries.length) *
                  10,
              ) / 10
            : null;

        const letterGrade = averagePercent != null ? percentToLetterGrade(averagePercent) : null;

        return {
          subjectId: sd.subjectId,
          subjectName: sd.subjectName,
          classOfferingId: sd.classOfferingId,
          teacherName: sd.teacherName,
          entries: entries.map((e) => ({
            title: e.title,
            type: e.type,
            score: e.score,
            maxScore: e.maxScore,
            percent:
              e.score != null && e.maxScore > 0
                ? Math.round((e.score / e.maxScore) * 1000) / 10
                : null,
            releasedAt: e.releasedAt,
          })),
          summary: {
            totalEntries: entries.length,
            averagePercent,
            letterGrade,
          },
        };
      }),
    );

    // 5. Attendance
    const attendance = await this.getAttendanceForTerm(
      studentId,
      classOfferingIds,
      termId,
      term.startDate,
      term.endDate,
    );

    // 6. Calculate overall GPA and percent
    const subjectsWithGrades = subjectResults.filter((s) => s.summary.averagePercent != null);
    const overallPercent =
      subjectsWithGrades.length > 0
        ? Math.round(
            (subjectsWithGrades.reduce((sum, s) => sum + s.summary.averagePercent!, 0) /
              subjectsWithGrades.length) *
              10,
          ) / 10
        : 0;

    const overallLetterGrade = subjectsWithGrades.length > 0 ? percentToLetterGrade(overallPercent) : 'N/A';
    const overallGpa =
      subjectsWithGrades.length > 0
        ? Math.round(
            (subjectsWithGrades.reduce(
              (sum, s) => sum + letterGradeToGpa(s.summary.letterGrade!),
              0,
            ) /
              subjectsWithGrades.length) *
              100,
          ) / 100
        : 0;

    // 7. Load homeroom remark
    const remark = await this.remarkRepo.findOne({ where: { studentId, termId } });

    return {
      student: {
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        grade: student.grade,
        section: student.section,
        profileImageFileId: student.profileImageFileId,
      },
      academicYear: {
        id: academicYear.id,
        label: academicYear.label,
      },
      term: {
        id: term.id,
        name: term.name,
        startDate: term.startDate,
        endDate: term.endDate,
      },
      subjects: subjectResults,
      attendance,
      overallGpa,
      overallPercent,
      overallLetterGrade,
      homeroomRemark: remark
        ? { remark: remark.remark, conductGrade: remark.conductGrade }
        : null,
      generatedAt: new Date().toISOString(),
    };
  }

  // ─── Class report card summary ────────────────────────────────────────────

  async getClassTermReportCard(
    gradeId: string,
    sectionId: string,
    termId: string,
    viewer: User,
  ) {
    const term = await this.termRepo.findOne({ where: { id: termId } });
    if (!term) throw new NotFoundException('Term not found');

    // Check access: admin or homeroom teacher of that class
    if (viewer.role !== UserRole.ADMIN) {
      const assignment = await this.homeroomRepo.findOne({
        where: {
          teacherId: viewer.id,
          academicYearId: term.academicYearId,
          gradeId,
          sectionId,
        },
      });
      if (!assignment) {
        throw new ForbiddenException('You are not the homeroom teacher for this class');
      }
    }

    // Find all class offerings for this grade+section+year
    const classOfferings = await this.coRepo.find({
      where: {
        academicYearId: term.academicYearId,
        gradeId,
        sectionId,
      },
    });

    if (!classOfferings.length) {
      return { gradeId, sectionId, termId, students: [] };
    }

    const coIds = classOfferings.map((co) => co.id);

    // Find all unique students enrolled
    const enrollments = await this.enrollmentRepo
      .createQueryBuilder('e')
      .where('e.class_offering_id IN (:...ids)', { ids: coIds })
      .andWhere('e.academic_year_id = :yearId', { yearId: term.academicYearId })
      .getMany();

    const studentIds = [...new Set(enrollments.map((e) => e.studentId))];

    if (!studentIds.length) {
      return { gradeId, sectionId, termId, students: [] };
    }

    // Build summary for each student
    const studentSummaries = await Promise.all(
      studentIds.map(async (studentId) => {
        const student = await this.userRepo.findOne({ where: { id: studentId } });
        if (!student) return null;

        // Get all enrollments for this student in this year
        const studentEnrollments = await this.enrollmentRepo.find({
          where: { studentId, academicYearId: term.academicYearId },
        });
        const studentCoIds = studentEnrollments.map((e) => e.classOfferingId);

        // Grade entries across all subjects
        const allEntries: GradeEntry[] = [];
        for (const coId of studentCoIds) {
          const entries = await this.getGradeEntriesForTerm(
            studentId,
            coId,
            termId,
            term.startDate,
            term.endDate,
          );
          allEntries.push(...entries);
        }

        const scoredEntries = allEntries.filter((e) => e.score != null && e.maxScore > 0);
        const overallPercent =
          scoredEntries.length > 0
            ? Math.round(
                (scoredEntries.reduce((sum, e) => sum + (e.score! / e.maxScore) * 100, 0) /
                  scoredEntries.length) *
                  10,
              ) / 10
            : 0;

        const overallLetterGrade = scoredEntries.length > 0 ? percentToLetterGrade(overallPercent) : 'N/A';

        // Attendance
        const attendance = await this.getAttendanceForTerm(
          studentId,
          studentCoIds,
          termId,
          term.startDate,
          term.endDate,
        );

        return {
          studentId,
          firstName: student.firstName,
          lastName: student.lastName,
          overallPercent,
          overallLetterGrade,
          attendancePercent: attendance.attendancePercent,
          rank: 0, // will be set after sorting
        };
      }),
    );

    const valid = studentSummaries.filter(Boolean) as NonNullable<(typeof studentSummaries)[0]>[];

    // Rank by overallPercent descending
    valid.sort((a, b) => b.overallPercent - a.overallPercent);
    valid.forEach((s, i) => {
      s.rank = i + 1;
    });

    return { gradeId, sectionId, termId, students: valid };
  }

  // ─── Full-year transcript ─────────────────────────────────────────────────

  async getStudentYearReportCards(studentId: string, academicYearId: string, viewer: User) {
    await this.assertCanViewStudent(viewer, studentId);

    const academicYear = await this.yearRepo.findOne({ where: { id: academicYearId } });
    if (!academicYear) throw new NotFoundException('Academic year not found');

    const terms = await this.termRepo.find({
      where: { academicYearId },
      order: { startDate: 'ASC' },
    });

    const student = await this.userRepo.findOne({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Student not found');

    const termReports = await Promise.all(
      terms.map(async (term) => {
        const enrollments = await this.enrollmentRepo.find({
          where: { studentId, academicYearId },
        });
        const classOfferingIds = enrollments.map((e) => e.classOfferingId);

        const subjectData: Array<{
          classOfferingId: string;
          subjectId: string;
          subjectName: string;
          averagePercent: number | null;
          letterGrade: string | null;
        }> = [];

        for (const coId of classOfferingIds) {
          const co = await this.coRepo.findOne({ where: { id: coId } });
          if (!co) continue;
          const subject = await this.subjectRepo.findOne({ where: { id: co.subjectId } });
          const entries = await this.getGradeEntriesForTerm(
            studentId,
            coId,
            term.id,
            term.startDate,
            term.endDate,
          );
          const scored = entries.filter((e) => e.score != null && e.maxScore > 0);
          const avg =
            scored.length > 0
              ? Math.round(
                  (scored.reduce((s, e) => s + (e.score! / e.maxScore) * 100, 0) / scored.length) * 10,
                ) / 10
              : null;

          subjectData.push({
            classOfferingId: coId,
            subjectId: co.subjectId,
            subjectName: subject?.name ?? 'Unknown',
            averagePercent: avg,
            letterGrade: avg != null ? percentToLetterGrade(avg) : null,
          });
        }

        const withGrades = subjectData.filter((s) => s.averagePercent != null);
        const overallPercent =
          withGrades.length > 0
            ? Math.round(
                (withGrades.reduce((s, x) => s + x.averagePercent!, 0) / withGrades.length) * 10,
              ) / 10
            : 0;

        const attendance = await this.getAttendanceForTerm(
          studentId,
          classOfferingIds,
          term.id,
          term.startDate,
          term.endDate,
        );

        const remark = await this.remarkRepo.findOne({ where: { studentId, termId: term.id } });

        return {
          term: { id: term.id, name: term.name, startDate: term.startDate, endDate: term.endDate },
          subjects: subjectData,
          overallPercent,
          overallLetterGrade: withGrades.length > 0 ? percentToLetterGrade(overallPercent) : 'N/A',
          attendance,
          homeroomRemark: remark ? { remark: remark.remark, conductGrade: remark.conductGrade } : null,
        };
      }),
    );

    return {
      student: {
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        grade: student.grade,
        section: student.section,
      },
      academicYear: { id: academicYear.id, label: academicYear.label },
      terms: termReports,
      generatedAt: new Date().toISOString(),
    };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * Get grade entries for a student in a class offering for a term.
   * Matches by termId if set, otherwise falls back to date-range filtering.
   */
  private async getGradeEntriesForTerm(
    studentId: string,
    classOfferingId: string,
    termId: string,
    termStartDate: string,
    termEndDate: string,
  ): Promise<GradeEntry[]> {
    // Entries explicitly tagged with this termId
    const byTermId = await this.gradeEntryRepo.find({
      where: { studentId, classOfferingId, termId },
    });

    // Entries without termId but created within the term's date range
    const byDateRange = await this.gradeEntryRepo
      .createQueryBuilder('ge')
      .where('ge.student_id = :studentId', { studentId })
      .andWhere('ge.class_offering_id = :classOfferingId', { classOfferingId })
      .andWhere('ge.term_id IS NULL')
      .andWhere('ge.created_at >= :start', { start: termStartDate + 'T00:00:00.000Z' })
      .andWhere('ge.created_at <= :end', { end: termEndDate + 'T23:59:59.999Z' })
      .andWhere('ge.released_at IS NOT NULL')
      .getMany();

    // Merge, deduplicate by id
    const all = [...byTermId, ...byDateRange];
    const seen = new Set<string>();
    return all.filter((e) => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });
  }

  /**
   * Get attendance summary for a student across multiple class offerings for a term.
   */
  private async getAttendanceForTerm(
    studentId: string,
    classOfferingIds: string[],
    termId: string,
    termStartDate: string,
    termEndDate: string,
  ): Promise<{
    present: number;
    absent: number;
    late: number;
    excused: number;
    total: number;
    attendancePercent: number;
  }> {
    if (!classOfferingIds.length) {
      return { present: 0, absent: 0, late: 0, excused: 0, total: 0, attendancePercent: 0 };
    }

    // Sessions tagged with this termId
    const sessionsByTermId = await this.sessionRepo
      .createQueryBuilder('s')
      .where('s.class_offering_id IN (:...ids)', { ids: classOfferingIds })
      .andWhere('s.term_id = :termId', { termId })
      .getMany();

    // Sessions without termId but within date range
    const sessionsByDate = await this.sessionRepo
      .createQueryBuilder('s')
      .where('s.class_offering_id IN (:...ids)', { ids: classOfferingIds })
      .andWhere('s.term_id IS NULL')
      .andWhere('s.date >= :start', { start: termStartDate })
      .andWhere('s.date <= :end', { end: termEndDate })
      .getMany();

    // Merge sessions, deduplicate
    const allSessions = [...sessionsByTermId, ...sessionsByDate];
    const seenSessions = new Set<string>();
    const sessions = allSessions.filter((s) => {
      if (seenSessions.has(s.id)) return false;
      seenSessions.add(s.id);
      return true;
    });

    if (!sessions.length) {
      return { present: 0, absent: 0, late: 0, excused: 0, total: 0, attendancePercent: 0 };
    }

    const sessionIds = sessions.map((s) => s.id);
    const marks = await this.markRepo
      .createQueryBuilder('m')
      .where('m.session_id IN (:...ids)', { ids: sessionIds })
      .andWhere('m.student_id = :studentId', { studentId })
      .getMany();

    const present = marks.filter((m) => m.status === 'present').length;
    const absent = marks.filter((m) => m.status === 'absent').length;
    const late = marks.filter((m) => m.status === 'late').length;
    const excused = marks.filter((m) => m.status === 'excused').length;
    const total = marks.length;
    const attendancePercent =
      total > 0 ? Math.round(((present + late) / total) * 1000) / 10 : 0;

    return { present, absent, late, excused, total, attendancePercent };
  }
}
