import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt } from 'class-validator';

export class BuyCreditsDto {
  @ApiProperty({
    example: 100,
    enum: [100, 250, 700],
    description: 'Credit package size',
  })
  @IsInt()
  @IsIn([100, 250, 700])
  credits: number;
}
