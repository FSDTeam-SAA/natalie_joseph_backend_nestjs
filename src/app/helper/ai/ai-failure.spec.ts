import { classifyVoiceFailure } from './ai-failure';

describe('AI error envelope', () => {
  it('recognizes the observed provider and terminal retry errors', () => {
    expect(
      classifyVoiceFailure(502, {
        error: {
          code: 'PROVIDER_ERROR',
          message: 'ElevenLabs speech-to-text request failed',
        },
      })?.reason,
    ).toBe('speech_to_text_failed');
    expect(
      classifyVoiceFailure(502, {
        error: {
          code: 'PROVIDER_ERROR',
          message:
            'The previous transcription attempt is incomplete or terminal; use a new idempotency key.',
        },
      })?.reason,
    ).toBe('transcription_attempt_terminal');
  });
  it('does not forward arbitrary errors or classify transport failures as terminal', () => {
    expect(
      classifyVoiceFailure(502, {
        error: { code: 'PROVIDER_ERROR', message: 'secret-token' },
      }),
    ).toBeUndefined();
    expect(classifyVoiceFailure(undefined, undefined)).toBeUndefined();
  });
});
