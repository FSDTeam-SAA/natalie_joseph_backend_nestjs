import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, plainToInstance } from 'class-transformer';
import {
  IsArray,
  IsObject,
  ValidateIf,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsNotEmpty,
  Min,
  ValidateNested,
} from 'class-validator';

export const toArray = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
  }
};
export const nested = <T extends object>(cls: new () => T) =>
  Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        value = JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value && typeof value === 'object' && !Array.isArray(value)
      ? plainToInstance(cls, value)
      : value;
  });
export const toBoolean = ({ value }: { value: unknown }) =>
  value === 'true' ? true : value === 'false' ? false : value;
export const toNumber = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() !== '' ? Number(value) : value;

export class CompanionPersonalityDto {
  @ApiProperty({ type: [String] })
  @Transform(toArray)
  @IsArray()
  @IsString({ each: true })
  traits!: string[];

  @ApiProperty({})
  @IsString()
  @IsNotEmpty()
  about!: string;

  @ApiProperty({})
  @IsString()
  @IsNotEmpty()
  essence!: string;

  @ApiProperty({ type: [String] })
  @Transform(toArray)
  @IsArray()
  @IsString({ each: true })
  sharedTraits!: string[];
}

export class CompanionCommunicationStyleDto {
  @ApiProperty({ type: [String] })
  @Transform(toArray)
  @IsArray()
  @IsString({ each: true })
  styleTraits!: string[];

  @ApiProperty({})
  @IsString()
  @IsNotEmpty()
  topicsSheEnjoys!: string;

  @ApiProperty({ type: [String] })
  @Transform(toArray)
  @IsArray()
  @IsString({ each: true })
  whatYouExperience!: string[];
}

export class CompanionBackgroundDto {
  @ApiProperty({})
  @IsString()
  @IsNotEmpty()
  location!: string;

  @ApiProperty({})
  @IsString()
  @IsNotEmpty()
  occupation!: string;

  @ApiProperty({ type: [String] })
  @Transform(toArray)
  @IsArray()
  @IsString({ each: true })
  lifestyle!: string[];
}

export class CompanionVisualProfileDto {
  @ApiProperty({ type: [String] })
  @Transform(toArray)
  @IsArray()
  @IsString({ each: true })
  aestheticKeywords!: string[];

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  note?: string | null;

  @ApiProperty({ type: [String] })
  @Transform(toArray)
  @IsArray()
  @IsString({ each: true })
  referenceImages!: string[];

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  physicalIdentity?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  generationInstructions?: string | null;
}

export class CompanionVoiceSettingsDto {
  @ApiProperty({})
  @Transform(toNumber)
  @IsNumber()
  stability!: number;

  @ApiProperty({})
  @Transform(toNumber)
  @IsNumber()
  similarityBoost!: number;

  @ApiProperty({})
  @Transform(toNumber)
  @IsNumber()
  style!: number;

  @ApiProperty({})
  @Transform(toBoolean)
  @IsBoolean()
  useSpeakerBoost!: boolean;

  @ApiProperty({})
  @Transform(toNumber)
  @IsNumber()
  speed!: number;
}

export class CompanionVoiceDto {
  @ApiProperty({})
  @IsString()
  @IsNotEmpty()
  provider!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  voiceId?: string | null;

  @ApiPropertyOptional({
    type: () => CompanionVoiceSettingsDto,
    description: 'Nested JSON object',
  })
  @IsOptional()
  @nested(CompanionVoiceSettingsDto)
  @IsObject()
  @ValidateNested()
  settings?: CompanionVoiceSettingsDto;
}

export class CreateCompanionDto {
  @ApiProperty({})
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({})
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  version?: number;

  @ApiProperty({})
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional({ type: Number, nullable: true })
  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(18)
  age?: number | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  backstory?: string | null;

  @ApiProperty({ type: [String] })
  @Transform(toArray)
  @IsArray()
  @IsString({ each: true })
  voiceDescription!: string[];

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  profileImage?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  coverImage?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(toArray)
  @IsArray()
  @IsString({ each: true })
  galleryImages?: string[];

  @ApiPropertyOptional({})
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(toBoolean)
  @IsBoolean()
  status?: boolean;

  @ApiProperty({ type: [String] })
  @Transform(toArray)
  @IsArray()
  @IsString({ each: true })
  interests!: string[];

  @ApiPropertyOptional({
    type: () => CompanionPersonalityDto,
    description: 'Nested JSON object',
  })
  @IsOptional()
  @nested(CompanionPersonalityDto)
  @IsObject()
  @ValidateNested()
  personality?: CompanionPersonalityDto;

  @ApiPropertyOptional({
    type: () => CompanionCommunicationStyleDto,
    description: 'Nested JSON object',
  })
  @IsOptional()
  @nested(CompanionCommunicationStyleDto)
  @IsObject()
  @ValidateNested()
  communicationStyle?: CompanionCommunicationStyleDto;

  @ApiPropertyOptional({
    type: () => CompanionBackgroundDto,
    description: 'Nested JSON object',
  })
  @IsOptional()
  @nested(CompanionBackgroundDto)
  @IsObject()
  @ValidateNested()
  background?: CompanionBackgroundDto;

  @ApiPropertyOptional({
    type: () => CompanionVisualProfileDto,
    description: 'Nested JSON object',
  })
  @IsOptional()
  @nested(CompanionVisualProfileDto)
  @IsObject()
  @ValidateNested()
  visualProfile?: CompanionVisualProfileDto;

  @ApiPropertyOptional({
    type: () => CompanionVoiceDto,
    description: 'Nested JSON object',
  })
  @IsOptional()
  @nested(CompanionVoiceDto)
  @IsObject()
  @ValidateNested()
  voice?: CompanionVoiceDto;
}
