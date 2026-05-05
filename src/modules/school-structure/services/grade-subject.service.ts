import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GradeSubjectAssignment } from '../entities/grade-subject-assignment.entity';
import { Grade } from '../entities/grade.entity';
import { Subject } from '../entities/subject.entity';

@Injectable()
export class GradeSubjectService {
  constructor(
    @InjectRepository(GradeSubjectAssignment)
    private readonly gradeSubjectRepo: Repository<GradeSubjectAssignment>,
    @InjectRepository(Grade)
    private readonly gradeRepo: Repository<Grade>,
    @InjectRepository(Subject)
    private readonly subjectRepo: Repository<Subject>,
  ) {}

  async assignSubjectToGrade(gradeId: string, subjectId: string): Promise<GradeSubjectAssignment> {
    const grade = await this.gradeRepo.findOne({ where: { id: gradeId } });
    if (!grade) throw new NotFoundException(`Grade with ID ${gradeId} not found`);

    const subject = await this.subjectRepo.findOne({ where: { id: subjectId } });
    if (!subject) throw new NotFoundException(`Subject with ID ${subjectId} not found`);

    const existing = await this.gradeSubjectRepo.findOne({ where: { gradeId, subjectId } });
    if (existing) {
      throw new ConflictException(
        `Subject "${subject.name}" is already assigned to grade "${grade.name}"`,
      );
    }

    const assignment = this.gradeSubjectRepo.create({ gradeId, subjectId });
    return this.gradeSubjectRepo.save(assignment);
  }

  async getSubjectsForGrade(gradeId: string): Promise<Subject[]> {
    const grade = await this.gradeRepo.findOne({ where: { id: gradeId } });
    if (!grade) throw new NotFoundException(`Grade with ID ${gradeId} not found`);

    const assignments = await this.gradeSubjectRepo.find({
      where: { gradeId },
      relations: ['subject'],
    });

    return assignments.map((a) => a.subject);
  }

  async removeSubjectFromGrade(gradeId: string, subjectId: string): Promise<void> {
    const assignment = await this.gradeSubjectRepo.findOne({ where: { gradeId, subjectId } });
    if (!assignment) {
      throw new NotFoundException(
        `No assignment found for grade ID ${gradeId} and subject ID ${subjectId}`,
      );
    }
    await this.gradeSubjectRepo.remove(assignment);
  }
}
