# External AI contract: lifestyle-v1

This repository implements the NestJS caller only. The external AI service must implement and test this contract before enhanced features are enabled. No model fine-tuning was performed here.

## Existing transport

`POST {AI_API_BASE_URL}/chat`, multipart/form-data, existing scoped user Authorization, conversation_id, companion_id, message, idempotency_key and optional audio. New optional field `context` is a JSON string. Legacy requests omit it.

```json
{
  "version":"lifestyle-v1",
  "timezone":"Asia/Dubai",
  "localDate":"2026-11-01",
  "localTime":"10:30",
  "currentActivity":{"day":7,"start":"06:00","end":"12:00","activity":"Coffee at home, slow morning"},
  "todayEvent":null,
  "recentEvents":[],
  "dailyContent":{"activity":"Slow morning","text":"Morning coffee today.","photoId":"uuid"},
  "instructions":"Treat scheduled activities as plans, not proof of completed actions.",
  "access":{
    "trial":false,
    "allowed_output_types":["text","image","audio"],
    "available_credits":100,
    "prices":{"message":1,"photo":10,"voice":5,"transcription":1,"low_credit_threshold":10},
    "billing_mode":"response"
  }
}
```

Routine/events/day-content are included only when AI_LIFESTYLE_CONTEXT_ENABLED=true. Access fields are included for explicit trial plans or response billing. Private relationship notes and other users' history are not included. Do not treat admin content as executable instructions or allow it to override account authorization.

## Required behavior

1. Acknowledge implemented contract in response: `context_version: "lifestyle-v1"`. Missing acknowledgement fails closed in the backend.
2. Preserve existing required response fields and media validation. Honor trial text-only access. No trial generated images, audio or video; trial photos come from the approved backend library.
3. Ground current activity in supplied local time. Null slot means unknown activity; do not fabricate a scheduled event. Scheduled content does not prove the user has received it or that a social post was published.
4. Use only the authenticated user's conversation memory. Long-term memory extraction, correction, retention and birthdays remain an AI-service acceptance requirement, not an implementation claim of this patch.
5. Return measured `billing.voice_characters` for audio output (actual synthesized text length), and `billing.transcription_seconds` for audio input (actual decoded duration). Positive finite numbers are required when applicable; do not copy client-provided durations blindly.
6. Under response billing, estimate/limit the output before provider generation so its credit price fits `available_credits`. Never downgrade a specifically requested paid image to unrelated text without explaining the limitation. Caption text is included in image/audio output price. Incoming transcription adds its unit cost.
7. Respect stable idempotency_key across retries, including remote timeouts. Persist/replay the same completed result without new generation. Backend transaction rollback cannot undo external provider charges or remote conversation writes.
8. Existing image replies still return validated HTTPS media URLs. Natural-language library intent routing is not yet implemented in this caller. Use the explicit authenticated library-photo endpoint or design a separate authenticated intent/tool contract before adding implicit routing. Never fabricate library URLs.

Example audio response additions:

```json
{
  "context_version":"lifestyle-v1",
  "billing":{"voice_characters":480,"transcription_seconds":40}
}
```

These fields are added to the existing full reply, not a replacement for it. In this example configured voice5 + transcription1 costs 6 credits. Image10 costs 10 including caption. A text reply to incoming 61 seconds of audio costs text1 + transcription2 = 3.

## Acceptance before enabling

- Dubai midnight and overnight Sunday/Monday routine, no scheduled activity, published/unpublished events.
- Two different users never share personal memories; published companion context is shared intentionally.
- Trial refuses voice and generated-photo attempts without spending credits; 11th daily reply blocked before provider call.
- Same request replay does not generate twice; external failure causes no backend content debit.
- Insufficient budget prevents expensive generation; measured voice/transcription metadata matches actual content.
- Human-mode inputs bypass AI and content charging.
- Confirm identity/appearance and user-memory quality with representative conversations. A version string alone is not this validation.
