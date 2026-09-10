import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsOptional, IsObject, ValidateNested } from 'class-validator';
import {
  CreateCompanionDto,
  CompanionPersonalityDto,
  CompanionCommunicationStyleDto,
  CompanionBackgroundDto,
  CompanionVisualProfileDto,
  CompanionVoiceDto,
  CompanionVoiceSettingsDto,
  nested,
} from './create-companion.dto';
export class UpdateCompanionPersonalityDto extends PartialType(
  CompanionPersonalityDto,
  { skipNullProperties: false },
) {}
export class UpdateCompanionCommunicationStyleDto extends PartialType(
  CompanionCommunicationStyleDto,
  { skipNullProperties: false },
) {}
export class UpdateCompanionBackgroundDto extends PartialType(
  CompanionBackgroundDto,
  { skipNullProperties: false },
) {}
export class UpdateCompanionVisualProfileDto extends PartialType(
  CompanionVisualProfileDto,
  { skipNullProperties: false },
) {}
export class UpdateCompanionVoiceSettingsDto extends PartialType(
  CompanionVoiceSettingsDto,
  { skipNullProperties: false },
) {}
export class UpdateCompanionVoiceDto extends PartialType(
  OmitType(CompanionVoiceDto, ['settings'] as const),
  { skipNullProperties: false },
) {
  @ApiPropertyOptional({ type: () => UpdateCompanionVoiceSettingsDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @nested(UpdateCompanionVoiceSettingsDto)
  settings?: UpdateCompanionVoiceSettingsDto;
}
export class UpdateCompanionDto extends PartialType(
  OmitType(CreateCompanionDto, [
    'personality',
    'communicationStyle',
    'background',
    'visualProfile',
    'voice',
  ] as const),
  { skipNullProperties: false },
) {
  @ApiPropertyOptional({ type: () => UpdateCompanionPersonalityDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @nested(UpdateCompanionPersonalityDto)
  personality?: UpdateCompanionPersonalityDto;
  @ApiPropertyOptional({ type: () => UpdateCompanionCommunicationStyleDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @nested(UpdateCompanionCommunicationStyleDto)
  communicationStyle?: UpdateCompanionCommunicationStyleDto;
  @ApiPropertyOptional({ type: () => UpdateCompanionBackgroundDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @nested(UpdateCompanionBackgroundDto)
  background?: UpdateCompanionBackgroundDto;
  @ApiPropertyOptional({ type: () => UpdateCompanionVisualProfileDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @nested(UpdateCompanionVisualProfileDto)
  visualProfile?: UpdateCompanionVisualProfileDto;
  @ApiPropertyOptional({ type: () => UpdateCompanionVoiceDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @nested(UpdateCompanionVoiceDto)
  voice?: UpdateCompanionVoiceDto;
}
