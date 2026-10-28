import { BadGatewayException } from '@nestjs/common';
import type { AiReply } from '../../helper/ai/aiapi';

// Admin-managed credit rates; image/voice captions are included in their price.
export function responseCost(
  reply: AiReply,
  hasAudioInput: boolean,
  costs: {
    message: number;
    photo: number;
    voice: number;
    transcription: number;
  },
) {
  const units = (value: unknown, unit: number) => {
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value <= 0 ||
      value > 1000000
    )
      throw new BadGatewayException(
        'AI billing metadata is missing or invalid',
      );
    return Math.ceil(value / unit);
  };
  const output = reply.message_type ?? 'text';
  const outputCost =
    output === 'image'
      ? costs.photo
      : output === 'audio'
        ? costs.voice * units(reply.billing?.voice_characters, 500)
        : costs.message;
  return (
    outputCost +
    (hasAudioInput
      ? costs.transcription * units(reply.billing?.transcription_seconds, 60)
      : 0)
  );
}
