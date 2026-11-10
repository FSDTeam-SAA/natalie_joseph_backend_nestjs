import { photoIntent, photoTags } from './photo-intent';

describe('Photo request matching', () => {
  it.each([
    ['/photo gym', ['gym']],
    ['/photo@ElenaBot beach', ['beach']],
    ['Send me a photo of yourself at the gym', ['gym']],
    ['Show me a red bikini photo at the beach', ['red', 'bikini', 'beach']],
    ['\u0986\u09ae\u09be\u0995\u09c7 \u09a4\u09cb\u09ae\u09be\u09b0 \u099c\u09bf\u09ae\u09c7\u09b0 \u099b\u09ac\u09bf \u09a6\u09be\u0993', ['gym']],
    ['Send me a photo working out', ['gym']],
    ['Photo please', []],
  ])('extracts all constraints from %s', (text, tags) => {
    expect(photoIntent(text)?.tags).toEqual(tags);
  });
  it.each([
    'Hello',
    'Which photo did you send?',
    "Don't send me a photo",
    'Can you generate images?',
    'How do I take a photo?',
    'I like photography',
  ])('does not route discussion as a photo request: %s', (text) => {
    expect(photoIntent(text)).toBeNull();
  });
  it('normalizes upload tags using the same vocabulary', () => {
    expect(photoTags('workout, Gym, coffee shop, morning')).toEqual([
      'gym',
      'cafe',
      'morning',
    ]);
  });
  it('does not discard specific or personal details to force a match', () => {
    expect(photoIntent('Send me a photo with my passport')?.tags).toContain(
      'passport',
    );
    expect(photoIntent('Send me a photo with my passport')?.shareable).toBe(
      false,
    );
  });
});
