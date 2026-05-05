import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Term } from '../entities/term.entity';
import { AcademicYear } from '../entities/academic-year.entity';

@Injectable()
export class TermDateValidator {
  constructor(
    @InjectRepository(Term)
    private readonly termRepo: Repository<Term>,
    @InjectRepository(AcademicYear)
    private readonly yearRepo: Repository<AcademicYear>,
  ) {}

  /**
   * Validates that term dates fall within academic year boundaries
   * @throws BadRequestException if validation fails
   */
  validateTermDates(
    termStart: string,
    termEnd: string,
    yearStart: string,
    yearEnd: string,
  ): void {
    // Convert string dates to Date objects for comparison
    const termStartDate = new Date(termStart);
    const termEndDate = new Date(termEnd);
    const yearStartDate = new Date(yearStart);
    const yearEndDate = new Date(yearEnd);

    // Validate term start date is not before academic year start date
    if (termStartDate < yearStartDate) {
      throw new BadRequestException(
        `Term start date (${termStart}) is before academic year start date (${yearStart})`,
      );
    }

    // Validate term end date is not after academic year end date
    if (termEndDate > yearEndDate) {
      throw new BadRequestException(
        `Term end date (${termEnd}) is after academic year end date (${yearEnd})`,
      );
    }

    // Additional validation: term start should be before or equal to term end
    if (termStartDate > termEndDate) {
      throw new BadRequestException(
        `Term start date (${termStart}) cannot be after term end date (${termEnd})`,
      );
    }
  }

  /**
   * Validates all existing terms when academic year dates change
   * @returns Array of invalid term IDs
   */
  async validateExistingTerms(
    yearId: string,
    newYearStart: string,
    newYearEnd: string,
  ): Promise<string[]> {
    // Fetch all terms for this academic year
    const terms = await this.termRepo.find({
      where: { academicYearId: yearId },
    });

    const invalidTermIds: string[] = [];
    const newYearStartDate = new Date(newYearStart);
    const newYearEndDate = new Date(newYearEnd);

    // Check each term against the new year boundaries
    for (const term of terms) {
      const termStartDate = new Date(term.startDate);
      const termEndDate = new Date(term.endDate);

      // Check if term falls outside new year boundaries
      if (termStartDate < newYearStartDate || termEndDate > newYearEndDate) {
        invalidTermIds.push(term.id);
      }
    }

    return invalidTermIds;
  }
}
