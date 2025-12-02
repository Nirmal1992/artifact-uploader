import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { config } from './config/index.js';
import { uploadRoutes } from './routes/upload.routes.js';

const fastify = Fastify({
  logger: {
    level: config.NODE_ENV === 'development' ? 'info' : 'warn',
    transport:
      config.NODE_ENV === 'development'
        ? {
            target: 'pino-pretty',
          }
        : undefined,
  },
  bodyLimit: config.MAX_FILE_SIZE,
});

// Register CORS
await fastify.register(cors, {
  origin: config.CORS_ORIGIN,
  credentials: true,
});

// Register multipart/form-data support
await fastify.register(multipart, {
  limits: {
    fileSize: config.MAX_FILE_SIZE,
    files: 1,
  },
});

// Register routes
await fastify.register(uploadRoutes, { prefix: '/api' });

// Global error handler
fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error);

  const statusCode = error.statusCode || 500;

  reply.status(statusCode).send({
    success: false,
    error: error.message || 'Internal Server Error',
    code: error.code,
  });
});

// Start server
try {
  await fastify.listen({
    port: config.PORT,
    host: config.HOST,
  });

  fastify.log.info(`🚀 Server running on http://${config.HOST}:${config.PORT}`);
  fastify.log.info(`📦 S3 Bucket: ${config.S3_BUCKET_NAME}`);
  fastify.log.info(`🌍 Environment: ${config.NODE_ENV}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}

