import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GradeSectionAssignment } from '../entities/grade-section-assignment.entity';
import { Grade } from '../entities/grade.entity';
import { Section } from '../entities/section.entity';
import { ClassOffering } from '../../class-offerings/entities/class-offering.entity';

@Injectable()
export class GradeSectionService {
  constructor(
    @InjectRepository(GradeSectionAssignment)
    private readonly gradeSectionRepo: Repository<GradeSectionAssignment>,
    @InjectRepository(Grade)
    private readonly gradeRepo: Repository<Grade>,
    @InjectRepository(Section)
    private readonly sectionRepo: Repository<Section>,
    @InjectRepository(ClassOffering)
    private readonly offeringRepo: Repository<ClassOffering>,
  ) {}

  /**
   * Assign a section to a grade
   */
  async assignSectionToGrade(gradeId: string, sectionId: string): Promise<GradeSectionAssignment> {
    // Verify grade exists
    const grade = await this.gradeRepo.findOne({ where: { id: gradeId } });
    if (!grade) {
      throw new NotFoundException(`Grade with ID ${gradeId} not found`);
    }

    // Verify section exists
    const section = await this.sectionRepo.findOne({ where: { id: sectionId } });
    if (!section) {
      throw new NotFoundException(`Section with ID ${sectionId} not found`);
    }

    // Check if assignment already exists
    const existing = await this.gradeSectionRepo.findOne({
      where: { gradeId, sectionId },
    });

    if (existing) {
      throw new ConflictException(
        `Section "${section.name}" is already assigned to grade "${grade.name}"`,
      );
    }

    // Create assignment
    const assignment = this.gradeSectionRepo.create({
      gradeId,
      sectionId,
    });

    return this.gradeSectionRepo.save(assignment);
  }

  /**
   * Get all sections for a specific grade
   */
  async getSectionsForGrade(gradeId: string): Promise<Section[]> {
    // Verify grade exists
    const grade = await this.gradeRepo.findOne({ where: { id: gradeId } });
    if (!grade) {
      throw new NotFoundException(`Grade with ID ${gradeId} not found`);
    }

    // Get all assignments for this grade
    const assignments = await this.gradeSectionRepo.find({
      where: { gradeId },
      relations: ['section'],
    });

    // Extract sections from assignments
    return assignments.map((assignment) => assignment.section);
  }

  /**
   * Get available sections for class offering creation
   * Excludes sections already used for the grade+subject combination
   */
  async getAvailableSections(
    gradeId: string,
    subjectId: string,
    academicYearId: string,
  ): Promise<Section[]> {
    // Get all sections assigned to this grade
    const allSections = await this.getSectionsForGrade(gradeId);

    // Get existing class offerings for this grade+subject+year combination
    const existingOfferings = await this.offeringRepo.find({
      where: {
        gradeId,
        subjectId,
        academicYearId,
      },
    });

    // Extract section IDs that are already used
    const usedSectionIds = new Set(existingOfferings.map((offering) => offering.sectionId));

    // Filter out sections that are already used
    return allSections.filter((section) => !usedSectionIds.has(section.id));
  }

  /**
   * Remove section assignment from grade
   */
  async removeSectionFromGrade(gradeId: string, sectionId: string): Promise<void> {
    const assignment = await this.gradeSectionRepo.findOne({
      where: { gradeId, sectionId },
    });

    if (!assignment) {
      throw new NotFoundException(
        `No assignment found for grade ID ${gradeId} and section ID ${sectionId}`,
      );
    }

    await this.gradeSectionRepo.remove(assignment);
  }
}
