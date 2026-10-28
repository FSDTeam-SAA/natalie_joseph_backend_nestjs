import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RoutineSlotDto {
  @ApiProperty({ description: 'ISO weekday: Monday=1, Sunday=7' })
  @IsInt()
  @Min(1)
  @Max(7)
  day!: number;
  @ApiProperty({ example: '06:00' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  start!: string;
  @ApiProperty({ example: '12:00' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  end!: string;
  @ApiProperty() @IsString() @Matches(/\S/) @MaxLength(500) activity!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;
}
export class RoutineDto {
  @ApiProperty({ example: 'Asia/Dubai' })
  @IsString()
  @MaxLength(80)
  timezone!: string;
  @ApiProperty({ type: [RoutineSlotDto] })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => RoutineSlotDto)
  weekly!: RoutineSlotDto[];
}
export class LibraryPhotoDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) caption =
    '';
  @ApiPropertyOptional({
    description: 'Comma-separated tags, e.g. gym,morning,sporty',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  tags = '';
}
export class ApprovePhotoDto {
  @ApiProperty() @IsBoolean() approved!: boolean;
}
export class DailyContentDto {
  @ApiProperty({ example: '2026-10-25' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  day!: string;
  @ApiProperty({ description: 'ISO instant including timezone' })
  @IsDateString({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/)
  publishAt!: string;
  @ApiProperty({
    description: 'End of delivery window; missed content is skipped',
  })
  @IsDateString({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/)
  expiresAt!: string;
  @ApiProperty() @IsUUID() photoId!: string;
  @ApiProperty() @IsString() @Matches(/\S/) @MaxLength(4000) text!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) activity =
    '';
  @ApiPropertyOptional() @IsOptional() @IsBoolean() published = false;
}
export class DailyPreferenceDto {
  @ApiProperty() @IsUUID() companionId!: string;
  @ApiProperty() @IsBoolean() enabled!: boolean;
}
export class PhotoRequestDto {
  @ApiProperty({
    description: 'Unique per user request; reuse on network retry',
  })
  @IsUUID()
  requestId!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) tag?: string;
}
export class EntitlementPolicyDto {
  @ApiProperty({ enum: ['paid', 'trial'] }) @IsIn(['paid', 'trial']) kind!:
    'paid' | 'trial';
  @ApiPropertyOptional() @IsOptional() @IsBoolean() dailyPhoto = false;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() dailyText = false;
  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  trialRepliesPerDay = 10;
  @ApiPropertyOptional({ default: 30 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  trialRepliesTotal = 30;
  @ApiPropertyOptional({ default: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  trialPhotosTotal = 3;
}
