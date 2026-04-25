export class LearningMaterialResponseDto {
  id: string;
  title: string;
  type: string;
  url: string;
  subject: string;
  grade: number;
  description: string | null;
  topicId: string | null;
  uploadedById: string;
  classOfferingId: string;
  createdAt: string;
}
