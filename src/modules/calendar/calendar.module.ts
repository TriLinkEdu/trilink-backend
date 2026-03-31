import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalendarEvent } from './entities/calendar-event.entity';
import { CalendarService } from './calendar.service';
import { CalendarController } from './calendar.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CalendarEvent])],
  controllers: [CalendarController],
  providers: [CalendarService],
  exports: [CalendarService],
})
export class CalendarModule {}
