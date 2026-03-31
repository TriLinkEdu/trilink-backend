import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserSettings } from './entities/user-settings.entity';
import { SchoolSettings } from './entities/school-settings.entity';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(UserSettings) private readonly userSet: Repository<UserSettings>,
    @InjectRepository(SchoolSettings) private readonly schoolSet: Repository<SchoolSettings>,
  ) {}

  async getUser(userId: string) {
    let row = await this.userSet.findOne({ where: { userId } });
    if (!row) row = await this.userSet.save(this.userSet.create({ userId, settingsJson: '{}' }));
    return row;
  }

  async patchUser(userId: string, settingsJson: string) {
    let row = await this.userSet.findOne({ where: { userId } });
    if (!row) row = this.userSet.create({ userId, settingsJson });
    else row.settingsJson = settingsJson;
    return this.userSet.save(row);
  }

  async getSchool() {
    let row = await this.schoolSet.findOne({ where: {} });
    if (!row) row = await this.schoolSet.save(this.schoolSet.create({ settingsJson: '{}' }));
    return row;
  }

  async patchSchool(settingsJson: string) {
    let row = await this.schoolSet.findOne({ where: {} });
    if (!row) row = this.schoolSet.create({ settingsJson });
    else row.settingsJson = settingsJson;
    return this.schoolSet.save(row);
  }
}
