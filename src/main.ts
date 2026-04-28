import { NestFactory } from '@nestjs/core';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const port = config.get<number>('port') ?? 4000;
  const prefix = config.get<string>('apiPrefix') ?? 'api';

  app.setGlobalPrefix(prefix, {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  const corsList = config.get<string[] | null>('corsOrigin');
  if (corsList?.length) {
    const normalizedAllowed = new Set(
      corsList
        .map((o) => o.trim())
        .filter(Boolean)
        .map((o) => o.replace(/\/$/, '')),
    );
    // Keep local dev resilient even when CORS_ORIGIN is set narrowly.
    normalizedAllowed.add('http://localhost:3000');
    normalizedAllowed.add('http://127.0.0.1:3000');
    app.enableCors({
      credentials: true,
      origin: (origin, cb) => {
        // Allow same-origin, Swagger UI, curl/postman (no Origin header)
        if (!origin) return cb(null, true);
        const normalized = origin.replace(/\/$/, '');
        if (normalizedAllowed.has(normalized)) return cb(null, true);
        return cb(new Error(`CORS blocked for origin: ${origin}`), false);
      },
    });
  } else {
    app.enableCors({ origin: true });
  }

  const swaggerConfig = new DocumentBuilder()
    .setTitle('TriLink API')
    .setDescription(
      'REST API for the TriLink school management platform. **Authentication:** use `POST /api/auth/login` to get tokens, then send `Authorization: Bearer <accessToken>` for protected routes. **Roles:** admin (full access, can register others), teacher, student, parent.',
    )
    .setVersion('1.0')
    // Scheme name must match @ApiBearerAuth('JWT') on protected routes
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Paste accessToken from login (no "Bearer " prefix needed in the box)' },
      'JWT',
    )
    .addTag('Auth', 'Login, refresh tokens, and admin-only user registration')
    .addTag('Users', 'User directory and profiles (admin)')
    .addTag('Academic calendar', 'Academic years, terms, rollover, close')
    .addTag('School structure', 'Grades, sections, subjects')
    .addTag('Classes', 'Class offerings per year')
    .addTag('Enrollments', 'Student enrollment')
    .addTag('Parents', 'Parent–student links')
    .addTag('Calendar', 'School / class events')
    .addTag('Attendance', 'Sessions, marks, reports')
    .addTag('Exams', 'Questions, exams, attempts, grading')
    .addTag('Announcements', 'School announcements')
    .addTag('Feedback', 'Feedback tickets')
    .addTag('Notifications', 'In-app notifications')
    .addTag('Chat', 'Conversations, messages, WebSocket')
    .addTag('Dashboard', 'Role dashboards')
    .addTag('Settings', 'User and school settings JSON')
    .addTag('Files', 'Uploads and file metadata')
    .addTag('Admin', 'Audit logs and admin utilities')
    .addTag('AI', 'Mastery tracking (BKT), recommendations, learning paths, content generation, AI chat, analytics — proxied to trilink-ai-core')
    .addTag('Gamification', 'Badges, points, exam leaderboard')
    .addTag('Student goals', 'Personal learning goals')
    .addTag('Student profiles', 'Extended student profile fields')
    .addTag('Reports', 'Performance, weekly parent summary, period comparison')
    .addTag('Analytics', 'Admin school-wide metrics')
    .addTag('Grades', 'Teacher-managed grade entries: assignments, quizzes, exams (auto + manual)')
    .addTag('Assignments', 'Teacher creates assignments; students submit files or text; teacher grades and releases')
    .addTag('Integrations', 'External services and sync hints')
    .addTag('Health', 'Liveness (no /api prefix)')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig, {
    extraModels: [],
  });
  SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
      filter: true,
      showRequestDuration: true,
    },
    customSiteTitle: 'TriLink API Docs',
  });

  await app.listen(port);
  console.log(`TriLink API: http://localhost:${port}/${prefix}`);
  console.log(`Swagger:    http://localhost:${port}/api-docs`);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
