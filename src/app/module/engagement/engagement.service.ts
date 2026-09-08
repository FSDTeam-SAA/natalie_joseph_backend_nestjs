import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreditService } from '../credit/credit.service';
import {
  HumanReplyDto,
  PageDto,
  RelationshipDto,
  StoryDto,
} from './engagement.dto';

@Injectable()
export class EngagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credits: CreditService,
  ) {}

  private pagination(query: PageDto) {
    return { take: query.limit, skip: (query.page - 1) * query.limit };
  }

  relationships(userId: string, query: PageDto) {
    return this.prisma.relationship.findMany({
      where: { userId },
      include: {
        companion: { select: { id: true, name: true, profileImage: true } },
      },
      orderBy: { updatedAt: 'desc' },
      ...this.pagination(query),
    });
  }
  async updateRelationship(
    userId: string,
    companionId: string,
    data: RelationshipDto,
  ) {
    await this.companion(companionId);
    return this.prisma.relationship.upsert({
      where: { userId_companionId: { userId, companionId } },
      create: { userId, companionId, ...data },
      update: data,
    });
  }
  async stories(companionId: string, query: PageDto, admin = false) {
    if (!admin) await this.companion(companionId);
    return this.prisma.storyEvent.findMany({
      where: {
        companionId,
        ...(admin ? {} : { published: true, day: { lte: new Date() } }),
      },
      orderBy: { day: 'desc' },
      ...this.pagination(query),
    });
  }
  async saveStory(companionId: string, payload: StoryDto) {
    await this.companion(companionId);
    const day = new Date(`${payload.day}T00:00:00.000Z`);
    if (day.toISOString().slice(0, 10) !== payload.day)
      throw new BadRequestException('Invalid calendar day');
    const data = { ...payload, day };
    return this.prisma.storyEvent.upsert({
      where: { companionId_day: { companionId, day } },
      create: { companionId, ...data },
      update: data,
    });
  }
  async viewPhoto(userId: string, companionId: string, photoUrl: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.credits.expirePurchasedCredits(tx, userId);
      const companion = await tx.companions.findFirst({
        where: { id: companionId, status: true },
      });
      if (!companion || !companion.galleryImages.includes(photoUrl))
        throw new NotFoundException('Photo not found');
      const existing = await tx.photoView.findUnique({
        where: {
          userId_companionId_photoUrl: { userId, companionId, photoUrl },
        },
      });
      // Previously unlocked photos remain available without a second charge.
      if (existing)
        return tx.photoView.update({
          where: { id: existing.id },
          data: { viewCount: { increment: 1 }, lastViewedAt: new Date() },
        });
      const id = randomUUID();
      const creditCost = (await this.credits.getCosts(tx)).photo;
      const charge = await this.credits.consumeCredits(tx, userId, creditCost, {
        reason: 'photo',
        companionId,
        referenceId: id,
      });
      if (!charge)
        throw new HttpException(
          'Active subscription and sufficient credits required',
          402,
        );
      const view = await tx.photoView.create({
        data: { id, userId, companionId, photoUrl, creditCost },
      });
      await tx.relationship.upsert({
        where: { userId_companionId: { userId, companionId } },
        create: {
          userId,
          companionId,
          interactions: 1,
          lastInteractionAt: new Date(),
        },
        update: {
          interactions: { increment: 1 },
          lastInteractionAt: new Date(),
        },
      });
      return view;
    });
  }
  photoHistory(userId: string, query: PageDto) {
    return this.prisma.photoView.findMany({
      where: { userId },
      orderBy: { lastViewedAt: 'desc' },
      ...this.pagination(query),
    });
  }
  ledger(userId: string, query: PageDto) {
    return this.prisma.creditTransaction.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...this.pagination(query),
    });
  }
  notifications(userId: string, query: PageDto) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...this.pagination(query),
    });
  }
  async readNotification(userId: string, id: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
    });
    if (!notification) throw new NotFoundException('Notification not found');
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: notification.readAt ?? new Date() },
    });
  }
  async setCost(action: string, credits: number) {
    if (!['message', 'photo', 'voice', 'low_credit_threshold'].includes(action))
      throw new BadRequestException('Unknown credit action');
    return this.prisma.creditCost.upsert({
      where: { action },
      create: { action, credits },
      update: { credits },
    });
  }
  conversations(query: PageDto) {
    return this.prisma.chatConversation.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true } },
        companion: { select: { id: true, name: true } },
        _count: { select: { messages: true } },
      },
      ...this.pagination(query),
    });
  }
  async conversation(id: string, query: PageDto) {
    const conversation = await this.prisma.chatConversation.findUnique({
      where: { id },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    // Includes legacy messages and gifts that predate the conversation FK.
    const where = {
      userId: conversation.userId,
      companionId: conversation.companionId,
    };
    const [messages, total] = await Promise.all([
      this.prisma.chatMessage.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...this.pagination(query),
      }),
      this.prisma.chatMessage.count({ where }),
    ]);
    return {
      ...conversation,
      messages: messages.reverse(),
      total,
      page: query.page,
    };
  }
  async setMode(id: string, adminId: string, mode: 'ai' | 'human') {
    const conversation = await this.prisma.chatConversation.findUnique({
      where: { id },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${conversation.userId} FOR UPDATE`;
        if (
          mode === 'ai' &&
          (await tx.chatMessage.count({
            where: {
              conversationId: id,
              sender: 'user',
              response: null,
              type: { in: ['text', 'voice'] },
            },
          }))
        )
          throw new ConflictException(
            'Reply to pending messages before returning to AI mode',
          );
        const updated = await tx.chatConversation.update({
          where: { id },
          data: { mode, assignedAdminId: mode === 'human' ? adminId : null },
        });
        await tx.conversationModeEvent.create({
          data: { conversationId: id, adminId, mode },
        });
        await tx.notification.create({
          data: {
            userId: conversation.userId,
            type: 'conversation_mode',
            title: 'Conversation mode changed',
            body:
              mode === 'human'
                ? 'A human operator is now handling this conversation.'
                : 'AI replies are now enabled.',
            referenceId: id,
          },
        });
        return updated;
      },
      { maxWait: 80000 },
    );
  }
  async humanReply(id: string, adminId: string, payload: HumanReplyDto) {
    const conversation = await this.prisma.chatConversation.findUnique({
      where: { id },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${conversation.userId} FOR UPDATE`;
      const current = await tx.chatConversation.findUniqueOrThrow({
        where: { id },
      });
      if (current.mode !== 'human' || current.assignedAdminId !== adminId)
        throw new ConflictException(
          'Take over this conversation before replying',
        );
      const updated = await tx.chatMessage.updateMany({
        where: {
          id: payload.messageId,
          conversationId: id,
          sender: 'user',
          response: null,
          type: { in: ['text', 'voice'] },
        },
        data: { response: payload.message.trim(), humanAdminId: adminId },
      });
      if (!updated.count)
        throw new ConflictException('Message not found or already answered');
      await tx.chatConversation.update({
        where: { id },
        data: { updatedAt: new Date() },
      });
      await tx.notification.create({
        data: {
          userId: current.userId,
          type: 'human_reply',
          title: 'New reply',
          body: 'A human operator replied to your message.',
          referenceId: payload.messageId,
        },
      });
      return tx.chatMessage.findUniqueOrThrow({
        where: { id: payload.messageId },
      });
    });
  }
  async userDetails(id: string) {
    const wallet = await this.credits.getWallet(id);
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        isSubscribed: true,
        billingStatus: true,
        cancelAtPeriodEnd: true,
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: { subscription: true },
        },
        payments: { orderBy: { createdAt: 'desc' }, take: 20 },
        relationships: {
          take: 50,
          orderBy: { updatedAt: 'desc' },
          include: { companion: { select: { id: true, name: true } } },
        },
        _count: {
          select: {
            chatMessages: true,
            chatConversations: true,
            giftTransactions: true,
            photoViews: true,
          },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return { ...user, wallet };
  }
  private async companion(id: string) {
    const companion = await this.prisma.companions.findFirst({
      where: { id, status: true },
    });
    if (!companion) throw new NotFoundException('Companion not found');
    return companion;
  }
}
