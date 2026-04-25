import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { MaterialType } from '../entities/learning-material.entity';

export class CreateLearningMaterialDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @IsEnum(MaterialType)
  type: MaterialType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  subject: string;

  @IsInt()
  grade: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  topicId?: string;

  @IsString()
  @IsNotEmpty()
  classOfferingId: string;

  @IsUrl()
  @IsOptional()
  link?: string;
}
