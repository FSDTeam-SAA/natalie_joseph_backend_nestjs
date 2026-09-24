import axios from 'axios';
import { AiApi, aiIdempotencyKey } from './aiapi';

describe('AI chat request format', () => {
  it('uses stable UUID keys for webhook retries and preserves existing UUIDs', () => {
    const key = aiIdempotencyKey('phone:wamid.test');
    expect(key).toMatch(
      /^[a-f\d]{8}-[a-f\d]{4}-5[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/,
    );
    expect(aiIdempotencyKey('phone:wamid.test')).toBe(key);
    expect(aiIdempotencyKey('phone:wamid.other')).not.toBe(key);
    expect(aiIdempotencyKey(key)).toBe(key);
  });
  it('rejects unsafe image URLs instead of forwarding them', async () => {
    const post = jest.spyOn(axios, 'post').mockResolvedValue({
      data: {
        message_id: 'm',
        conversation_id: 'c',
        companion_id: 'p',
        response: 'Image',
        message_type: 'image',
        media: { kind: 'image', url: 'file:///private' },
      },
    });
    try {
      await expect(
        new AiApi().sendMessage('c', 'p', 'Image', 'Bearer test', 'k'),
      ).rejects.toThrow('Invalid AI image response');
    } finally {
      post.mockRestore();
    }
  });
  it('sends multipart fields matching the working AI endpoint', async () => {
    const post = jest.spyOn(axios, 'post').mockResolvedValue({
      data: {
        message_id: 'm',
        conversation_id: 'c',
        companion_id: 'p',
        response: 'Hello',
      },
    });
    try {
      await new AiApi().sendMessage('c', 'p', 'Hi', 'Bearer test', 'key');
      const form = post.mock.calls[0][1] as FormData;
      expect(form).toBeInstanceOf(FormData);
      expect(Object.fromEntries(form.entries())).toEqual({
        conversation_id: 'c',
        companion_id: 'p',
        message: 'Hi',
        idempotency_key: aiIdempotencyKey('key'),
      });
    } finally {
      post.mockRestore();
    }
  });
});
