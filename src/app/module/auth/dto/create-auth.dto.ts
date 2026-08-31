import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

export class CreateAuthDto {
  @ApiProperty({
    example: 'John Doe',
    description: 'User full name',
  })
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  name!: string;

  @ApiProperty({
    example: 'john@example.com',
    description: 'User email address',
  })
  @IsEmail({}, { message: 'Please provide a valid email' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;

  @ApiProperty({
    example: '01712345678',
    description: 'User phone number',
  })
  @IsString()
  @IsNotEmpty({ message: 'Phone number is required' })
  phoneNumber!: string;

  @ApiProperty({
    example: 'Password123',
    description: 'User password',
    minLength: 6,
  })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(6, {
    message: 'Password must be at least 6 characters',
  })
  password!: string;

  @ApiPropertyOptional({
    example: true,
    default: false,
    description: 'Whether the companion is adult eligible',
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  adultEligible?: boolean;
}

export class LoginAuthDto {
  @ApiProperty({
    example: 'john@example.com',
  })
  @IsEmail({}, { message: 'Please provide a valid email' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;

  @ApiProperty({
    example: 'Password123',
  })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  password!: string;
}

export class ForgotPasswordAuthDto {
  @ApiProperty({
    example: 'john@example.com',
  })
  @IsEmail({}, { message: 'Please provide a valid email' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;
}

export class VerifyOtpAuthDto {
  @ApiProperty({
    example: 'john@example.com',
  })
  @IsEmail({}, { message: 'Please provide a valid email' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;

  @ApiProperty({
    example: '123456',
    description: '6 digit OTP',
  })
  @IsString()
  @IsNotEmpty({ message: 'OTP is required' })
  @Matches(/^\d{6}$/, {
    message: 'OTP must be exactly 6 digits',
  })
  otp!: string;
}

export class ResetPasswordAuthDto {
  @ApiProperty({
    example: 'john@example.com',
  })
  @IsEmail({}, { message: 'Please provide a valid email' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;

  @ApiProperty({
    example: 'NewPassword123',
    minLength: 6,
  })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(6, {
    message: 'Password must be at least 6 characters',
  })
  password!: string;
}

export class ChangePasswordAuthDto {
  @ApiProperty({
    example: 'john@example.com',
  })
  @IsEmail({}, { message: 'Please provide a valid email' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;

  @ApiProperty({
    example: 'OldPassword123',
  })
  @IsString()
  @IsNotEmpty({ message: 'Old password is required' })
  oldPassword!: string;

  @ApiProperty({
    example: 'NewPassword123',
    minLength: 6,
  })
  @IsString()
  @IsNotEmpty({ message: 'New password is required' })
  @MinLength(6, {
    message: 'New password must be at least 6 characters',
  })
  newPassword!: string;
}
