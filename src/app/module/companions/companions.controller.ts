import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { fileUpload } from 'src/app/helper/fileUploder';
import pick from 'src/app/helper/pick';
import { AuthGuard } from 'src/app/middlewares/auth.guard';
import type { CompanionFiles } from './companions.service';
import { CompanionsService } from './companions.service';
import { CreateCompanionDto } from './dto/create-companion.dto';
import { UpdateCompanionDto } from './dto/update-companion.dto';

const companionFileFields = [
  { name: 'profileImage', maxCount: 1 },
  { name: 'coverImage', maxCount: 1 },
  { name: 'galleryImages', maxCount: 10 },
];

@ApiTags('Companions')
@Controller('companions')
export class CompanionsController {
  constructor(private readonly companionsService: CompanionsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a companion' })
  @ApiBearerAuth('access-token')
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateCompanionDto })
  @UseGuards(AuthGuard('admin'))
  @UseInterceptors(
    FileFieldsInterceptor(companionFileFields, fileUpload.uploadConfig),
  )
  async createCompanion(
    @Body() payload: CreateCompanionDto,
    @UploadedFiles() files: CompanionFiles = {},
  ) {
    const data = await this.companionsService.createCompanion(payload, files);
    return { message: 'Companion created successfully', data };
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all companions' })
  @ApiQuery({ name: 'searchTerm', required: false, type: String })
  @ApiQuery({ name: 'profession', required: false, type: String })
  @ApiQuery({ name: 'location', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: Boolean })
  @ApiQuery({ name: 'interest', required: false, type: String })
  @ApiQuery({ name: 'personalityTrait', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  async getAllCompanions(@Req() request: Request) {
    const filters = pick(request.query, [
      'searchTerm',
      'profession',
      'location',
      'status',
      'interest',
      'personalityTrait',
      'name',
      'profession',
      'location',
      'bio',
      'communicationStyle',
      'lifestyle',
      'backstory',
    ]);
    const options = pick(request.query, [
      'page',
      'limit',
      'sortBy',
      'sortOrder',
    ]);
    const result = await this.companionsService.getAllCompanions(
      filters,
      options,
    );
    return {
      message: 'Companions fetched successfully',
      meta: result.meta,
      data: result.data,
    };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a companion by ID' })
  async getCompanionById(@Param('id') id: string) {
    const data = await this.companionsService.getCompanionById(id);
    return { message: 'Companion fetched successfully', data };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a companion' })
  @ApiBearerAuth('access-token')
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UpdateCompanionDto })
  @UseGuards(AuthGuard('admin'))
  @UseInterceptors(
    FileFieldsInterceptor(companionFileFields, fileUpload.uploadConfig),
  )
  async updateCompanion(
    @Param('id') id: string,
    @Body() payload: UpdateCompanionDto,
    @UploadedFiles() files: CompanionFiles = {},
  ) {
    const data = await this.companionsService.updateCompanion(
      id,
      payload,
      files,
    );
    return { message: 'Companion updated successfully', data };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a companion' })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('admin'))
  async deleteCompanion(@Param('id') id: string) {
    const data = await this.companionsService.deleteCompanion(id);
    return { message: 'Companion deleted successfully', data };
  }
}
