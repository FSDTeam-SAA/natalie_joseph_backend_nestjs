import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WhatsAppService {
  constructor(private readonly config: ConfigService) {}

  sendText(phoneNumberId: string, to: string, message: string) {
    return this.send(phoneNumberId, to, {
      type: 'text',
      text: { body: message },
    });
  }

  sendImage(phoneNumberId: string, to: string, url: string, caption: string) {
    return this.send(phoneNumberId, to, {
      type: 'image',
      image: { link: url, caption: caption.slice(0, 1024) },
    });
  }

  sendTestTemplate(phoneNumberId: string, to: string) {
    return this.send(phoneNumberId, to, {
      type: 'template',
      template: { name: 'hello_world', language: { code: 'en_US' } },
    });
  }

  private async send(
    phoneId: string,
    to: string,
    content: Record<string, unknown>,
  ) {
    const token = this.config.get<string>('WHATSAPP_ACCESS_TOKEN');
    const version = this.config.get<string>('WHATSAPP_GRAPH_VERSION');
    if (
      !token ||
      !phoneId ||
      !/^\d+$/.test(phoneId) ||
      !version ||
      !/^v\d+\.\d+$/.test(version)
    ) {
      throw new ServiceUnavailableException(
        'WhatsApp sending is not configured',
      );
    }
    try {
      const response = await fetch(
        `https://graph.facebook.com/${version}/${phoneId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to,
            ...content,
          }),
          signal: AbortSignal.timeout(10000),
        },
      );
      if (!response.ok) {
        // Only expose numeric diagnostics; upstream text can contain secrets.
        const body = (await response.json().catch(() => null)) as {
          error?: { code?: number; error_subcode?: number };
        } | null;
        const code = body?.error?.code;
        const subcode = body?.error?.error_subcode;
        const details = [
          `HTTP ${response.status}`,
          ...(Number.isSafeInteger(code) ? [`Meta code ${code}`] : []),
          ...(Number.isSafeInteger(subcode) ? [`subcode ${subcode}`] : []),
        ].join(', ');
        throw new BadGatewayException(
          `WhatsApp API rejected the message (${details})`,
        );
      }
      return (await response.json()) as { messages?: { id: string }[] };
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      throw new BadGatewayException('WhatsApp API request failed');
    }
  }
}
