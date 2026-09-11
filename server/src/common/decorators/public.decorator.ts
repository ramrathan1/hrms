import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Opt a route out of JwtAuthGuard — login, refresh, health, docs. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
