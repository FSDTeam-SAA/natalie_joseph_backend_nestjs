import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthGuard } from 'src/app/middlewares/auth.guard';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreditService } from '../credit/credit.service';
import {
  CostDto,
  HumanReplyDto,
  ModeDto,
  NotificationDto,
  PageDto,
  PhotoDto,
  RelationshipDto,
  StoryDto,
} from './engagement.dto';
import { EngagementService } from './engagement.service';

@ApiTags('Relationships, stories and notifications')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('user', 'admin'))
@Controller()
export class EngagementController {
  constructor(
    private readonly service: EngagementService,
    private readonly credits: CreditService,
  ) {}
  @Get('relationships') async relationships(
    @Req() req: Request,
    @Query() query: PageDto,
  ) {
    return { data: await this.service.relationships(req.user!.id, query) };
  }
  @Patch('relationships/:companionId') async relationship(
    @Req() req: Request,
    @Param('companionId') id: string,
    @Body() body: RelationshipDto,
  ) {
    return {
      data: await this.service.updateRelationship(req.user!.id, id, body),
    };
  }
  @Get('companions/:companionId/stories') async stories(
    @Param('companionId') id: string,
    @Query() query: PageDto,
  ) {
    return { data: await this.service.stories(id, query) };
  }
  @Post('companions/:companionId/photos/view') async photo(
    @Req() req: Request,
    @Param('companionId') id: string,
    @Body() body: PhotoDto,
  ) {
    return {
      data: await this.service.viewPhoto(req.user!.id, id, body.photoUrl),
    };
  }
  @Get('photos/history') async photos(
    @Req() req: Request,
    @Query() query: PageDto,
  ) {
    return { data: await this.service.photoHistory(req.user!.id, query) };
  }
  @Get('credits/ledger') async ledger(
    @Req() req: Request,
    @Query() query: PageDto,
  ) {
    return { data: await this.service.ledger(req.user!.id, query) };
  }
  @Get('credits/costs') async costs() {
    return { data: await this.credits.getCosts() };
  }
  @Get('notifications') async notifications(
    @Req() req: Request,
    @Query() query: PageDto,
  ) {
    return { data: await this.service.notifications(req.user!.id, query) };
  }
  @Patch('notifications/:id/read') async read(
    @Req() req: Request,
    @Param('id') id: string,
  ) {
    return { data: await this.service.readNotification(req.user!.id, id) };
  }
}

@ApiTags('Admin management')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('admin'))
@Controller('admin')
export class EngagementAdminController {
  constructor(
    private readonly service: EngagementService,
    private readonly prisma: PrismaService,
  ) {}
  @Put('credit-costs/:action') async cost(
    @Param('action') action: string,
    @Body() body: CostDto,
  ) {
    return { data: await this.service.setCost(action, body.credits) };
  }
  @Put('companions/:companionId/stories') async story(
    @Param('companionId') id: string,
    @Body() body: StoryDto,
  ) {
    return { data: await this.service.saveStory(id, body) };
  }
  @Get('companions/:companionId/stories') async stories(
    @Param('companionId') id: string,
    @Query() query: PageDto,
  ) {
    return { data: await this.service.stories(id, query, true) };
  }
  @Get('conversations') async conversations(@Query() query: PageDto) {
    return { data: await this.service.conversations(query) };
  }
  @Get('conversations/:id') async conversation(
    @Param('id') id: string,
    @Query() query: PageDto,
  ) {
    return { data: await this.service.conversation(id, query) };
  }
  @Patch('conversations/:id/mode') async mode(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: ModeDto,
  ) {
    return { data: await this.service.setMode(id, req.user!.id, body.mode) };
  }
  @Post('conversations/:id/replies') async reply(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: HumanReplyDto,
  ) {
    return { data: await this.service.humanReply(id, req.user!.id, body) };
  }
  @Get('users/:id/details') async user(@Param('id') id: string) {
    return { data: await this.service.userDetails(id) };
  }
  @Get('users/:id/ledger') async ledger(
    @Param('id') id: string,
    @Query() query: PageDto,
  ) {
    return { data: await this.service.ledger(id, query) };
  }
  @Post('notifications') async notification(@Body() body: NotificationDto) {
    return {
      data: await this.prisma.notification.create({
        data: { ...body, type: 'admin' },
      }),
    };
  }
}
