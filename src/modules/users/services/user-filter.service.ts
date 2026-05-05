import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../entities/user.entity';
import { ParentStudent } from '../../parent-students/entities/parent-student.entity';

export interface UserFilterCriteria {
  role?: UserRole;
  grade?: string;
  section?: string;
  subject?: string;
  department?: string;
  academicYearId?: string;
  searchTerm?: string;
}

@Injectable()
export class UserFilterService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(ParentStudent)
    private readonly parentStudentRepo: Repository<ParentStudent>,
  ) {}

  /**
   * Filter students by grade, section, academic year
   */
  async filterStudents(criteria: UserFilterCriteria): Promise<User[]> {
    const qb = this.userRepo
      .createQueryBuilder('user')
      .where('user.role = :role', { role: UserRole.STUDENT })
      .orderBy('user.createdAt', 'DESC');

    // Filter by grade
    if (criteria.grade) {
      qb.andWhere('user.grade = :grade', { grade: criteria.grade });
    }

    // Filter by section
    if (criteria.section) {
      qb.andWhere('user.section = :section', { section: criteria.section });
    }

    // Filter by search term (name or email)
    if (criteria.searchTerm) {
      qb.andWhere(
        '(user.firstName ILIKE :term OR user.lastName ILIKE :term OR user.email ILIKE :term)',
        { term: `%${criteria.searchTerm}%` },
      );
    }

    return qb.getMany();
  }

  /**
   * Filter teachers by subject, department
   */
  async filterTeachers(criteria: UserFilterCriteria): Promise<User[]> {
    const qb = this.userRepo
      .createQueryBuilder('user')
      .where('user.role = :role', { role: UserRole.TEACHER })
      .orderBy('user.createdAt', 'DESC');

    // Filter by subject
    if (criteria.subject) {
      qb.andWhere('user.subject = :subject', { subject: criteria.subject });
    }

    // Filter by department
    if (criteria.department) {
      qb.andWhere('user.department = :department', { department: criteria.department });
    }

    // Filter by search term (name or email)
    if (criteria.searchTerm) {
      qb.andWhere(
        '(user.firstName ILIKE :term OR user.lastName ILIKE :term OR user.email ILIKE :term)',
        { term: `%${criteria.searchTerm}%` },
      );
    }

    return qb.getMany();
  }

  /**
   * Filter parents by linked student's grade/section
   */
  async filterParents(criteria: UserFilterCriteria): Promise<User[]> {
    const qb = this.userRepo
      .createQueryBuilder('user')
      .where('user.role = :role', { role: UserRole.PARENT })
      .orderBy('user.createdAt', 'DESC');

    // If filtering by student's grade or section, we need to join through parent_students
    if (criteria.grade || criteria.section) {
      qb.innerJoin(
        'parent_students',
        'ps',
        'ps.parent_id = user.id',
      ).innerJoin(
        'users',
        'student',
        'student.id = ps.student_id',
      );

      if (criteria.grade) {
        qb.andWhere('student.grade = :grade', { grade: criteria.grade });
      }

      if (criteria.section) {
        qb.andWhere('student.section = :section', { section: criteria.section });
      }
    }

    // Filter by search term (name or email)
    if (criteria.searchTerm) {
      qb.andWhere(
        '(user.firstName ILIKE :term OR user.lastName ILIKE :term OR user.email ILIKE :term)',
        { term: `%${criteria.searchTerm}%` },
      );
    }

    return qb.getMany();
  }
}
