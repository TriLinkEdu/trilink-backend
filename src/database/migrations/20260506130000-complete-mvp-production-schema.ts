import { MigrationInterface, QueryRunner } from 'typeorm';

export class CompleteMvpProductionSchema20260506130000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS calendar_events (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        academic_year_id uuid NOT NULL,
        title varchar(200) NOT NULL,
        date varchar(10) NOT NULL,
        time varchar(8),
        type varchar(20) NOT NULL,
        description text,
        class_offering_id uuid,
        created_by_id uuid NOT NULL,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS attendance_sessions (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        class_offering_id uuid NOT NULL,
        date varchar(10) NOT NULL,
        taken_by_id uuid NOT NULL,
        created_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS attendance_marks (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        session_id uuid NOT NULL,
        student_id uuid NOT NULL,
        status varchar(20) NOT NULL,
        note varchar(255),
        created_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS questions (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        type varchar(20) NOT NULL,
        stem text NOT NULL,
        options_json text,
        answer_key text,
        attachments_json text,
        subject_id uuid NOT NULL,
        created_by_id uuid NOT NULL,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS exams (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        title varchar(200) NOT NULL,
        academic_year_id uuid NOT NULL,
        class_offering_id uuid,
        opens_at timestamp NOT NULL,
        closes_at timestamp NOT NULL,
        duration_minutes int NOT NULL,
        min_stay_minutes int NOT NULL DEFAULT 0,
        max_points int NOT NULL DEFAULT 100,
        published boolean NOT NULL DEFAULT false,
        created_by_id uuid NOT NULL,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS exam_questions (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        exam_id uuid NOT NULL,
        question_id uuid NOT NULL,
        order_index int NOT NULL,
        points int NOT NULL DEFAULT 1,
        created_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS exam_attempts (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        exam_id uuid NOT NULL,
        student_id uuid NOT NULL,
        started_at timestamp NOT NULL,
        submitted_at timestamp NULL,
        answers_json text NOT NULL DEFAULT '{}',
        score double precision,
        auto_score double precision,
        breakdown_json text,
        violations_json text,
        is_locked boolean NOT NULL DEFAULT false,
        lock_reason varchar(255),
        locked_at timestamp NULL,
        reentry_allowed boolean NOT NULL DEFAULT false,
        needs_manual_grading boolean NOT NULL DEFAULT false,
        released_at timestamp NULL,
        graded_by_id uuid,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS announcements (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        academic_year_id uuid NOT NULL,
        title varchar(200) NOT NULL,
        body text NOT NULL,
        audience varchar(40) NOT NULL,
        class_offering_id uuid,
        target_grade varchar(40),
        author_id uuid NOT NULL,
        publish_at timestamp NULL,
        realtime_sent boolean NOT NULL DEFAULT false,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS feedbacks (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        author_id uuid,
        sender_role varchar(20),
        type varchar NOT NULL DEFAULT 'general',
        message text NOT NULL,
        status varchar(40) NOT NULL DEFAULT 'open',
        assignee_id uuid,
        subject_id uuid,
        teacher_id uuid,
        is_anonymous boolean NOT NULL DEFAULT false,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id uuid NOT NULL,
        type varchar(60) NOT NULL,
        title varchar(200) NOT NULL,
        body text NOT NULL,
        payload_json text,
        read_at timestamp NULL,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS file_records (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        filename varchar(255) NOT NULL,
        mime varchar(120) NOT NULL,
        path varchar(500) NOT NULL,
        storage_provider varchar(32) NOT NULL DEFAULT 'cloudinary',
        storage_key varchar(500),
        version varchar(120),
        etag varchar(255),
        size_bytes bigint,
        uploaded_by_id uuid NOT NULL,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        actor_id uuid NOT NULL,
        action varchar(120) NOT NULL,
        entity_type varchar(120) NOT NULL,
        entity_id varchar(64) NOT NULL,
        diff_json text,
        created_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_settings (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id uuid NOT NULL,
        settings_json text NOT NULL DEFAULT '{}',
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS school_settings (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        settings_json text NOT NULL DEFAULT '{}',
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS badges (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        key varchar(64) NOT NULL UNIQUE,
        name varchar(120) NOT NULL,
        description text,
        icon_key varchar(64),
        points_value int NOT NULL DEFAULT 0,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_badges (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id uuid NOT NULL,
        badge_id uuid NOT NULL,
        awarded_at timestamp NOT NULL DEFAULT now(),
        awarded_by_id uuid,
        points_earned integer NOT NULL DEFAULT 0
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS login_streaks (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id uuid NOT NULL UNIQUE,
        current_streak int NOT NULL DEFAULT 0,
        longest_streak int NOT NULL DEFAULT 0,
        last_login_date date,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS achievements (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        key varchar(64) NOT NULL UNIQUE,
        title varchar(120) NOT NULL,
        description text,
        icon_url varchar(255),
        category varchar(20) NOT NULL,
        unlock_condition jsonb NOT NULL,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_achievements (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id uuid NOT NULL,
        achievement_id uuid NOT NULL,
        unlocked_at timestamp,
        progress_data jsonb,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS student_goals (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        student_id uuid NOT NULL,
        title varchar(200) NOT NULL,
        description text,
        target_date varchar(32),
        status varchar(20) NOT NULL DEFAULT 'active',
        progress_percent int NOT NULL DEFAULT 0,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS student_profiles (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id uuid NOT NULL UNIQUE,
        bio text,
        avatar_file_id uuid,
        extra_json text,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS grade_entries (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        class_offering_id uuid NOT NULL,
        student_id uuid NOT NULL,
        teacher_id uuid NOT NULL,
        title varchar(200) NOT NULL,
        type varchar NOT NULL DEFAULT 'other',
        score double precision,
        max_score double precision NOT NULL DEFAULT 100,
        note text,
        exam_attempt_id uuid,
        released_at timestamp NULL,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS assignments (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        class_offering_id uuid NOT NULL,
        teacher_id uuid NOT NULL,
        title varchar(200) NOT NULL,
        description text,
        submission_type varchar NOT NULL DEFAULT 'file',
        attachment_file_id uuid,
        deadline timestamp NOT NULL,
        max_score double precision NOT NULL DEFAULT 100,
        published boolean NOT NULL DEFAULT false,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS assignment_submissions (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        assignment_id uuid NOT NULL,
        student_id uuid NOT NULL,
        status varchar NOT NULL DEFAULT 'pending',
        file_id uuid,
        text_content text,
        submitted_at timestamp NULL,
        score double precision,
        feedback text,
        released_at timestamp NULL,
        graded_by_id uuid,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS textbooks (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        title varchar(255) NOT NULL,
        subject varchar(100) NOT NULL,
        grade int NOT NULL,
        description text,
        page_count int,
        size_bytes bigint,
        is_active boolean NOT NULL DEFAULT true,
        file_record_id uuid NOT NULL,
        cover_image_file_id uuid,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS topics (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        title varchar(255) NOT NULL,
        description text,
        subject_id uuid NOT NULL,
        order_index int NOT NULL DEFAULT 0,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS learning_materials (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        title varchar(255) NOT NULL,
        type varchar NOT NULL,
        url varchar(500) NOT NULL,
        subject varchar(100) NOT NULL,
        grade int NOT NULL,
        description text,
        topic_id uuid,
        uploaded_by_id uuid NOT NULL,
        class_offering_id uuid NOT NULL,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await this.addColumnIfMissing(queryRunner, 'chat_messages', 'image_url', 'varchar');
    await this.addColumnIfMissing(queryRunner, 'chat_messages', 'type', `varchar NOT NULL DEFAULT 'text'`);
    await this.addColumnIfMissing(queryRunner, 'file_records', 'storage_provider', `varchar(32) NOT NULL DEFAULT 'cloudinary'`);
    await this.addColumnIfMissing(queryRunner, 'file_records', 'storage_key', 'varchar(500)');
    await this.addColumnIfMissing(queryRunner, 'file_records', 'version', 'varchar(120)');
    await this.addColumnIfMissing(queryRunner, 'file_records', 'etag', 'varchar(255)');
    await this.addColumnIfMissing(queryRunner, 'file_records', 'size_bytes', 'bigint');

    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_sessions_class_date ON attendance_sessions (class_offering_id, date)`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_marks_session_student ON attendance_marks (session_id, student_id)`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_exam_attempts_exam_student ON exam_attempts (exam_id, student_id)`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_exam_questions_exam_order ON exam_questions (exam_id, order_index)`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_user_badges_user_badge ON user_badges (user_id, badge_id)`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_user_achievements_user_achievement ON user_achievements (user_id, achievement_id)`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_assignment_submissions_assignment_student ON assignment_submissions (assignment_id, student_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications (user_id, read_at)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_grade_entries_class_student_title ON grade_entries (class_offering_id, student_id, title)`);
  }

  public async down(): Promise<void> {
    // Completion migration is intentionally non-destructive.
  }

  private async addColumnIfMissing(queryRunner: QueryRunner, table: string, column: string, definition: string) {
    const exists = await queryRunner.hasColumn(table, column);
    if (!exists) {
      await queryRunner.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  }
}
