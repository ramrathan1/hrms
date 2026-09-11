import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'owner@worksuite.demo' })
  @IsEmail({}, { message: 'Enter a valid email address' })
  email!: string;

  @ApiProperty({ example: 'Password123!' })
  @IsString()
  @IsNotEmpty({ message: 'Enter your password' })
  password!: string;

  @ApiPropertyOptional({
    description: 'Organization slug. Required only when the email exists in more than one tenant.',
  })
  @IsString()
  @IsOptional()
  organizationSlug?: string;
}

export class RefreshDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Enter your current password' })
  currentPassword!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'New password must be at least 8 characters' })
  newPassword!: string;
}

export class RegisterOrganizationDto {
  @ApiProperty({ example: 'Acme Studio' })
  @IsString()
  @IsNotEmpty()
  organizationName!: string;

  @ApiProperty({ example: 'Mohammed Ziemann' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'owner@acme.example' })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;
}
