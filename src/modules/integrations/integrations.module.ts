import { Module } from '@nestjs/common';
import { IntegrationsController } from './integrations.controller';
import { StudentSyncController } from './student-sync.controller';

@Module({
  controllers: [IntegrationsController, StudentSyncController],
})
export class IntegrationsModule {}
