import 'dotenv/config';
import { DataSource } from 'typeorm';
import { getPostgresConnectionFromEnv } from '../database/postgres-env';
import { TYPEORM_ENTITIES } from '../database/typeorm-entities';

async function test() {
  const config = {
    type: 'postgres' as const,
    ...getPostgresConnectionFromEnv(),
    entities: TYPEORM_ENTITIES,
    synchronize: false,
  };

  const dataSource = new DataSource(config);
  await dataSource.initialize();

  try {
    const repo = dataSource.getRepository('ClassOffering');
    const co = await repo.findOne({ where: { id: '01d27695-d6ba-4fe3-b683-899c870295c7' } });
    console.log('ClassOffering loaded via TypeORM findOne:');
    console.log('  id:', co?.id);
    console.log('  teacherId:', co?.teacherId);
    console.log('  teacherId type:', typeof co?.teacherId);
    console.log('  teacher relation:', co?.teacher);

    // Also check GradeEntry
    const gradeRepo = dataSource.getRepository('GradeEntry');
    const entry = await gradeRepo.findOne({ where: { id: '8b5861dc-b34a-4583-8878-95dbababf1a0' } });
    console.log('\nGradeEntry loaded via TypeORM findOne:');
    console.log('  id:', entry?.id);
    console.log('  teacherId:', entry?.teacherId);
    console.log('  teacherId type:', typeof entry?.teacherId);
    console.log('  classOfferingId:', entry?.classOfferingId);
  } finally {
    await dataSource.destroy();
  }
}

test().catch((err) => {
  console.error(err);
  process.exit(1);
});
