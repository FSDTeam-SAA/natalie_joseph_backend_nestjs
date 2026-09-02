import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import pick from 'src/app/helper/pick';
import { AuthGuard } from 'src/app/middlewares/auth.guard';
import { BroadcastNewsletterDto } from './dto/broadcast-newsletter.dto';
import { CreateNewsletterDto } from './dto/create-newsletter.dto';
import { NewsletterService } from './newsletter.service';

@ApiTags('Newsletter')
@Controller('newsletter')
export class NewsletterController {
  constructor(private readonly newsletterService: NewsletterService) {}

  @Post()
  @ApiOperation({ summary: 'Subscribe to newsletter' })
  @HttpCode(HttpStatus.CREATED)
  async sendMail(@Body() createNewsletterDto: CreateNewsletterDto) {
    const data = await this.newsletterService.sendMail(createNewsletterDto);
    return {
      message: 'Newsletter subscription saved successfully',
      data,
    };
  }

  @Post('broadcast')
  @ApiOperation({ summary: 'Broadcast an email to all newsletter subscribers' })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('admin'))
  @HttpCode(HttpStatus.OK)
  async broadcastNewsletter(@Body() dto: BroadcastNewsletterDto) {
    const data = await this.newsletterService.broadcastNewsletter(dto);

    return {
      message: 'Newsletter broadcast queued successfully',
      data,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get all newsletter' })
  @ApiQuery({
    name: 'searchTerm',
    type: String,
    required: false,
    description: 'Search term',
  })
  @ApiQuery({
    name: 'email',
    type: String,
    required: false,
    description: 'Email',
  })
  @ApiQuery({
    name: 'page',
    type: Number,
    required: false,
    description: 'Page number',
  })
  @ApiQuery({
    name: 'limit',
    type: Number,
    required: false,
    description: 'Limit number',
  })
  @ApiQuery({
    name: 'sortBy',
    type: String,
    required: false,
    description: 'Sort by',
  })
  @ApiQuery({
    name: 'sortOrder',
    type: String,
    required: false,
    description: 'Sort order',
  })
  @HttpCode(HttpStatus.OK)
  async getAllNewsletter(@Req() req: Request) {
    const params = pick(req.query, ['searchTerm', 'email']);
    const options = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);
    const result = await this.newsletterService.getAllNewsletter(
      params,
      options,
    );

    return {
      message: 'Get all newsletter successfully',
      meta: result.meta,
      data: result.data,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get newsletter by id' })
  @HttpCode(HttpStatus.OK)
  async getNewsletterById(@Param('id') id: string) {
    const result = await this.newsletterService.getNewsletterById(id);

    return {
      message: 'Get newsletter by id successfully',
      data: result,
    };
  }
}
