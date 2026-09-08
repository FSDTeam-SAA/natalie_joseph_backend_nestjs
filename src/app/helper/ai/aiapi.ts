import {
  BadGatewayException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import axios from 'axios';

export interface AiReply {
  message_id: string;
  conversation_id: string;
  companion_id: string;
  response: string;
  created_at: string;
  usage?: { input_tokens: number; output_tokens: number };
}

@Injectable()
export class AiApi {
  private async post<T>(
    path: string,
    body: object,
    authorization: string,
  ): Promise<T> {
    if (!authorization?.startsWith('Bearer '))
      throw new UnauthorizedException();
    try {
      const { data } = await axios.post<T>(
        `${(process.env.AI_API_BASE_URL || 'https://natalie-joseph-ai.onrender.com/api/v1').replace(/\/$/, '')}${path}`,
        body,
        { headers: { Authorization: authorization }, timeout: 30000 },
      );
      return data;
    } catch {
      // Never expose upstream errors: they can contain the user's bearer token.
      throw new BadGatewayException(
        'AI service unavailable. Please try again later',
      );
    }
  }

  async createConversation(companionId: string, authorization: string) {
    const data = await this.post<{ id: string; companion_id: string }>(
      '/conversations',
      { companion_id: companionId },
      authorization,
    );
    if (!data?.id || data.companion_id !== companionId) {
      throw new BadGatewayException('Invalid AI conversation response');
    }
    return data;
  }

  async sendMessage(
    conversationId: string,
    companionId: string,
    message: string,
    authorization: string,
    idempotencyKey: string,
  ) {
    const data = await this.post<AiReply>(
      '/chat',
      {
        conversation_id: conversationId,
        companion_id: companionId,
        message,
        idempotency_key: idempotencyKey,
      },
      authorization,
    );
    if (
      !data?.message_id ||
      typeof data.response !== 'string' ||
      !data.response.trim() ||
      data.conversation_id !== conversationId ||
      data.companion_id !== companionId
    ) {
      throw new BadGatewayException('Invalid AI chat response');
    }
    return data;
  }
}
