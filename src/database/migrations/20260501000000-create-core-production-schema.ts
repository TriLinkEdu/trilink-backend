import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCoreProductionSchema20260501000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS users (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        email varchar(255) NOT NULL UNIQUE,
        password_hash varchar(255) NOT NULL,
        role varchar(20) NOT NULL,
        first_name varchar(120) NOT NULL,
        last_name varchar(120) NOT NULL,
        phone varchar(40),
        profile_image_file_id uuid,
        grade varchar(40),
        section varchar(20),
        department varchar(120),
        subject varchar(120),
        homeroom_class varchar(80),
        experience varchar(120),
        country varchar(120),
        city_state varchar(120),
        postal_code varchar(40),
        office_room varchar(80),
        child_name varchar(200),
        occupation varchar(40),
        must_change_password boolean NOT NULL DEFAULT true,
        last_seen_at timestamp NULL,
        is_online boolean NOT NULL DEFAULT false,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS academic_years (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        label varchar(32) NOT NULL,
        start_date varchar(10) NOT NULL,
        end_date varchar(10) NOT NULL,
        is_active boolean NOT NULL DEFAULT false,
        is_archived boolean NOT NULL DEFAULT false,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS terms (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        academic_year_id uuid NOT NULL,
        name varchar(120) NOT NULL,
        start_date varchar(10) NOT NULL,
        end_date varchar(10) NOT NULL,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS grades (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        name varchar(80) NOT NULL UNIQUE,
        order_index int NOT NULL DEFAULT 0,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS sections (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        name varchar(40) NOT NULL UNIQUE,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS subjects (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        name varchar(120) NOT NULL,
        code varchar(40),
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS class_offerings (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        academic_year_id uuid NOT NULL,
        grade_id uuid NOT NULL,
        section_id uuid NOT NULL,
        subject_id uuid NOT NULL,
        teacher_id uuid NOT NULL,
        name varchar(200),
        course_code varchar(20),
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS enrollments (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        student_id uuid NOT NULL,
        class_offering_id uuid NOT NULL,
        academic_year_id uuid NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'active',
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS parent_students (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        parent_id uuid NOT NULL,
        student_id uuid NOT NULL,
        relation varchar(40) NOT NULL,
        is_primary boolean NOT NULL DEFAULT false,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        type varchar(20) NOT NULL,
        title varchar(200) NOT NULL,
        description text,
        class_offering_id uuid,
        parent_visible boolean NOT NULL DEFAULT true,
        created_by_id uuid NOT NULL,
        last_message_text varchar(500),
        last_message_at timestamp NULL,
        last_message_sender_id uuid,
        avatar_file_id uuid,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS conversation_members (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        conversation_id uuid NOT NULL,
        user_id uuid NOT NULL,
        role varchar(20) NOT NULL DEFAULT 'member',
        created_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        conversation_id uuid NOT NULL,
        sender_id uuid NOT NULL,
        text text,
        reply_to_id uuid,
        media_file_id uuid,
        media_type varchar(20),
        media_name varchar(255),
        media_mime_type varchar(120),
        media_size bigint,
        edited_at timestamp NULL,
        deleted_at timestamp NULL,
        reactions jsonb DEFAULT '{}'::jsonb,
        image_url varchar,
        type varchar NOT NULL DEFAULT 'text',
        created_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS chat_connections (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "requesterId" uuid NOT NULL,
        "recipientId" uuid NOT NULL,
        status varchar NOT NULL DEFAULT 'pending',
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS blocked_users (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "blockerId" uuid NOT NULL,
        "blockedId" uuid NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_enrollments_student_class ON enrollments (student_id, class_offering_id)`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_parent_students_parent_student ON parent_students (parent_id, student_id)`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_conversation_members_conversation_user ON conversation_members (conversation_id, user_id)`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_connections_requester_recipient ON chat_connections ("requesterId", "recipientId")`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_blocked_users_blocker_blocked ON blocked_users ("blockerId", "blockedId")`);
  }

  public async down(): Promise<void> {
    // Core production schema migration is intentionally non-destructive.
  }
}
