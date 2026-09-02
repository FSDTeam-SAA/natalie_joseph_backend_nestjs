import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class BroadcastNewsletterDto {
  @ApiProperty({ example: 'Latest news from Elysia' })
  @IsString()
  @IsNotEmpty()
  subject: string;

  @ApiProperty({ example: '<h1>Hello!</h1><p>Here is our latest update.</p>' })
  @IsString()
  @IsNotEmpty()
  html: string;
}
