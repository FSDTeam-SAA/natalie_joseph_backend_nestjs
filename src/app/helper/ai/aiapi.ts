import {
  BadGatewayException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import axios from 'axios';
import { createHash } from 'crypto';

export function aiIdempotencyKey(key: string): string {
  if (/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(key))
    return key;
  const bytes = createHash('sha256')
    .update(`meet-elysia:ai:${key}`)
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export interface AiReply {
  message_type?: 'text' | 'image';
  media?: {
    id: string;
    kind: 'image';
    url: string;
    mime_type: string;
    byte_size: number;
  } | null;
  transcript?: string | null;
  message_id: string;
  conversation_id: string;
  companion_id: string;
  response: string;
  created_at: string;
  usage?: { input_tokens: number; output_tokens: number };
}

@Injectable()
export class AiApi {
  private readonly logger = new Logger(AiApi.name);
  get requestTimeoutMs(): number {
    const value = Number(process.env.AI_API_TIMEOUT_MS || 60000);
    return Number.isInteger(value) && value >= 1000 && value <= 120000
      ? value
      : 60000;
  }
  private async post<T>(
    path: string,
    body: object,
    authorization: string,
  ): Promise<T> {
    if (!authorization?.startsWith('Bearer '))
      throw new UnauthorizedException();
    const startedAt = Date.now();
    try {
      const { data } = await axios.post<T>(
        `${(process.env.AI_API_BASE_URL || 'http://187.77.187.56:8000/api/v1').replace(/\/$/, '')}${path}`,
        body,
        {
          headers: { Authorization: authorization },
          timeout: this.requestTimeoutMs,
        },
      );
      return data;
    } catch (error: unknown) {
      const upstream = axios.isAxiosError(error) ? error : undefined;
      const status = upstream?.response?.status;
      const safeCodes = [
        'ECONNABORTED',
        'ETIMEDOUT',
        'ECONNREFUSED',
        'ECONNRESET',
        'ENOTFOUND',
        'EAI_AGAIN',
        'ERR_NETWORK',
        'ERR_BAD_REQUEST',
        'ERR_BAD_RESPONSE',
      ];
      const code =
        upstream?.code && safeCodes.includes(upstream.code)
          ? upstream.code
          : 'UNKNOWN';
      this.logger.error(
        `AI request failed: endpoint=${path}, status=${Number.isInteger(status) ? status : 'none'}, code=${code}, elapsedMs=${Date.now() - startedAt}`,
      );
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
    const form = new FormData();
    form.set('conversation_id', conversationId);
    form.set('companion_id', companionId);
    form.set('message', message);
    form.set('idempotency_key', aiIdempotencyKey(idempotencyKey));
    const data = await this.post<AiReply>('/chat', form, authorization);
    if (
      !data?.message_id ||
      typeof data.response !== 'string' ||
      !data.response.trim() ||
      data.conversation_id !== conversationId ||
      data.companion_id !== companionId
    ) {
      throw new BadGatewayException('Invalid AI chat response');
    }
    if (data.message_type === 'image') {
      let valid = false;
      try {
        const url = new URL(data.media?.url || '');
        valid =
          url.protocol === 'https:' &&
          !url.username &&
          !url.password &&
          data.media?.kind === 'image';
      } catch {
        /* Invalid media must not be forwarded. */
      }
      if (!valid) throw new BadGatewayException('Invalid AI image response');
    }
    return data;
  }
}
