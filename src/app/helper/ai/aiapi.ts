import {
  BadGatewayException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import axios from 'axios';
import { createHash } from 'crypto';
import { classifyVoiceFailure } from './ai-failure';

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

export interface AiAudio {
  bytes: Uint8Array;
  mimeType: string;
  filename: string;
}

export interface AiReply {
  message_type?: 'text' | 'image' | 'audio';
  media?: {
    id: string;
    kind: 'image' | 'audio';
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
  private get baseUrl(): string {
    return (
      process.env.AI_API_BASE_URL || 'http://187.77.187.56:8000/api/v1'
    ).replace(/\/$/, '');
  }
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
      const { data } = await axios.post<T>(`${this.baseUrl}${path}`, body, {
        headers: { Authorization: authorization },
        timeout: this.requestTimeoutMs,
      });
      if (process.env.AI_API_LOG_TIMING === 'true')
        this.logger.log(
          `AI request completed: endpoint=${path}, elapsedMs=${Date.now() - startedAt}`,
        );
      return data;
    } catch (error: unknown) {
      const upstream = axios.isAxiosError(error) ? error : undefined;
      const status = upstream?.response?.status;
      const voiceFailure = classifyVoiceFailure(
        status,
        upstream?.response?.data,
      );
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
        `AI request failed: endpoint=${path}, status=${Number.isInteger(status) ? status : 'none'}, code=${code}, reason=${voiceFailure?.reason || 'unclassified'}, elapsedMs=${Date.now() - startedAt}`,
      );
      if (voiceFailure) throw voiceFailure;
      // Never expose upstream errors: they can contain the user's bearer token.
      throw new BadGatewayException(
        'AI service unavailable. Please try again later',
      );
    }
  }

  async getAudio(
    media: NonNullable<AiReply['media']>,
    authorization: string,
  ): Promise<AiAudio> {
    if (!authorization.startsWith('Bearer ')) throw new UnauthorizedException();
    if (
      !/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(
        media.id,
      )
    )
      throw new BadGatewayException('Invalid AI audio ID');
    try {
      // The AI archive serves private media by ID, protected by the same user JWT.
      // Never attach the JWT to a provider-supplied URL or follow redirects.
      const result = await axios.get<ArrayBuffer>(
        `${this.baseUrl}/media/${media.id}`,
        {
          headers: { Authorization: authorization },
          responseType: 'arraybuffer',
          timeout: 20000,
          maxContentLength: 20 * 1024 * 1024,
          maxRedirects: 0,
        },
      );
      const bytes = new Uint8Array(result.data);
      if (!bytes.byteLength || bytes.byteLength > 20 * 1024 * 1024)
        throw new Error();
      const mimeType = media.mime_type;
      const extension =
        mimeType === 'audio/mpeg'
          ? 'mp3'
          : ['audio/mp4', 'audio/m4a'].includes(mimeType)
            ? 'm4a'
            : 'ogg';
      if (
        !['audio/mpeg', 'audio/mp4', 'audio/m4a', 'audio/ogg'].includes(
          mimeType,
        )
      )
        throw new Error();
      return { bytes, mimeType, filename: `reply.${extension}` };
    } catch {
      throw new BadGatewayException('AI voice media could not be retrieved');
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
    audio?: AiAudio,
  ) {
    const form = new FormData();
    form.set('conversation_id', conversationId);
    form.set('companion_id', companionId);
    form.set('message', message);
    form.set('idempotency_key', aiIdempotencyKey(idempotencyKey));
    if (audio)
      form.set(
        'audio',
        new Blob([new Uint8Array(audio.bytes)], { type: audio.mimeType }),
        audio.filename,
      );
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
    if (data.message_type === 'audio') {
      if (
        data.media?.kind !== 'audio' ||
        !/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(
          data.media.id,
        ) ||
        !['audio/mpeg', 'audio/mp4', 'audio/m4a', 'audio/ogg'].includes(
          data.media.mime_type,
        )
      ) {
        throw new BadGatewayException('Invalid AI audio response');
      }
    }
    if (data.message_type === 'image') {
      let valid = false;
      try {
        const url = new URL(data.media?.url || '');
        valid =
          url.protocol === 'https:' &&
          !url.username &&
          !url.password &&
          data.media?.kind === data.message_type;
      } catch {
        /* Invalid media must not be forwarded. */
      }
      if (!valid)
        throw new BadGatewayException(
          `Invalid AI ${data.message_type} response`,
        );
    }
    return data;
  }
}
