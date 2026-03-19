import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const port = config.get<number>('port') ?? 4000;
  const prefix = config.get<string>('apiPrefix') ?? 'api';

  app.setGlobalPrefix(prefix);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.enableCors({ origin: true }); // configure for production

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
