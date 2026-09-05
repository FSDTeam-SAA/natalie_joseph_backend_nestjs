import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

const toStringArray = ({ value }: { value: unknown }): unknown => {
  if (Array.isArray(value)) {
    return value.flatMap((item) =>
      typeof item === 'string' ? item.split(',') : item,
    );
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return value;
};

export class CreateCompanionDto {
  @ApiProperty({
    example: 'Sophia',
    description: 'Name of the companion',
  })
  @IsString()
  name!: string;

  @ApiProperty({
    example: 25,
    description: 'Age of the companion',
    minimum: 18,
  })
  @IsInt()
  @Min(18)
  @Type(() => Number)
  age!: number;

  @ApiProperty({
    example: 'The Intelligent & Curious Companion',
  })
  @IsString()
  title!: string;

  @ApiProperty({
    example: 'Software Engineer',
    description: 'Profession of the companion',
  })
  @IsString()
  profession!: string;

  @ApiProperty({
    example: 'New York, USA',
    description: 'Current location of the companion',
  })
  @IsString()
  location!: string;

  @ApiProperty({
    example: 'Friendly, adventurous, and loves meaningful conversations.',
    description: 'Short biography of the companion',
  })
  @IsString()
  bio!: string;

  @ApiProperty({
    type: [String],
    example: ['Social', 'Playful', 'Confident', 'Charming'],
    description: 'Traits',
  })
  @IsArray()
  @IsString({ each: true })
  @Transform(toStringArray)
  traits!: string[];

  @ApiProperty({
    type: [String],
    example: ['Travel', 'Music', 'Photography', 'Movies'],
    description: 'Interests',
  })
  @IsArray()
  @IsString({ each: true })
  @Transform(toStringArray)
  interests!: string[];

  @ApiProperty({
    example: 'Friendly and casual',
    description: 'Preferred communication style',
  })
  @IsString()
  communicationStyle!: string;

  @ApiProperty({
    example: 'Active and social',
    description: 'Lifestyle',
  })
  @IsString()
  lifestyle!: string;

  @ApiPropertyOptional({
    example:
      'Sophia grew up in New York and developed a passion for technology and travel.',
    description: 'Optional backstory',
  })
  @IsOptional()
  @IsString()
  backstory?: string;

  @ApiProperty({
    type: [String],
    example: ['Soft', 'Warm', 'Calm'],
    description: 'Voice description',
  })
  @IsArray()
  @IsString({ each: true })
  @Transform(toStringArray)
  voiceDescription!: string[];

  // Single file
  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Profile image',
  })
  @IsOptional()
  profileImage?: any;

  // Single file
  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Cover image',
  })
  @IsOptional()
  coverImage?: any;

  // Multiple files
  @ApiPropertyOptional({
    type: 'array',
    items: {
      type: 'string',
      format: 'binary',
    },
    description: 'Gallery images',
  })
  @IsOptional()
  galleryImages?: any[];

  @ApiPropertyOptional({
    example: true,
    default: true,
    description: 'Whether the companion is active',
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  status?: boolean;
}
