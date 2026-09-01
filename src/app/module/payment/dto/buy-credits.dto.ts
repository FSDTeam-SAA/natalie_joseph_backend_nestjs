import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class BuyCreditsDto {
  @ApiProperty({ example: 'credit-package-id' })
  @IsString()
  @IsNotEmpty()
  packageId!: string;
}
