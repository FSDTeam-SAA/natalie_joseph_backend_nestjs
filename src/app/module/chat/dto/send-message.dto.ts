import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

export class SendMessageDto {
  @ApiProperty({
    enum: ['text', 'voice'],
    required: false,
    description: 'Voice messages supply their transcript in message.',
  })
  @IsOptional()
  @IsIn(['text', 'voice'])
  type?: 'text' | 'voice';

  @ApiProperty({ example: 'Hello, how are you?' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  message!: string;
}
