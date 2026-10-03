import { BadGatewayException } from '@nestjs/common';

// Exact messages from the AI service's public error envelope. Never forward
// arbitrary upstream messages, which may contain credentials or user content.
const terminalVoiceErrors: Record<string, string> = {
  'ElevenLabs speech-to-text request failed': 'speech_to_text_failed',
  'ElevenLabs text-to-speech request failed': 'text_to_speech_failed',
  'The previous transcription attempt is incomplete or terminal; use a new idempotency key.':
    'transcription_attempt_terminal',
  'The previous voice synthesis attempt did not produce retrievable media; use a new idempotency key.':
    'synthesis_attempt_terminal',
  'The previous voice operation is incomplete.': 'voice_attempt_incomplete',
  'The previous voice response media is unavailable.':
    'voice_media_unavailable',
  'This companion has no ElevenLabs voice ID configured.': 'voice_id_missing',
  'Voice generation is disabled for this deployment.': 'voice_output_disabled',
  'Voice input is disabled for this deployment.': 'voice_input_disabled',
  'ElevenLabs voice processing is not configured.': 'voice_not_configured',
  'Unsupported audio type.': 'unsupported_audio',
  'The uploaded file content does not match its audio type.': 'invalid_audio',
  'The audio duration could not be determined safely.':
    'invalid_audio_duration',
  'Audio duration exceeds the configured limit.': 'audio_too_long',
  'Audio upload is empty or exceeds the configured size limit.':
    'invalid_audio_size',
  'Audio upload exceeds the configured size limit.': 'invalid_audio_size',
  'The audio did not contain transcribable speech.': 'no_speech',
};

export class AiVoiceFailure extends BadGatewayException {
  constructor(readonly reason: string) {
    super(
      'Voice processing is unavailable. No chat credits were charged. Please send a text message, or send a new voice message later.',
    );
  }
}

export function classifyVoiceFailure(
  status: number | undefined,
  body: unknown,
): AiVoiceFailure | undefined {
  if (
    ![422, 502, 503].includes(status || 0) ||
    !body ||
    typeof body !== 'object'
  )
    return;
  const error = (body as { error?: { code?: unknown; message?: unknown } })
    .error;
  if (
    !error ||
    !['PROVIDER_ERROR', 'SERVICE_UNAVAILABLE', 'VALIDATION_ERROR'].includes(
      String(error.code),
    )
  )
    return;
  const reason =
    typeof error.message === 'string'
      ? terminalVoiceErrors[error.message]
      : undefined;
  if (reason) return new AiVoiceFailure(reason);
}
