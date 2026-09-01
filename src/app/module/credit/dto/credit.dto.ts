import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';

export class CreateCreditPackageDto {
  @ApiProperty({ example: 'Starter Credits' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 100 })
  @IsInt()
  @Min(1)
  credits!: number;

  @ApiProperty({ example: '4.99' })
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, { message: 'Price must be a valid amount' })
  price!: string;

  @ApiPropertyOptional({ example: 'usd', default: 'usd' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCreditPackageDto extends PartialType(
  CreateCreditPackageDto,
) {}

export class PurchaseCreditPackageDto {
  @ApiProperty({ example: 'credit-package-id' })
  @IsString()
  @IsNotEmpty()
  packageId!: string;
}
