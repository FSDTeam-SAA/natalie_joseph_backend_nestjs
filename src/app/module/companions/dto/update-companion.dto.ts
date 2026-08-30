import { PartialType } from '@nestjs/swagger';
import { CreateCompanionDto } from './create-companion.dto';

export class UpdateCompanionDto extends PartialType(CreateCompanionDto) {}
