import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsNotEmpty,
  IsString,
  MaxLength,
  IsUUID,
} from 'class-validator';

export class SendMessageDto {
  @ApiProperty({required:false,description:'UUID; reuse on retries to avoid duplicate replies and charges'})
  @IsOptional()
  @IsUUID()
  requestId?: string;
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
