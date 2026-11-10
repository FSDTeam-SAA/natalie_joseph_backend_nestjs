// Match explicit photo requests locally: no extra model call on the fast path.
// Unknown details remain constraints, so a generic photo never wins a specific request.
const aliases: Record<string, string> = {
  workout: 'gym',
  fitness: 'gym',
  exercising: 'gym',
  exercise: 'gym',
  swimming: 'pool',
  swim: 'pool',
  seaside: 'beach',
  ocean: 'beach',
  coffee: 'cafe',
  café: 'cafe',
  restaurant: 'dinner',
  \u099c\u09bf\u09ae: 'gym',
  \u09ac\u09cd\u09af\u09be\u09af\u09bc\u09be\u09ae: 'gym',
  \u09ac\u09bf\u099a: 'beach',
  \u09b8\u09ae\u09c1\u09a6\u09cd\u09b0: 'beach',
  \u09aa\u09c1\u09b2: 'pool',
  \u0995\u09ab\u09bf: 'cafe',
  \u09b8\u0995\u09be\u09b2: 'morning',
  \u09b0\u09be\u09a4: 'night',
  \u099c\u09bf\u09ae\u09c7\u09b0: 'gym',
  \u099c\u09bf\u09ae\u09c7: 'gym',
  \u09ac\u09bf\u099a\u09c7\u09b0: 'beach',
  \u09aa\u09c1\u09b2\u09c7\u09b0: 'pool',
};
const stop = new Set(
  `a an the me my you your yourself of at in on from with please
  send share show give can could would will want like love see get have i to some
  photo photos picture pictures image images pic pics selfie selfies photograph
  photographs one another new more and now wearing outfit take today
  \u0986\u09ae\u09be\u0995\u09c7 \u09a4\u09cb\u09ae\u09be\u09b0 \u09a4\u09c1\u09ae\u09bf \u098f\u0995\u099f\u09bf \u098f\u0995\u099f\u09be \u099b\u09ac\u09bf \u09ab\u099f\u09cb \u09a6\u09be\u0993 \u09a6\u09c7\u0996\u09be\u0993 \u09aa\u09be\u09a0\u09be\u0993 \u09aa\u09cd\u09b2\u09bf\u099c \u099a\u09be\u0987 \u09a6\u09c7\u0996\u09a4\u09c7`.split(
    /\s+/,
  ),
);
const reusable = new Set(
  `gym pool beach cafe dinner morning night selfie portrait
  casual travel sporty elegant dress red blue black white pink green gold silver
  bikini swimsuit sunset sunrise home garden park city`.split(/\s+/),
);

export function photoTags(value: string): string[] {
  return [
    ...new Set(
      value
        .toLowerCase()
        .normalize('NFKC')
        .replace(/\b(?:working out|work out)\b/g, 'gym')
        .replace(/\bswimming pool\b/g, 'pool')
        .replace(/\bcoffee shop\b/g, 'cafe')
        .split(/[,\s]+/u)
        .map((tag) => aliases[tag] || tag)
        .filter(Boolean),
    ),
  ];
}

export function photoIntent(message: string) {
  const text = message.trim();
  const command = /^\/photo(?:@\w+)?(?:\s|$)/i.test(text);
  if (
    !command &&
    /^(?:which|what|when|where|why|how)\b/i.test(text) &&
    !/\b(?:send|show|share|give)\s+me\b/i.test(text)
  )
    return null;
  const photo =
    /\b(?:photos?|pictures?|images?|pics?|selfies?|photographs?)\b|\u099b\u09ac\u09bf|\u09ab\u099f\u09cb/iu;
  const action =
    /\b(?:send|share|show|give|want|see|take|create|generate|make)\b|\u09a6\u09be\u0993|\u09a6\u09c7\u0996\u09be\u0993|\u09aa\u09be\u09a0\u09be\u0993|\u099a\u09be\u0987/iu;
  const brief =
    /^(?:(?:a|another|one more)\s+)?(?:photo|picture|image|selfie|pic)(?:\s+please)?[.!?]*$/i.test(
      text,
    );
  if (!command && (!photo.test(text) || (!action.test(text) && !brief)))
    return null;
  if (
    !command &&
    /\b(?:don't|do not|never|no|how|why)\b|\u09a6\u09bf\u0993 \u09a8\u09be|\u099a\u09be\u0987 \u09a8\u09be/iu.test(text)
  )
    return null;
  if (
    /^(?:can|could) you (?:generate|create) (?:images|photos|pictures)\s*\?*$/i.test(
      text,
    )
  )
    return null;
  const content = command ? text.replace(/^\/photo(?:@\w+)?\s*/i, '') : text;
  const terms = photoTags(
    content.replace(/[^\p{L}\p{M}\p{N}\s,-]/gu, ' '),
  ).filter((term) => !stop.has(term));
  // All explicit details must match; a very long/custom request goes to generation.
  return {
    tags: terms,
    libraryEligible: terms.length <= 20,
    shareable: terms.every((term) => reusable.has(term)),
    prompt: command
      ? `Send me a photo of yourself${content ? `: ${content}` : '.'}`
      : `Send me a photo of yourself. Requested scene: ${message}`,
  };
}
