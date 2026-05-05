import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class ProductionChatSystem20260503120000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. users: add presence columns ──────────────────────────────────────
    const hasLastSeen = await queryRunner.hasColumn('users', 'last_seen_at');
    if (!hasLastSeen) {
      await queryRunner.query(`ALTER TABLE users ADD COLUMN last_seen_at TIMESTAMP NULL`);
    }
    const hasIsOnline = await queryRunner.hasColumn('users', 'is_online');
    if (!hasIsOnline) {
      await queryRunner.query(`ALTER TABLE users ADD COLUMN is_online BOOLEAN NOT NULL DEFAULT false`);
    }

    // ── 2. conversations: add metadata columns ───────────────────────────────
    const convCols: [string, string][] = [
      ['last_message_text', 'VARCHAR(500) NULL'],
      ['last_message_at', 'TIMESTAMP NULL'],
      ['last_message_sender_id', 'UUID NULL'],
      ['avatar_file_id', 'UUID NULL'],
      ['description', 'TEXT NULL'],
    ];
    for (const [col, def] of convCols) {
      const exists = await queryRunner.hasColumn('conversations', col);
      if (!exists) {
        await queryRunner.query(`ALTER TABLE conversations ADD COLUMN ${col} ${def}`);
      }
    }

    // ── 3. conversation_members: add role column ─────────────────────────────
    const hasRole = await queryRunner.hasColumn('conversation_members', 'role');
    if (!hasRole) {
      await queryRunner.query(
        `ALTER TABLE conversation_members ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'member'`,
      );
    }

    // ── 4. chat_messages: add enriched columns ───────────────────────────────
    const msgCols: [string, string][] = [
      ['reply_to_id', 'UUID NULL'],
      ['media_file_id', 'UUID NULL'],
      ['media_type', 'VARCHAR(20) NULL'],
      ['media_name', 'VARCHAR(255) NULL'],
      ['media_mime_type', 'VARCHAR(120) NULL'],
      ['media_size', 'BIGINT NULL'],
      ['edited_at', 'TIMESTAMP NULL'],
      ['deleted_at', 'TIMESTAMP NULL'],
      ['reactions', "JSONB NULL DEFAULT '{}'"],
    ];
    for (const [col, def] of msgCols) {
      const exists = await queryRunner.hasColumn('chat_messages', col);
      if (!exists) {
        await queryRunner.query(`ALTER TABLE chat_messages ADD COLUMN ${col} ${def}`);
      }
    }

    // Make text nullable (was NOT NULL)
    await queryRunner.query(`ALTER TABLE chat_messages ALTER COLUMN text DROP NOT NULL`);

    // ── 5. conversation_reads table ──────────────────────────────────────────
    const readsExists = await queryRunner.hasTable('conversation_reads');
    if (!readsExists) {
      await queryRunner.createTable(
        new Table({
          name: 'conversation_reads',
          columns: [
            { name: 'user_id', type: 'uuid', isNullable: false },
            { name: 'conversation_id', type: 'uuid', isNullable: false },
            { name: 'last_read_message_id', type: 'uuid', isNullable: true },
            { name: 'last_read_at', type: 'timestamp', default: 'now()', isNullable: false },
          ],
        }),
        true,
      );

      await queryRunner.query(
        `ALTER TABLE conversation_reads ADD CONSTRAINT pk_conversation_reads PRIMARY KEY (user_id, conversation_id)`,
      );

      await queryRunner.createForeignKey(
        'conversation_reads',
        new TableForeignKey({
          columnNames: ['user_id'],
          referencedTableName: 'users',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      );
      await queryRunner.createForeignKey(
        'conversation_reads',
        new TableForeignKey({
          columnNames: ['conversation_id'],
          referencedTableName: 'conversations',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      );
      await queryRunner.createForeignKey(
        'conversation_reads',
        new TableForeignKey({
          columnNames: ['last_read_message_id'],
          referencedTableName: 'chat_messages',
          referencedColumnNames: ['id'],
          onDelete: 'SET NULL',
        }),
      );
    }

    // ── 6. user_blocks table ─────────────────────────────────────────────────
    const blocksExists = await queryRunner.hasTable('user_blocks');
    if (!blocksExists) {
      await queryRunner.createTable(
        new Table({
          name: 'user_blocks',
          columns: [
            { name: 'blocker_id', type: 'uuid', isNullable: false },
            { name: 'blocked_id', type: 'uuid', isNullable: false },
            { name: 'created_at', type: 'timestamp', default: 'now()', isNullable: false },
          ],
        }),
        true,
      );

      await queryRunner.query(
        `ALTER TABLE user_blocks ADD CONSTRAINT pk_user_blocks PRIMARY KEY (blocker_id, blocked_id)`,
      );

      await queryRunner.createForeignKey(
        'user_blocks',
        new TableForeignKey({
          columnNames: ['blocker_id'],
          referencedTableName: 'users',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      );
      await queryRunner.createForeignKey(
        'user_blocks',
        new TableForeignKey({
          columnNames: ['blocked_id'],
          referencedTableName: 'users',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      );
    }

    // ── 7. Indexes for performance ───────────────────────────────────────────
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_chat_messages_conv_created ON chat_messages (conversation_id, created_at DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_chat_messages_deleted ON chat_messages (conversation_id) WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_conv_members_user ON conversation_members (user_id)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS user_blocks`);
    await queryRunner.query(`DROP TABLE IF EXISTS conversation_reads`);

    const msgDropCols = [
      'reply_to_id', 'media_file_id', 'media_type', 'media_name',
      'media_mime_type', 'media_size', 'edited_at', 'deleted_at', 'reactions',
    ];
    for (const col of msgDropCols) {
      const exists = await queryRunner.hasColumn('chat_messages', col);
      if (exists) await queryRunner.query(`ALTER TABLE chat_messages DROP COLUMN ${col}`);
    }

    const convDropCols = [
      'last_message_text', 'last_message_at', 'last_message_sender_id',
      'avatar_file_id', 'description',
    ];
    for (const col of convDropCols) {
      const exists = await queryRunner.hasColumn('conversations', col);
      if (exists) await queryRunner.query(`ALTER TABLE conversations DROP COLUMN ${col}`);
    }

    const hasRole = await queryRunner.hasColumn('conversation_members', 'role');
    if (hasRole) await queryRunner.query(`ALTER TABLE conversation_members DROP COLUMN role`);

    const hasLastSeen = await queryRunner.hasColumn('users', 'last_seen_at');
    if (hasLastSeen) await queryRunner.query(`ALTER TABLE users DROP COLUMN last_seen_at`);

    const hasIsOnline = await queryRunner.hasColumn('users', 'is_online');
    if (hasIsOnline) await queryRunner.query(`ALTER TABLE users DROP COLUMN is_online`);
  }
}
