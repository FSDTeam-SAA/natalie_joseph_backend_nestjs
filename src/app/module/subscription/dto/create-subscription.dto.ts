import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateSubscriptionDto {
  @ApiProperty({
    example: 'Premium Plan',
    description: 'Subscription plan name',
  })
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  name: string;

  @ApiProperty({
    example: '29.99',
    description: 'Subscription plan price',
  })
  @IsString()
  @IsNotEmpty({ message: 'Price is required' })
  price: string;

  @ApiPropertyOptional({
    example: 1000,
    description: 'Deprecated: use creditAllowance',
  })
  @IsOptional()
  @IsInt({ message: 'Message limit must be an integer' })
  @Min(0, {
    message: 'Message limit cannot be negative',
  })
  messageLimit?: number;

  @ApiPropertyOptional({
    example: 500,
    description: 'Credits granted for each subscription period',
  })
  @IsOptional()
  @IsInt({ message: 'Credit allowance must be an integer' })
  @Min(0, { message: 'Credit allowance cannot be negative' })
  creditAllowance?: number;

  @ApiProperty({ example: 30, required: false, default: 30 })
  @IsOptional()
  @IsInt()
  @Min(1)
  durationDays?: number;

  @ApiProperty({
    example: [
      '1000 messages per month',
      'Priority support',
      'Advanced AI features',
    ],
    description: 'List of subscription features',
    type: [String],
  })
  @IsArray({
    message: 'Features must be an array',
  })
  @IsString({
    each: true,
    message: 'Each feature must be a string',
  })
  features: string[];

  @ApiPropertyOptional({
    example: true,
    default: false,
    description: 'Whether this plan is popular',
  })
  @IsOptional()
  @IsBoolean({
    message: 'isPopular must be a boolean',
  })
  isPopular?: boolean;

  @ApiPropertyOptional({
    example: true,
    default: true,
    description: 'Whether this subscription plan is active',
  })
  @IsOptional()
  @IsBoolean({
    message: 'isActive must be a boolean',
  })
  isActive?: boolean;
}
