import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { seedGamification } from './gamification.seed';

// Load environment variables
config();

async function runSeeds() {
  console.log('🌱 Starting database seeding...\n');

  // Create DataSource
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5433'),
    username: process.env.DB_USERNAME || 'trilink',
    password: process.env.DB_PASSWORD || 'trilink_password',
    database: process.env.DB_NAME || 'trilink',
    synchronize: false,
    logging: false,
  });

  try {
    await dataSource.initialize();
    console.log('✅ Database connection established\n');

    // Run gamification seed
    await seedGamification(dataSource);

    console.log('\n✅ All seeds completed successfully!');
    console.log('\n📝 Test credentials:');
    console.log('   Teacher: teacher@trilink.edu / Teacher@123');
    console.log('   Students: student1@trilink.edu / Student1@123');
    console.log('             student2@trilink.edu / Student2@123');
    console.log('             ... (up to student10)');
    console.log('\n🧪 Test the quiz system:');
    console.log('   1. Login as student1@trilink.edu');
    console.log('   2. Navigate to Gamification tab');
    console.log('   3. Click "Quick Quizzes"');
    console.log('   4. Should see 4 quizzes (Math, Science, English, History)');
    console.log('   5. Questions will load from AI engine (1,060 available)');

  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
    console.log('\n🔌 Database connection closed');
  }
}

// Run seeds
runSeeds();
