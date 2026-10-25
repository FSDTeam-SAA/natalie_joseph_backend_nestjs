import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { AuthGuard } from '../../middlewares/auth.guard';
import { fileUpload } from '../../helper/fileUploder';
import { LifestyleService } from './lifestyle.service';
import {
  ApprovePhotoDto,
  DailyContentDto,
  DailyPreferenceDto,
  LibraryPhotoDto,
  PhotoRequestDto,
  RoutineDto,
} from './lifestyle.dto';
import { PrismaService } from '../../../prisma/prisma.service';
function pageNumber(page: number) {
  if (page < 1 || page > 100000) throw new BadRequestException('Invalid page');
  return page;
}

@ApiTags('Admin lifestyle and photo library')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('admin'))
@Controller('admin/companions/:companionId/lifestyle')
export class LifestyleAdminController {
  constructor(
    private readonly service: LifestyleService,
    private readonly prisma: PrismaService,
  ) {}
  @Get('routine') async routine(
    @Param('companionId', ParseUUIDPipe) id: string,
  ) {
    return { data: await this.service.routine(id) };
  }
  @Put('routine') async saveRoutine(
    @Param('companionId', ParseUUIDPipe) id: string,
    @Body() dto: RoutineDto,
  ) {
    return { data: await this.service.saveRoutine(id, dto) };
  }
  @Get('context') async context(
    @Param('companionId', ParseUUIDPipe) id: string,
  ) {
    await this.service.companion(id);
    return { data: await this.service.context(id) };
  }
  @Get('photos') async photos(
    @Param('companionId', ParseUUIDPipe) id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
  ) {
    return { data: await this.service.photos(id, pageNumber(page)) };
  }
  @Post('photos')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['image'],
      properties: {
        image: { type: 'string', format: 'binary' },
        caption: { type: 'string' },
        tags: { type: 'string', example: 'gym,morning' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('image', fileUpload.uploadConfig))
  async upload(
    @Param('companionId', ParseUUIDPipe) id: string,
    @Body() dto: LibraryPhotoDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return { data: await this.service.upload(id, dto, file) };
  }
  @Patch('photos/:photoId') async approve(
    @Param('companionId', ParseUUIDPipe) id: string,
    @Param('photoId', ParseUUIDPipe) photoId: string,
    @Body() dto: ApprovePhotoDto,
  ) {
    return { data: await this.service.approve(id, photoId, dto.approved) };
  }
  @Get('daily-content') async daily(
    @Param('companionId', ParseUUIDPipe) id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
  ) {
    return { data: await this.service.daily(id, pageNumber(page)) };
  }
  @Put('daily-content') async save(
    @Param('companionId', ParseUUIDPipe) id: string,
    @Body() dto: DailyContentDto,
  ) {
    return { data: await this.service.saveDaily(id, dto) };
  }
  @Post('daily-content/:contentId/unpublish') async unpublish(
    @Param('companionId', ParseUUIDPipe) id: string,
    @Param('contentId', ParseUUIDPipe) contentId: string,
  ) {
    return { data: await this.service.unpublish(id, contentId) };
  }
  @Get('deliveries') async deliveries(
    @Param('companionId', ParseUUIDPipe) id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
  ) {
    return {
      data: await this.prisma.dailyDelivery.findMany({
        where: { content: { companionId: id } },
        orderBy: { createdAt: 'desc' },
        skip: (pageNumber(page) - 1) * 50,
        take: 50,
      }),
    };
  }
}
@ApiTags('Lifestyle content and allowances')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('user'))
@Controller('lifestyle')
export class LifestyleController {
  constructor(
    private readonly service: LifestyleService,
    private readonly prisma: PrismaService,
  ) {}
  @Get('preference') async preference(@Req() req: Request) {
    return { data: await this.service.preference(req.user!.id) };
  }
  @Put('preference') async save(
    @Req() req: Request,
    @Body() dto: DailyPreferenceDto,
  ) {
    return { data: await this.service.preference(req.user!.id, dto) };
  }
  @Get('allowances') async allowances(@Req() req: Request) {
    return { data: await this.service.usage(req.user!.id) };
  }
  @Post('companions/:companionId/photo') async photo(
    @Req() req: Request,
    @Param('companionId', ParseUUIDPipe) id: string,
    @Body() dto: PhotoRequestDto,
  ) {
    return { data: await this.service.requestPhoto(req.user!.id, id, dto) };
  }
  @Get('inbox') async inbox(
    @Req() req: Request,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
  ) {
    await this.service.active(this.prisma, req.user!.id);
    return {
      data: await this.prisma.dailyDelivery.findMany({
        where: {
          userId: req.user!.id,
          status: { in: ['available', 'sent', 'unknown', 'failed'] },
          content: { published: true, photo: { approved: true } },
        },
        include: { content: { include: { photo: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: (pageNumber(page) - 1) * 50,
      }),
    };
  }
}
