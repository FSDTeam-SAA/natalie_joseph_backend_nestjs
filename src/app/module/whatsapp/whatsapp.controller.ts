import {
  Body,
  Controller,
  HttpCode,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthGuard } from '../../middlewares/auth.guard';
import { WhatsAppService } from './whatsapp.service';

export class WhatsAppTestDto {
  @ApiPropertyOptional({
    description:
      'Use this companion sender. Omit to use the Meta test sender from .env.',
  })
  @IsOptional()
  @IsUUID()
  companionId?: string;

  @ApiProperty({ example: '8801712345678' })
  @Matches(/^[1-9]\d{6,14}$/)
  to!: string;

  @ApiPropertyOptional({ enum: ['template', 'text'], default: 'template' })
  @IsOptional()
  @IsIn(['template', 'text'])
  type?: 'template' | 'text';

  @ApiPropertyOptional({ example: 'Hello from Meet Elysia backend' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  message?: string;
}

@ApiTags('WhatsApp')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('admin', 'user'))
@Controller('whatsapp')
export class WhatsAppController {
  constructor(
    private readonly whatsapp: WhatsAppService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('test')
  @HttpCode(200)
  async test(@Body() dto: WhatsAppTestDto) {
    // Only the admin test route falls back to the single .env sender.
    let phoneNumberId =
      this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID') ?? '';
    if (dto.companionId) {
      const companion = await this.prisma.companions.findFirst({
        where: { id: dto.companionId, status: true, whatsappEnabled: true },
      });
      if (!companion?.whatsappPhoneNumberId) {
        throw new NotFoundException('Active WhatsApp companion not found');
      }
      phoneNumberId = companion.whatsappPhoneNumberId;
    }
    const data =
      dto.type === 'text'
        ? await this.whatsapp.sendText(
            phoneNumberId,
            dto.to,
            dto.message ?? 'Hello from Meet Elysia backend',
          )
        : await this.whatsapp.sendTestTemplate(phoneNumberId, dto.to);
    return { message: 'WhatsApp message accepted by Meta', data };
  }
}
