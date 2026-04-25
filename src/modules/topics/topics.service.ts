import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Topic } from './entities/topic.entity';
import { CreateTopicDto, UpdateTopicDto } from './dto/topic.dto';

@Injectable()
export class TopicsService {
  constructor(
    @InjectRepository(Topic)
    private readonly repo: Repository<Topic>,
  ) {}

  async create(dto: CreateTopicDto): Promise<Topic> {
    const topic = this.repo.create({
      name: dto.name,
      description: dto.description || null,
      subjectId: dto.subjectId,
      orderIndex: dto.orderIndex ?? 0,
    });
    return this.repo.save(topic);
  }

  async findBySubject(subjectId: string): Promise<Topic[]> {
    return this.repo.find({
      where: { subjectId },
      order: { orderIndex: 'ASC', name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Topic> {
    const topic = await this.repo.findOne({ where: { id } });
    if (!topic) throw new NotFoundException('Topic not found');
    return topic;
  }

  async update(id: string, dto: UpdateTopicDto): Promise<Topic> {
    const topic = await this.findOne(id);
    if (dto.name !== undefined) topic.name = dto.name;
    if (dto.description !== undefined) topic.description = dto.description;
    if (dto.orderIndex !== undefined) topic.orderIndex = dto.orderIndex;
    return this.repo.save(topic);
  }

  async remove(id: string): Promise<void> {
    const topic = await this.findOne(id);
    await this.repo.remove(topic);
  }
}
