import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
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
}
