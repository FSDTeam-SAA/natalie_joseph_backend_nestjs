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
import { CompanionsService } from './companions.service';
import { CreateCompanionDto } from './dto/create-companion.dto';
import { UpdateCompanionDto } from './dto/update-companion.dto';

@ApiTags('Companions')
@Controller('companions')
export class CompanionsController {
  constructor(private readonly companionsService: CompanionsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a companion' })
  @ApiBearerAuth('access-token')
  @ApiConsumes('application/json')
  @ApiBody({ type: CreateCompanionDto })
  @UseGuards(AuthGuard('admin'))
  async createCompanion(@Body() payload: CreateCompanionDto) {
    const data = await this.companionsService.createCompanion(payload);
    return { message: 'Companion created successfully', data };
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all companions' })
  @ApiQuery({ name: 'searchTerm', required: false, type: String })
  @ApiQuery({ name: 'occupation', required: false, type: String })
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
      'name',
      'title',
      'backstory',
      'occupation',
      'profession',
      'location',
      'status',
      'interest',
      'personalityTrait',
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
  @ApiConsumes('application/json')
  @ApiBody({ type: UpdateCompanionDto })
  @UseGuards(AuthGuard('admin'))
  async updateCompanion(
    @Param('id') id: string,
    @Body() payload: UpdateCompanionDto,
  ) {
    const data = await this.companionsService.updateCompanion(id, payload);
    return { message: 'Companion updated successfully', data };
  }

  @Put(':id/profile-image')
  @ApiOperation({ summary: 'Set or replace companion profileImage' })
  @ApiBearerAuth('access-token')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['profileImage'],
      properties: { profileImage: { type: 'string', format: 'binary' } },
    },
  })
  @UseGuards(AuthGuard('admin'))
  @UseInterceptors(
    FileFieldsInterceptor(
      [{ name: 'profileImage', maxCount: 1 }],
      fileUpload.uploadConfig,
    ),
  )
  async updateProfileImage(
    @Param('id') id: string,
    @UploadedFiles() files: { profileImage?: Express.Multer.File[] } = {},
  ) {
    const data = await this.companionsService.updateImages(
      id,
      'profileImage',
      files.profileImage ?? [],
      false,
    );
    return { message: 'Companion images updated successfully', data };
  }

  @Put(':id/cover-image')
  @ApiOperation({ summary: 'Set or replace companion coverImage' })
  @ApiBearerAuth('access-token')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['coverImage'],
      properties: { coverImage: { type: 'string', format: 'binary' } },
    },
  })
  @UseGuards(AuthGuard('admin'))
  @UseInterceptors(
    FileFieldsInterceptor(
      [{ name: 'coverImage', maxCount: 1 }],
      fileUpload.uploadConfig,
    ),
  )
  async updateCoverImage(
    @Param('id') id: string,
    @UploadedFiles() files: { coverImage?: Express.Multer.File[] } = {},
  ) {
    const data = await this.companionsService.updateImages(
      id,
      'coverImage',
      files.coverImage ?? [],
      false,
    );
    return { message: 'Companion images updated successfully', data };
  }

  @Post(':id/gallery')
  @ApiOperation({ summary: 'Add to companion galleryImages' })
  @ApiBearerAuth('access-token')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['galleryImages'],
      properties: {
        galleryImages: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          maxItems: 10,
        },
      },
    },
  })
  @UseGuards(AuthGuard('admin'))
  @UseInterceptors(
    FileFieldsInterceptor(
      [{ name: 'galleryImages', maxCount: 10 }],
      fileUpload.uploadConfig,
    ),
  )
  async addGalleryImages(
    @Param('id') id: string,
    @UploadedFiles() files: { galleryImages?: Express.Multer.File[] } = {},
  ) {
    const data = await this.companionsService.updateImages(
      id,
      'galleryImages',
      files.galleryImages ?? [],
      true,
    );
    return { message: 'Companion images updated successfully', data };
  }

  @Put(':id/gallery')
  @ApiOperation({ summary: 'Set or replace companion galleryImages' })
  @ApiBearerAuth('access-token')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['galleryImages'],
      properties: {
        galleryImages: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          maxItems: 10,
        },
      },
    },
  })
  @UseGuards(AuthGuard('admin'))
  @UseInterceptors(
    FileFieldsInterceptor(
      [{ name: 'galleryImages', maxCount: 10 }],
      fileUpload.uploadConfig,
    ),
  )
  async updateGalleryImages(
    @Param('id') id: string,
    @UploadedFiles() files: { galleryImages?: Express.Multer.File[] } = {},
  ) {
    const data = await this.companionsService.updateImages(
      id,
      'galleryImages',
      files.galleryImages ?? [],
      false,
    );
    return { message: 'Companion images updated successfully', data };
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
