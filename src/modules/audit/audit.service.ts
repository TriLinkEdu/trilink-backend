import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

@Injectable()
export class AuditService {
  constructor(@InjectRepository(AuditLog) private readonly repo: Repository<AuditLog>) {}

  async log(actorId: string, action: string, entityType: string, entityId: string, diffJson?: string) {
    return this.repo.save(this.repo.create({ actorId, action, entityType, entityId, diffJson: diffJson ?? null }));
  }

  list(limit = 100) {
    return this.repo.find({ order: { createdAt: 'DESC' }, take: limit });
  }
}
