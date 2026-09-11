import { plainToInstance } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsString, Min, validateSync } from 'class-validator';

/**
 * Environment contract. Validated once at boot — a missing secret should stop
 * the process, not surface as a 500 on the first login attempt.
 */
export class EnvVars {
  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  REDIS_URL!: string;

  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_SECRET!: string;

  @IsString()
  JWT_ACCESS_TTL: string = '15m';

  @IsString()
  JWT_REFRESH_TTL: string = '7d';

  @IsInt()
  @Min(1)
  PORT: number = 3001;

  @IsIn(['development', 'test', 'production'])
  NODE_ENV: string = 'development';

  @IsString()
  CORS_ORIGINS: string = 'http://localhost:5173';

  @IsInt()
  @Min(1)
  DB_POOL_MAX: number = 10;

  @IsInt()
  @Min(1000)
  DB_POOL_IDLE_TIMEOUT_MS: number = 30_000;

  @IsInt()
  @Min(0)
  CACHE_TTL_SECONDS: number = 60;

  /// 32 random bytes, base64. Encrypts mail credentials at rest.
  @IsString()
  @IsNotEmpty()
  APP_ENCRYPTION_KEY!: string;

  @IsString()
  STORAGE_ROOT: string = './storage';
}

export function validateEnv(raw: Record<string, unknown>): EnvVars {
  const parsed = plainToInstance(EnvVars, raw, { enableImplicitConversion: true });
  const errors = validateSync(parsed, { skipMissingProperties: false });

  if (errors.length) {
    const detail = errors
      .map((e) => `  ${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${detail}`);
  }
  return parsed;
}

export default () => ({
  port: Number(process.env.PORT ?? 3001),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  corsOrigins: (process.env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  database: {
    url: process.env.DATABASE_URL!,
    poolMax: Number(process.env.DB_POOL_MAX ?? 10),
    idleTimeoutMs: Number(process.env.DB_POOL_IDLE_TIMEOUT_MS ?? 30_000),
  },
  redis: {
    url: process.env.REDIS_URL!,
    ttlSeconds: Number(process.env.CACHE_TTL_SECONDS ?? 60),
  },
  storage: {
    root: process.env.STORAGE_ROOT ?? './storage',
  },
  security: {
    encryptionKey: process.env.APP_ENCRYPTION_KEY!,
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET!,
    refreshSecret: process.env.JWT_REFRESH_SECRET!,
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '7d',
  },
});
