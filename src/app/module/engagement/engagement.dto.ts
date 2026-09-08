import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PageDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;
  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;
}
export class RelationshipDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nickname?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}
export class CostDto {
  @ApiProperty()
  @IsInt()
  @Min(0)
  @Max(1000000)
  credits!: number;
}
export class ModeDto {
  @ApiProperty({ enum: ['ai', 'human'] })
  @IsIn(['ai', 'human'])
  mode!: 'ai' | 'human';
}
export class HumanReplyDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  messageId!: string;
  @ApiProperty()
  @IsString()
  @Matches(/\S/)
  @MaxLength(5000)
  message!: string;
}
export class StoryDto {
  @ApiProperty({ example: '2026-09-08' })
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  day!: string;
  @ApiProperty()
  @IsString()
  @Matches(/\S/)
  @MaxLength(200)
  title!: string;
  @ApiProperty()
  @IsString()
  @Matches(/\S/)
  @MaxLength(20000)
  content!: string;
  @ApiProperty()
  @IsBoolean()
  published!: boolean;
}
export class PhotoDto {
  @ApiProperty({ description: 'URL from this companion’s galleryImages' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  photoUrl!: string;
}
export class NotificationDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  userId!: string;
  @ApiProperty()
  @IsString()
  @Matches(/\S/)
  @MaxLength(200)
  title!: string;
  @ApiProperty()
  @IsString()
  @Matches(/\S/)
  @MaxLength(5000)
  body!: string;
}
