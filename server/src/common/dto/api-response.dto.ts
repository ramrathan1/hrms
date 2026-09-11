import { ApiProperty } from '@nestjs/swagger';

/** Uniform error body. Every failure the API emits looks like this. */
export class ApiErrorDto {
  @ApiProperty({ example: 422 })
  statusCode!: number;

  @ApiProperty({ example: 'VALIDATION_FAILED' })
  code!: string;

  @ApiProperty({ example: 'Request validation failed' })
  message!: string;

  @ApiProperty({ type: [String], required: false, example: ['email must be an email'] })
  details?: string[];

  @ApiProperty({ example: '/api/v1/clients' })
  path!: string;

  @ApiProperty()
  requestId!: string;

  @ApiProperty()
  timestamp!: string;
}
