/**
 * Bulk-upload the 5 Ethiopian Grade 9 textbook PDFs to Cloudinary.
 *
 * For each PDF:
 *   1. Uploads the raw PDF  → trilink_uploads/textbooks/{subject}/
 *   2. Renders page 1 via pdftoppm → uploads PNG cover → trilink_uploads/textbooks/{subject}/covers/
 *   3. Creates FileRecord rows in the DB
 *   4. Creates a Textbook row linking both
 *
 * Run:
 *   npx ts-node -r tsconfig-paths/register src/scripts/upload-textbooks.ts
 *
 * Requires:
 *   - CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET in .env
 *   - DATABASE_URL (or DB_*) in .env
 *   - poppler-utils installed (`sudo apt install poppler-utils`)
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { v2 as cloudinary } from 'cloudinary';
import { DataSource } from 'typeorm';
import { FileRecord } from '../modules/files/entities/file-record.entity';
import { Textbook } from '../modules/textbooks/entities/textbook.entity';

// ── Textbook manifest ──────────────────────────────────────────────────────
// src/scripts/ → trilink-backend/ → web/ → trilink/ → ai-engine/data/textbooks
const TEXTBOOKS_DIR = path.resolve(__dirname, '../../../../ai-engine/data/textbooks');

const MANIFEST = [
  {
    filename: 'grade-9-mathematics-new-curriculum--student-textbook-_kehulum_com_0fa6.pdf',
    subject:  'Mathematics',
    grade:    9,
    title:    'Grade 9 Mathematics — New Curriculum (Ethiopian)',
    description: 'Official Ethiopian Grade 9 mathematics student textbook covering algebra, geometry, trigonometry, statistics and probability.',
  },
  {
    filename: 'grade-9-physics-new-curriculum--student-textbook-kehulumcom1759930084a307.pdf',
    subject:  'Physics',
    grade:    9,
    title:    'Grade 9 Physics — New Curriculum (Ethiopian)',
    description: 'Official Ethiopian Grade 9 physics student textbook covering motion, forces, energy, waves and thermodynamics.',
  },
  {
    filename: 'grade-9-chemistry-new-curriculum--student-textbook-kehulumcom1759931286d445.pdf',
    subject:  'Chemistry',
    grade:    9,
    title:    'Grade 9 Chemistry — New Curriculum (Ethiopian)',
    description: 'Official Ethiopian Grade 9 chemistry student textbook covering atomic theory, the periodic table and chemical reactions.',
  },
  {
    filename: 'grade-9-biology-new-curriculum--student-textbook-kehulumcom17599334842417.pdf',
    subject:  'Biology',
    grade:    9,
    title:    'Grade 9 Biology — New Curriculum (Ethiopian)',
    description: 'Official Ethiopian Grade 9 biology student textbook covering cell biology, genetics, classification and ecology.',
  },
  {
    filename: 'grade-9-history-new-curriculum--student-textbook-kehulumcom17599332397bc8.pdf',
    subject:  'History',
    grade:    9,
    title:    'Grade 9 History — New Curriculum (Ethiopian)',
    description: 'Official Ethiopian Grade 9 history student textbook covering ancient civilizations, African kingdoms and modern revolutions.',
  },
] as const;

// ── Cloudinary config ──────────────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ── TypeORM DataSource ─────────────────────────────────────────────────────
function buildDataSource(): DataSource {
  const url = process.env.DATABASE_URL;
  if (url) {
    return new DataSource({
      type: 'postgres',
      url,
      // Neon requires SSL; do NOT set rejectUnauthorized:false — use the URL sslmode param
      ssl: true,
      synchronize: false,
      entities: [FileRecord, Textbook],
      connectTimeoutMS: 15000,
    });
  }
  return new DataSource({
    type: 'postgres',
    host:     process.env.DB_HOST     || 'localhost',
    port:     Number(process.env.DB_PORT || 5433),
    username: process.env.DB_USERNAME || 'trilink',
    password: process.env.DB_PASSWORD || 'trilink_secret',
    database: process.env.DB_DATABASE || 'trilink',
    synchronize: false,
    entities: [FileRecord, Textbook],
    connectTimeoutMS: 15000,
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function uploadToCloudinary(
  filePath: string,
  folder: string,
  resourceType: 'raw' | 'image' = 'raw',
): Promise<{ publicId: string; url: string; version: string; sizeBytes: number }> {
  const result = await cloudinary.uploader.upload(filePath, {
    folder,
    resource_type: resourceType,
    use_filename: true,
    unique_filename: false,
    overwrite: true,
  });
  return {
    publicId:  result.public_id,
    url:       result.secure_url,
    version:   String(result.version),
    sizeBytes: result.bytes,
  };
}

function renderCoverPage(pdfPath: string, outDir: string, stem: string): string | null {
  try {
    // pdftoppm -png -f 1 -l 1 -r 120 <pdf> <outPrefix>
    const outPrefix = path.join(outDir, stem);
    execSync(`pdftoppm -png -f 1 -l 1 -r 120 "${pdfPath}" "${outPrefix}"`, { stdio: 'pipe' });

    // pdftoppm outputs <prefix>-1.png or <prefix>-01.png depending on version
    const candidates = [`${outPrefix}-1.png`, `${outPrefix}-01.png`];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
    console.warn(`  ⚠  Cover render: output file not found for ${stem}`);
    return null;
  } catch (e) {
    console.warn(`  ⚠  pdftoppm failed for ${stem}: ${(e as Error).message}`);
    return null;
  }
}

async function saveFileRecord(
  ds: DataSource,
  data: {
    filename: string;
    mime: string;
    path: string;
    storageProvider: string;
    storageKey: string;
    version: string;
    etag: string | null;
    sizeBytes: string;
    uploadedById: string;
  },
): Promise<string> {
  const repo = ds.getRepository(FileRecord);
  const rec  = repo.create(data);
  const saved = await repo.save(rec);
  return saved.id;
}

async function saveTextbook(
  ds: DataSource,
  data: {
    title: string;
    subject: string;
    grade: number;
    description: string;
    fileRecordId: string;
    coverImageFileId: string | null;
    sizeBytes: string;
  },
): Promise<string> {
  const repo = ds.getRepository(Textbook);
  // Skip if already seeded (idempotent)
  const existing = await repo.findOne({ where: { title: data.title, grade: data.grade } });
  if (existing) {
    console.log(`  ↩  Already seeded: ${data.title}`);
    return existing.id;
  }
  const saved = await repo.save(repo.create({ ...data, isActive: true }));
  return saved.id;
}

// ── System user ID ─────────────────────────────────────────────────────────
async function getAdminUserId(ds: DataSource): Promise<string> {
  const result = await ds.query(
    `SELECT id FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1`,
  );
  if (!result?.length) throw new Error('No admin user found. Run the seed script first.');
  return result[0].id;
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n📚  TriLink — Textbook Bulk Upload to Cloudinary\n');
  console.log(`  Cloud: ${process.env.CLOUDINARY_CLOUD_NAME}`);
  console.log(`  Dir  : ${TEXTBOOKS_DIR}\n`);

  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.error('❌  Missing CLOUDINARY_* env vars. Check your .env file.');
    process.exit(1);
  }

  const ds = buildDataSource();
  await ds.initialize();
  console.log('  ✓  Database connected\n');

  const adminId = await getAdminUserId(ds);
  const tmpDir  = fs.mkdtempSync(path.join(os.tmpdir(), 'trilink-covers-'));

  let success = 0;
  let failed  = 0;

  for (const book of MANIFEST) {
    const pdfPath = path.join(TEXTBOOKS_DIR, book.filename);
    console.log(`\n📖  ${book.title}`);

    if (!fs.existsSync(pdfPath)) {
      console.error(`  ❌  PDF not found: ${pdfPath}`);
      failed++;
      continue;
    }

    try {
      const stats       = fs.statSync(pdfPath);
      const subjectLow  = book.subject.toLowerCase();
      const folder      = `trilink_uploads/textbooks/${subjectLow}`;
      const coverFolder = `trilink_uploads/textbooks/${subjectLow}/covers`;

      // 1. Upload PDF
      process.stdout.write('  ↑  Uploading PDF ...');
      const pdf = await uploadToCloudinary(pdfPath, folder, 'raw');
      console.log(` ✓\n     ${pdf.url}`);

      // 2. Save FileRecord for PDF
      const pdfRecId = await saveFileRecord(ds, {
        filename:        book.filename,
        mime:            'application/pdf',
        path:            pdf.url,
        storageProvider: 'cloudinary',
        storageKey:      pdf.publicId,
        version:         pdf.version,
        etag:            null,
        sizeBytes:       String(stats.size),
        uploadedById:    adminId,
      });

      // 3. Render + upload cover
      const stem      = `${subjectLow}-grade${book.grade}-cover`;
      const coverPath = renderCoverPage(pdfPath, tmpDir, stem);
      let coverRecId: string | null = null;

      if (coverPath) {
        process.stdout.write('  ↑  Uploading cover ...');
        const cover    = await uploadToCloudinary(coverPath, coverFolder, 'image');
        console.log(` ✓\n     ${cover.url}`);
        const coverStat = fs.statSync(coverPath);
        coverRecId = await saveFileRecord(ds, {
          filename:        path.basename(coverPath),
          mime:            'image/png',
          path:            cover.url,
          storageProvider: 'cloudinary',
          storageKey:      cover.publicId,
          version:         cover.version,
          etag:            null,
          sizeBytes:       String(coverStat.size),
          uploadedById:    adminId,
        });
      }

      // 4. Save Textbook row
      const tbId = await saveTextbook(ds, {
        title:           book.title,
        subject:         book.subject,
        grade:           book.grade,
        description:     book.description,
        fileRecordId:    pdfRecId,
        coverImageFileId: coverRecId,
        sizeBytes:       String(stats.size),
      });
      console.log(`  ✅  Saved textbook  id=${tbId}`);
      success++;

    } catch (err) {
      console.error(`  ❌  Failed: ${(err as Error).message}`);
      failed++;
    }
  }

  // Cleanup temp covers
  fs.rmSync(tmpDir, { recursive: true, force: true });
  await ds.destroy();

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`  Done: ${success} uploaded, ${failed} failed`);
  console.log('─'.repeat(50));

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
