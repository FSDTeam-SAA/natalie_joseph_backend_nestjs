import axios from 'axios';
import { AiApi } from './aiapi';

describe('AI chat request format', () => {
  it('sends multipart fields matching the working AI endpoint', async () => {
    const post = jest
      .spyOn(axios, 'post')
      .mockResolvedValue({
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
        idempotency_key: 'key',
      });
    } finally {
      post.mockRestore();
    }
  });
});
