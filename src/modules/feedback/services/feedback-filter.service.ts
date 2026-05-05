import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Feedback, FeedbackType, FeedbackSenderRole } from '../entities/feedback.entity';
import { User } from '../../users/entities/user.entity';

export interface FeedbackFilterCriteria {
  grade?: string;
  section?: string;
  dateFrom?: string;
  dateTo?: string;
  category?: FeedbackType;
  senderRole?: FeedbackSenderRole;
}

export interface EnrichedFeedback extends Feedback {
  submitterName?: string;
  submitterRole?: string;
  submitterGrade?: string;
  submitterSection?: string;
}

@Injectable()
export class FeedbackFilterService {
  constructor(
    @InjectRepository(Feedback)
    private readonly feedbackRepo: Repository<Feedback>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /**
   * Filter feedback with enriched submitter information
   */
  async filterFeedback(criteria: FeedbackFilterCriteria): Promise<EnrichedFeedback[]> {
    const qb = this.feedbackRepo
      .createQueryBuilder('feedback')
      .leftJoinAndSelect('users', 'user', 'user.id = feedback.author_id')
      .orderBy('feedback.created_at', 'DESC');

    // Filter by submitter's grade
    if (criteria.grade) {
      qb.andWhere('user.grade = :grade', { grade: criteria.grade });
    }

    // Filter by submitter's section
    if (criteria.section) {
      qb.andWhere('user.section = :section', { section: criteria.section });
    }

    // Filter by date range
    if (criteria.dateFrom) {
      qb.andWhere('feedback.created_at >= :dateFrom', { dateFrom: new Date(criteria.dateFrom) });
    }

    if (criteria.dateTo) {
      // Add one day to include the entire end date
      const endDate = new Date(criteria.dateTo);
      endDate.setDate(endDate.getDate() + 1);
      qb.andWhere('feedback.created_at < :dateTo', { dateTo: endDate });
    }

    // Filter by category
    if (criteria.category) {
      qb.andWhere('feedback.category = :category', { category: criteria.category });
    }

    // Filter by sender role
    if (criteria.senderRole) {
      qb.andWhere('feedback.sender_role = :senderRole', { senderRole: criteria.senderRole });
    }

    const feedbacks = await qb.getMany();

    // Enrich feedback with submitter information
    const enriched: EnrichedFeedback[] = await Promise.all(
      feedbacks.map(async (feedback) => {
        // Handle anonymous feedback
        if (feedback.isAnonymous || !feedback.authorId) {
          return {
            ...feedback,
            submitterName: 'Anonymous',
            submitterRole: feedback.senderRole ?? undefined,
            submitterGrade: undefined,
            submitterSection: undefined,
          };
        }

        // Fetch submitter details
        const submitter = await this.userRepo.findOne({ where: { id: feedback.authorId } });

        if (!submitter) {
          return {
            ...feedback,
            submitterName: 'Unknown User',
            submitterRole: feedback.senderRole ?? undefined,
            submitterGrade: undefined,
            submitterSection: undefined,
          };
        }

        return {
          ...feedback,
          submitterName: `${submitter.firstName} ${submitter.lastName}`,
          submitterRole: submitter.role,
          submitterGrade: submitter.grade ?? undefined,
          submitterSection: submitter.section ?? undefined,
        };
      }),
    );

    return enriched;
  }
}
