import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Assignment } from './entities/assignment.entity';
import { AssignmentSubmission } from './entities/assignment-submission.entity';
import { Enrollment } from '../enrollments/entities/enrollment.entity';
import { User, UserRole } from '../users/entities/user.entity';

@Injectable()
export class AssignmentsService {
  constructor(
    @InjectRepository(Assignment) private readonly assignmentRepo: Repository<Assignment>,
    @InjectRepository(AssignmentSubmission) private readonly submissionRepo: Repository<AssignmentSubmission>,
    @InjectRepository(Enrollment) private readonly enrollmentRepo: Repository<Enrollment>,
  ) {}

  private async allowedClassIdsForStudent(studentId: string): Promise<string[]> {
    const rows = await this.enrollmentRepo.find({ where: { studentId, status: 'active' } });
    return [...new Set(rows.map((r) => r.classOfferingId))];
  }

  private statusFor(assignment: Assignment, submission?: AssignmentSubmission): 'pending' | 'submitted' | 'graded' | 'overdue' {
    if (submission?.score != null) return 'graded';
    if (submission) return 'submitted';
    if (assignment.dueDate.getTime() < Date.now()) return 'overdue';
    return 'pending';
  }

  private toDto(assignment: Assignment, submission?: AssignmentSubmission) {
    return {
      id: assignment.id,
      title: assignment.title,
      subject: assignment.subject,
      description: assignment.description,
      dueDate: assignment.dueDate,
      status: this.statusFor(assignment, submission),
      score: submission?.score ?? null,
      maxScore: assignment.maxScore,
      feedback: submission?.feedbackText ?? null,
      submittedAt: submission?.submittedAt ?? null,
      submittedContent: submission?.content ?? null,
    };
  }

  async listMine(user: User) {
    if (user.role !== UserRole.STUDENT) {
      throw new ForbiddenException('Only students can access assignments');
    }

    const classIds = await this.allowedClassIdsForStudent(user.id);
    const qb = this.assignmentRepo.createQueryBuilder('a').orderBy('a.due_date', 'ASC');
    if (classIds.length === 0) {
      qb.where('a.class_offering_id IS NULL');
    } else {
      qb.where('(a.class_offering_id IS NULL OR a.class_offering_id IN (:...classIds))', { classIds });
    }

    const assignments = await qb.getMany();
    if (assignments.length === 0) return [];

    const submissions = await this.submissionRepo.find({
      where: { assignmentId: In(assignments.map((a) => a.id)), studentId: user.id },
    });
    const subMap = new Map(submissions.map((s) => [s.assignmentId, s]));
    return assignments.map((a) => this.toDto(a, subMap.get(a.id)));
  }

  async getMineById(user: User, assignmentId: string) {
    if (user.role !== UserRole.STUDENT) {
      throw new ForbiddenException('Only students can access assignments');
    }
    const assignment = await this.assignmentRepo.findOne({ where: { id: assignmentId } });
    if (!assignment) throw new NotFoundException('Assignment not found');

    const classIds = await this.allowedClassIdsForStudent(user.id);
    const visible = !assignment.classOfferingId || classIds.includes(assignment.classOfferingId);
    if (!visible) throw new ForbiddenException('Cannot access this assignment');

    const submission = await this.submissionRepo.findOne({
      where: { assignmentId: assignment.id, studentId: user.id },
    });
    return this.toDto(assignment, submission ?? undefined);
  }

  async submitMine(user: User, assignmentId: string, content: string) {
    if (user.role !== UserRole.STUDENT) {
      throw new ForbiddenException('Only students can submit assignments');
    }
    const trimmed = content.trim();
    if (!trimmed) throw new BadRequestException('Submission content is required');

    const assignment = await this.assignmentRepo.findOne({ where: { id: assignmentId } });
    if (!assignment) throw new NotFoundException('Assignment not found');

    const classIds = await this.allowedClassIdsForStudent(user.id);
    const visible = !assignment.classOfferingId || classIds.includes(assignment.classOfferingId);
    if (!visible) throw new ForbiddenException('Cannot submit this assignment');

    const now = new Date();
    let row = await this.submissionRepo.findOne({
      where: { assignmentId: assignment.id, studentId: user.id },
    });

    if (!row) {
      row = this.submissionRepo.create({
        assignmentId: assignment.id,
        studentId: user.id,
        content: trimmed,
        submittedAt: now,
        score: null,
        feedbackText: null,
      });
    } else {
      row.content = trimmed;
      row.submittedAt = now;
    }

    const saved = await this.submissionRepo.save(row);
    return this.toDto(assignment, saved);
  }
}
