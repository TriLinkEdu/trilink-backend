import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClassOffering } from './entities/class-offering.entity';
import { User } from '../users/entities/user.entity';
import { ClassOfferingsService } from './class-offerings.service';
import { ClassOfferingsController } from './class-offerings.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ClassOffering, User])],
  controllers: [ClassOfferingsController],
  providers: [ClassOfferingsService],
  exports: [ClassOfferingsService],
})
export class ClassOfferingsModule {}
