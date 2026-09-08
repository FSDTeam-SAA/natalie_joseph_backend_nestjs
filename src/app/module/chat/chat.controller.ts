import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthGuard } from 'src/app/middlewares/auth.guard';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';

@ApiTags('Chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('conversations')
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('user'))
  async getConversations(@Req() request: Request) {
    if (!request.user) throw new UnauthorizedException();
    return { data: await this.chatService.getConversations(request.user.id) };
  }

  @Get(':companionId/messages')
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('user'))
  async getMessages(
    @Req() request: Request,
    @Param('companionId') companionId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
  ) {
    if (!request.user) throw new UnauthorizedException();
    if (page < 1) throw new BadRequestException('Page must be positive');
    return {
      data: await this.chatService.getMessages(
        request.user.id,
        companionId,
        page,
      ),
    };
  }

  @Get('usage')
  @ApiOperation({ summary: 'Get subscription usage and credit balance' })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('user'))
  async getUsage(@Req() request: Request) {
    if (!request.user) throw new UnauthorizedException();
    const data = await this.chatService.getUsage(request.user.id);
    return { message: 'Chat usage fetched successfully', data };
  }

  @Post(':companionId/messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Send a message to a companion' })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('user'))
  async sendMessage(
    @Req() request: Request,
    @Param('companionId') companionId: string,
    @Body() payload: SendMessageDto,
  ) {
    if (!request.user) throw new UnauthorizedException();
    const data = await this.chatService.sendMessage(
      request.user.id,
      companionId,
      payload.message,
      request.headers.authorization!,
      payload.type,
    );
    return { message: 'Message sent successfully', data };
  }
}
