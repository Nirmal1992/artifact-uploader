import { z } from 'zod';

const envSchema = z.object({
  // Server
  PORT: z.string().default('3001').transform(Number),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // AWS S3
  AWS_REGION: z.string().default('us-east-1'),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  S3_BUCKET_NAME: z.string(),

  // Upload settings
  MAX_FILE_SIZE: z.string().default('10737418240').transform(Number), // 10GB default
  CHUNK_SIZE: z.string().default('5242880').transform(Number), // 5MB default
  MAX_PARALLEL_CHUNKS: z.string().default('3').transform(Number),
  UPLOAD_EXPIRATION: z.string().default('3600').transform(Number), // 1 hour

  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
});

export type Config = z.infer<typeof envSchema>;

function loadConfig(): Config {
  try {
    const parsed = envSchema.parse(process.env);
    return parsed;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Invalid environment variables:');
      error.errors.forEach((err) => {
        console.error(`  ${err.path.join('.')}: ${err.message}`);
      });
      process.exit(1);
    }
    throw error;
  }
}

export const config = loadConfig();

