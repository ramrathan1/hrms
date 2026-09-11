import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/** Query shape shared by every list endpoint. */
export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page: number = 1;

  @ApiPropertyOptional({ default: 25, minimum: 1, maximum: 200 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  @IsOptional()
  limit: number = 25;

  @ApiPropertyOptional({ description: 'Field to sort by, e.g. createdAt' })
  @IsString()
  @IsOptional()
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsIn(['asc', 'desc'])
  @IsOptional()
  sortOrder: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({ description: 'Free-text search across the module’s searchable fields' })
  @IsString()
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  q?: string;

  get skip(): number {
    return (this.page - 1) * this.limit;
  }
}

export class PageMeta {
  page!: number;
  limit!: number;
  total!: number;
  pages!: number;
  hasNext!: boolean;
  hasPrev!: boolean;
}

export class Paginated<T> {
  data!: T[];
  meta!: PageMeta;
}

export function paginate<T>(data: T[], total: number, page: number, limit: number): Paginated<T> {
  const pages = limit > 0 ? Math.ceil(total / limit) : 0;
  return {
    data,
    meta: { page, limit, total, pages, hasNext: page < pages, hasPrev: page > 1 },
  };
}
