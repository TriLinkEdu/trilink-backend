import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HomeroomAssignment } from './entities/homeroom-assignment.entity';
import { AcademicYear } from '../academic-years/entities/academic-year.entity';
import { ClassOffering } from '../class-offerings/entities/class-offering.entity';
import { Enrollment } from '../enrollments/entities/enrollment.entity';
import { User } from '../users/entities/user.entity';
import { Grade } from '../school-structure/entities/grade.entity';
import { Section } from '../school-structure/entities/section.entity';
import { AssignHomeroomDto } from './dto/assign-homeroom.dto';

@Injectable()
export class HomeroomService {
  constructor(
    @InjectRepository(HomeroomAssignment)
    private readonly homeroomRepo: Repository<HomeroomAssignment>,
    @InjectRepository(AcademicYear)
    private readonly yearRepo: Repository<AcademicYear>,
    @InjectRepository(ClassOffering)
    private readonly coRepo: Repository<ClassOffering>,
    @InjectRepository(Enrollment)
    private readonly enrollmentRepo: Repository<Enrollment>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Grade)
    private readonly gradeRepo: Repository<Grade>,
    @InjectRepository(Section)
    private readonly sectionRepo: Repository<Section>,
  ) {}

  /**
   * Assign (or update) a homeroom teacher to a grade+section for an academic year.
   * If an assignment already exists for that year+grade+section, it is updated.
   */
  async assign(dto: AssignHomeroomDto): Promise<HomeroomAssignment> {
    const existing = await this.homeroomRepo.findOne({
      where: {
        academicYearId: dto.academicYearId,
        gradeId: dto.gradeId,
        sectionId: dto.sectionId,
      },
    });

    if (existing) {
      existing.teacherId = dto.teacherId;
      return this.homeroomRepo.save(existing);
    }

    // Prevent a teacher from being assigned to multiple homerooms in the same academic year
    const teacherAlreadyAssigned = await this.homeroomRepo.findOne({
      where: { teacherId: dto.teacherId, academicYearId: dto.academicYearId },
    });
    if (teacherAlreadyAssigned) {
      throw new BadRequestException('This teacher is already assigned as a homeroom teacher for another class in this academic year');
    }

    return this.homeroomRepo.save(
      this.homeroomRepo.create({
        teacherId: dto.teacherId,
        academicYearId: dto.academicYearId,
        gradeId: dto.gradeId,
        sectionId: dto.sectionId,
      }),
    );
  }

  /**
   * Get the homeroom teacher's class for the current active academic year.
   * Returns the assignment and the list of students enrolled in that grade+section.
   */
  async getMyClass(teacherId: string): Promise<{
    assignment: HomeroomAssignment;
    students: Array<{
      id: string;
      firstName: string;
      lastName: string;
      grade: string | null;
      section: string | null;
      profileImageFileId: string | null;
    }>;
  }> {
    // Find the active academic year
    const activeYear = await this.yearRepo.findOne({ where: { isActive: true } });
    if (!activeYear) throw new NotFoundException('No active academic year found');

    // Find the homeroom assignment for this teacher in the active year
    const assignment = await this.homeroomRepo.findOne({
      where: { teacherId, academicYearId: activeYear.id },
    });
    if (!assignment) {
      throw new NotFoundException('No homeroom assignment found for this teacher in the active academic year');
    }

    // Find all class offerings for this grade+section in the active year
    const classOfferings = await this.coRepo.find({
      where: {
        academicYearId: activeYear.id,
        gradeId: assignment.gradeId,
        sectionId: assignment.sectionId,
      },
    });

    const classOfferingIds = classOfferings.map((co) => co.id);
    if (!classOfferingIds.length) {
      return { assignment, students: [] };
    }

    // Find all enrollments for those class offerings
    const enrollments = await this.enrollmentRepo
      .createQueryBuilder('e')
      .where('e.class_offering_id IN (:...ids)', { ids: classOfferingIds })
      .andWhere('e.academic_year_id = :yearId', { yearId: activeYear.id })
      .getMany();

    // Deduplicate by studentId
    const studentIds = [...new Set(enrollments.map((e) => e.studentId))];

    if (!studentIds.length) {
      return { assignment, students: [] };
    }

    const students = await this.userRepo
      .createQueryBuilder('u')
      .where('u.id IN (:...ids)', { ids: studentIds })
      .getMany();

    return {
      assignment,
      students: students.map((s) => ({
        id: s.id,
        firstName: s.firstName,
        lastName: s.lastName,
        grade: s.grade,
        section: s.section,
        profileImageFileId: s.profileImageFileId,
      })),
    };
  }

  /**
   * List all homeroom assignments, optionally filtered by academic year.
   * Enriched with teacher name, grade name, section name.
   */
  async listAll(academicYearId?: string): Promise<
    Array<{
      id: string;
      academicYearId: string;
      gradeId: string;
      gradeName: string | null;
      sectionId: string;
      sectionName: string | null;
      teacherId: string;
      teacherFirstName: string | null;
      teacherLastName: string | null;
      createdAt: Date;
    }>
  > {
    const qb = this.homeroomRepo.createQueryBuilder('ha');
    if (academicYearId) {
      qb.where('ha.academic_year_id = :academicYearId', { academicYearId });
    }
    const assignments = await qb.orderBy('ha.created_at', 'DESC').getMany();

    return Promise.all(
      assignments.map(async (a) => {
        const [teacher, grade, section] = await Promise.all([
          this.userRepo.findOne({ where: { id: a.teacherId } }),
          this.gradeRepo.findOne({ where: { id: a.gradeId } }),
          this.sectionRepo.findOne({ where: { id: a.sectionId } }),
        ]);
        return {
          id: a.id,
          academicYearId: a.academicYearId,
          gradeId: a.gradeId,
          gradeName: grade?.name ?? null,
          sectionId: a.sectionId,
          sectionName: section?.name ?? null,
          teacherId: a.teacherId,
          teacherFirstName: teacher?.firstName ?? null,
          teacherLastName: teacher?.lastName ?? null,
          createdAt: a.createdAt,
        };
      }),
    );
  }

  /**
   * Remove a homeroom assignment by id.
   */
  async remove(id: string): Promise<{ deleted: boolean }> {
    const assignment = await this.homeroomRepo.findOne({ where: { id } });
    if (!assignment) throw new NotFoundException('Homeroom assignment not found');
    await this.homeroomRepo.remove(assignment);
    return { deleted: true };
  }

  /**
   * Find the homeroom assignment for a given teacher and academic year.
   * Used internally by report-cards service.
   */
  async findByTeacherAndYear(
    teacherId: string,
    academicYearId: string,
  ): Promise<HomeroomAssignment | null> {
    return this.homeroomRepo.findOne({ where: { teacherId, academicYearId } });
  }

  /**
   * Find the homeroom assignment for a given grade+section+year.
   * Used internally by report-cards service.
   */
  async findByClassAndYear(
    gradeId: string,
    sectionId: string,
    academicYearId: string,
  ): Promise<HomeroomAssignment | null> {
    return this.homeroomRepo.findOne({ where: { gradeId, sectionId, academicYearId } });
  }

  /**
   * Check if a teacher is the homeroom teacher for a student's class in a given academic year.
   */
  async isHomeroomTeacherForStudent(
    teacherId: string,
    studentId: string,
    academicYearId: string,
  ): Promise<boolean> {
    const assignment = await this.homeroomRepo.findOne({
      where: { teacherId, academicYearId },
    });
    if (!assignment) return false;

    // Check if student is enrolled in a class offering for this grade+section+year
    const classOfferings = await this.coRepo.find({
      where: {
        academicYearId,
        gradeId: assignment.gradeId,
        sectionId: assignment.sectionId,
      },
    });
    if (!classOfferings.length) return false;

    const coIds = classOfferings.map((co) => co.id);
    const enrollment = await this.enrollmentRepo
      .createQueryBuilder('e')
      .where('e.student_id = :studentId', { studentId })
      .andWhere('e.class_offering_id IN (:...ids)', { ids: coIds })
      .getOne();

    return !!enrollment;
  }
}
