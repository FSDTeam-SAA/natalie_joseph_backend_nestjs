import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateGiftDto {
  @ApiProperty({ example: 'Rose' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 'https://example.com/rose.png' })
  @IsOptional()
  @IsString()
  image?: string;

  @ApiProperty({ example: 10 })
  @IsInt()
  @Min(1)
  creditCost!: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateGiftDto extends PartialType(CreateGiftDto) {}

export class SendGiftDto {
  @ApiProperty({ example: 'companion-id' })
  @IsString()
  @IsNotEmpty()
  companionId!: string;
}
