import { EnrollmentsService } from './enrollments.service';
import { BadRequestException } from '@nestjs/common';

// Minimal smoke unit tests for EnrollmentsService

describe('EnrollmentsService (unit)', () => {
  function makeService() {
    // Provide minimal mocked repositories and datasource
    const anyRepo = () => ({ find: jest.fn(), findOne: jest.fn(), save: jest.fn(), create: jest.fn(), remove: jest.fn() });
    const svc = new EnrollmentsService(
      anyRepo(), // repo
      anyRepo(), // userRepo
      anyRepo(), // classRepo
      anyRepo(), // gradeRepo
      anyRepo(), // sectionRepo
      anyRepo(), // subjectRepo
      anyRepo(), // psRepo
      anyRepo(), // yearRepo
      { transaction: async (cb: any) => cb({ getRepository: () => anyRepo() }) } as any,
    );
    return svc;
  }

  it('throws when assignStudentsToSection called with empty studentIds', async () => {
    const svc = makeService();
    await expect(svc.assignStudentsToSection({ gradeId: 'g', sectionId: 's', studentIds: [] as string[] })).rejects.toThrow(BadRequestException);
  });
});
