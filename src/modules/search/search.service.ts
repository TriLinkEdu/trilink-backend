import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Subject } from '../school-structure/entities/subject.entity';
import { ClassOffering } from '../class-offerings/entities/class-offering.entity';
import { Grade } from '../school-structure/entities/grade.entity';
import { Section } from '../school-structure/entities/section.entity';

export interface SearchResult {
  entityType: 'user' | 'classOffering' | 'subject';
  id: string;
  title: string;
  subtitle?: string;
  metadata?: Record<string, any>;
}

export interface SearchResponse {
  users: SearchResult[];
  classOfferings: SearchResult[];
  subjects: SearchResult[];
  totalResults: number;
}

@Injectable()
export class GlobalSearchService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Subject)
    private readonly subjectRepo: Repository<Subject>,
    @InjectRepository(ClassOffering)
    private readonly classOfferingRepo: Repository<ClassOffering>,
    @InjectRepository(Grade)
    private readonly gradeRepo: Repository<Grade>,
    @InjectRepository(Section)
    private readonly sectionRepo: Repository<Section>,
  ) {}

  /**
   * Global search across multiple entity types
   * @param query - Search query string
   * @returns SearchResponse with results grouped by entity type
   */
  async search(query: string): Promise<SearchResponse> {
    // Sanitize query to prevent SQL injection
    const sanitizedQuery = this.sanitizeQuery(query);

    if (!sanitizedQuery || sanitizedQuery.length < 2) {
      return {
        users: [],
        classOfferings: [],
        subjects: [],
        totalResults: 0,
      };
    }

    // Execute searches in parallel
    const [users, classOfferings, subjects] = await Promise.all([
      this.searchUsers(sanitizedQuery),
      this.searchClassOfferings(sanitizedQuery),
      this.searchSubjects(sanitizedQuery),
    ]);

    return {
      users,
      classOfferings,
      subjects,
      totalResults: users.length + classOfferings.length + subjects.length,
    };
  }

  /**
   * Search users by name and email using full-text search
   */
  private async searchUsers(query: string): Promise<SearchResult[]> {
    const users = await this.userRepo
      .createQueryBuilder('user')
      .where(
        `to_tsvector('english', 
          coalesce(user.first_name, '') || ' ' || 
          coalesce(user.last_name, '') || ' ' || 
          coalesce(user.email, '')
        ) @@ plainto_tsquery('english', :query)`,
        { query },
      )
      .orWhere('user.first_name ILIKE :likeQuery', { likeQuery: `%${query}%` })
      .orWhere('user.last_name ILIKE :likeQuery', { likeQuery: `%${query}%` })
      .orWhere('user.email ILIKE :likeQuery', { likeQuery: `%${query}%` })
      .limit(5)
      .getMany();

    return users.map((user) => ({
      entityType: 'user' as const,
      id: user.id,
      title: `${user.firstName} ${user.lastName}`,
      subtitle: `${user.role} - ${user.email}`,
      metadata: {
        role: user.role,
        email: user.email,
        grade: user.grade,
        section: user.section,
      },
    }));
  }

  /**
   * Search class offerings by name, subject, grade, and section
   */
  private async searchClassOfferings(query: string): Promise<SearchResult[]> {
    const classOfferings = await this.classOfferingRepo
      .createQueryBuilder('offering')
      .leftJoinAndSelect('subjects', 'subject', 'subject.id = offering.subject_id')
      .leftJoinAndSelect('grades', 'grade', 'grade.id = offering.grade_id')
      .leftJoinAndSelect('sections', 'section', 'section.id = offering.section_id')
      .where('offering.name ILIKE :likeQuery', { likeQuery: `%${query}%` })
      .orWhere('subject.name ILIKE :likeQuery', { likeQuery: `%${query}%` })
      .orWhere('grade.name ILIKE :likeQuery', { likeQuery: `%${query}%` })
      .orWhere('section.name ILIKE :likeQuery', { likeQuery: `%${query}%` })
      .limit(5)
      .getRawMany();

    // Fetch related entities for enrichment
    const enrichedResults = await Promise.all(
      classOfferings.map(async (raw) => {
        const subject = await this.subjectRepo.findOne({ where: { id: raw.offering_subject_id } });
        const grade = await this.gradeRepo.findOne({ where: { id: raw.offering_grade_id } });
        const section = await this.sectionRepo.findOne({ where: { id: raw.offering_section_id } });

        const title = raw.offering_name || `${subject?.name || 'Unknown Subject'}`;
        const subtitle = `${grade?.name || 'Unknown Grade'} - ${section?.name || 'Unknown Section'}`;

        return {
          entityType: 'classOffering' as const,
          id: raw.offering_id,
          title,
          subtitle,
          metadata: {
            subjectName: subject?.name,
            gradeName: grade?.name,
            sectionName: section?.name,
          },
        };
      }),
    );

    return enrichedResults;
  }

  /**
   * Search subjects by name and code using full-text search
   */
  private async searchSubjects(query: string): Promise<SearchResult[]> {
    const subjects = await this.subjectRepo
      .createQueryBuilder('subject')
      .where(
        `to_tsvector('english', 
          coalesce(subject.name, '') || ' ' || 
          coalesce(subject.code, '')
        ) @@ plainto_tsquery('english', :query)`,
        { query },
      )
      .orWhere('subject.name ILIKE :likeQuery', { likeQuery: `%${query}%` })
      .orWhere('subject.code ILIKE :likeQuery', { likeQuery: `%${query}%` })
      .limit(5)
      .getMany();

    return subjects.map((subject) => ({
      entityType: 'subject' as const,
      id: subject.id,
      title: subject.name,
      subtitle: subject.code ? `Code: ${subject.code}` : undefined,
      metadata: {
        code: subject.code,
      },
    }));
  }

  /**
   * Sanitize search query to prevent SQL injection
   */
  private sanitizeQuery(query: string): string {
    if (!query) return '';

    // Remove special characters that could be used for SQL injection
    // Keep alphanumeric, spaces, hyphens, and underscores
    return query
      .trim()
      .replace(/[^\w\s-]/g, '')
      .substring(0, 100); // Limit query length
  }
}
