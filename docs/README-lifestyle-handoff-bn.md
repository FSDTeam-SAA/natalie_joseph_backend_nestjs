# Meet Elysia — backend, frontend ও AI handover

আপডেট: ২৫ অক্টোবর ২০২৬। এই ফাইল বর্তমান source change-এর নির্দেশনা; production deployment বা external AI acceptance test-এর প্রমাণ নয়।

## ১. প্রোজেক্ট ও ক্লায়েন্টের মূল চাহিদা

Meet Elysia-তে Elena, Chloé, Lina, Luna ও Thalia নামের পাঁচটি fictional AI companion আছে। Website account, subscription ও credits ব্যবহার করে Telegram এবং website-এ কথা বলা যাবে। Companion-এর routine, approved daily content ও conversation একই জীবনধারার সঙ্গে মিলবে। ক্লায়েন্ট বলেছেন এই consistency মূল concept-এর অংশ।

চাহিদা: weekly routine/timezone; দিনে একটি পূর্বনির্ধারিত photo এবং একটি text; একই companion-এর একই দিনের photo সব eligible subscriber-কে; generic photo-র জন্য approved library; specific request-এর জন্য AI generation; trial ও paid allowance আলাদা। ছবি **frontend থেকে upload হবে**, backend নতুন library ছবি নিজে বানায় না।

## ২. আগে থেকেই থাকা কাজ

Source-এ account/auth, companion CRUD, Telegram account linking ও Mini App login, external AI chat/audio integration, subscription/Stripe webhook, purchased-credit expiry/ledger, relationship notes, dated StoryEvent, notifications, human takeover, ২৪ ঘণ্টার media stories ও Telegram profile sync আছে। এগুলো থাকা মানেই সব production configuration বা external service যাচাই হয়ে গেছে—এমন নয়।

## ৩. এই পরিবর্তনে যুক্ত কাজ

| অংশ | backend আচরণ |
|---|---|
| Weekly routine | IANA timezone, ISO weekday, overnight activity ও overlap validation |
| Photo library | frontend multipart upload, signature-based image type check, tags, admin approval, unseen-photo selection |
| Daily publishing | companion/local-date অনুযায়ী একটি approved photo + text, publish/expiry window |
| Daily delivery | opt-in, active plan, included allowance, website inbox এবং linked Telegram delivery |
| Duplicate protection | user/content/kind unique reservation; uncertain Telegram send auto-retry হয় না |
| Trial | explicit trial policy হলে ৩ দিন, সর্বোচ্চ ১০ reply/২৪h ও ৩০ মোট; ১ photo/২৪h ও ৩ মোট; voice blocked |
| Plan policy | plan থেকে membership-এ snapshot; plan edit পুরোনো membership বদলায় না |
| Billing | response-based charging প্রস্তুত, আলাদা flag; actual AI output ও measured voice/transcription units |
| Retry | website chat ও library request-এ requestId; একই request retry-তে নতুন charge নয় |
| AI context | opt-in contract দিয়ে approved routine/events/day-content; private relationship notes পাঠানো হয় না |

## ৪. নতুন API তালিকা

সব path-এর আগে `/api/v1`। Admin API-তে admin JWT, user API-তে user JWT দিন। Swagger `/api/docs`। Global response envelope-এর `data` পড়ুন। List-এ `?page=1`, প্রতি page ৫০টি।

Admin base: `/admin/companions/{companionId}/lifestyle`

| Method | Base-এর পরে | কাজ |
|---|---|---|
| GET / PUT | `/routine` | weekly routine পড়া/সম্পূর্ণ replace |
| GET | `/context` | এখনকার local time, activity ও published events preview |
| POST | `/photos` | image upload; default unapproved |
| GET | `/photos` | library list |
| PATCH | `/photos/{photoId}` | approve/revoke: `{"approved":true}` |
| PUT | `/daily-content` | day অনুযায়ী draft তৈরি বা replace/publish |
| GET | `/daily-content` | schedules list |
| POST | `/daily-content/{contentId}/unpublish` | ভবিষ্যৎ reservation বন্ধ; already-sent message মুছে দেয় না |
| GET | `/deliveries` | sent/available/skipped/failed/unknown/sending record |

| User method | Path | কাজ |
|---|---|---|
| GET / PUT | `/lifestyle/preference` | daily content-এর companion ও opt-in |
| GET | `/lifestyle/allowances` | subscription policy এবং consumed allowance |
| GET | `/lifestyle/inbox` | নিজের available daily content; active adult subscription required |
| POST | `/lifestyle/companions/{companionId}/photo` | approved unseen library image; requestId required |
| POST | `/chat/{companionId}/messages` | existing chat; optional requestId যোগ হয়েছে |

### Routine request

```json
{
  "timezone": "Asia/Dubai",
  "weekly": [
    {"day":1,"start":"06:00","end":"12:00","activity":"Coffee at home, then gym","location":"Dubai"},
    {"day":1,"start":"12:00","end":"18:00","activity":"Work on laptop at a cafe"},
    {"day":1,"start":"18:00","end":"23:00","activity":"Dinner with friends"},
    {"day":1,"start":"23:00","end":"06:00","activity":"Sleep"}
  ]
}
```

Monday=1, Sunday=7। উদাহরণে শুধু Monday; frontend অন্য ছয় দিনের slot-ও পাঠাবে। `23:00→06:00` পরের দিন শেষ হয়। পাশের slot overlap করলে 400। Unscheduled সময় currentActivity=null; AI-কে বানিয়ে activity বলার নির্দেশ দেওয়া হয়নি।

### Frontend image upload

```javascript
const body = new FormData();
body.append('image', selectedFile);
body.append('caption', 'A quiet morning before the gym.');
body.append('tags', 'gym,morning,sporty');
const response = await fetch(`${API}/admin/companions/${companionId}/lifestyle/photos`, {
  method: 'POST', headers: { Authorization: `Bearer ${adminToken}` }, body
});
```

`API`-তে backend URL + `/api/v1`। Browser-এ Content-Type নিজে বসাবেন না; multipart boundary browser বসাবে। JPEG/PNG/WebP, সর্বোচ্চ ১০ MB। Existing Cloudinary uploader ব্যবহার হয় এবং সর্বোচ্চ 500×500 fit করে; full-resolution originals রাখার ব্যবস্থা এই endpoint নয়। Response-এর `id` রেখে PATCH approval দিন। অন্য companion-এর photoId ব্যবহার করা যাবে না।

### Daily content schedule

```json
{
  "day":"2026-11-01",
  "publishAt":"2026-11-01T08:00:00+04:00",
  "expiresAt":"2026-11-01T23:59:00+04:00",
  "photoId":"APPROVED-PHOTO-UUID",
  "text":"Good morning! Coffee first, then a little time at the gym.",
  "activity":"Morning coffee and gym",
  "published":true
}
```

Real UUID দিন। Timestamp-এ timezone/offset দিন। `day` companion local date-এর সঙ্গে মিলতে হবে। Delivery window positive এবং সর্বোচ্চ ২৪ ঘণ্টা। আগের দিনের content catch-up করে পাঠানো হয় না। Delivery record তৈরি হলে সেই content edit করা বন্ধ থাকে; আগে draft preview করুন।

Frontend daily opt-in:

```json
{"companionId":"COMPANION-UUID","enabled":true}
```

Library request:

```json
{"requestId":"NEW-UUID-PER-ACTION","tag":"gym"}
```

Retry-তে একই UUID; নতুন action-এ নতুন UUID। Empty tag দিলে যেকোনো unseen approved photo। নতুন ছবি না থাকলে 404, কোনো debit নয়। Paid extra library request-এ configured `photo` rate লাগে; trial-এ included photo allowance লাগে। Scheduled included photo আলাদা করে credit কাটে না।

## ৫. Telegram ব্যবহার

- `/photo` বা `/photo gym`: library image; menu থেকেও নির্বাচন করা যায়।
- `/daily`: ওই companion-এর daily update opt-in।
- `/daily_off`: daily update বন্ধ।
- `/stories`: আগের ২৪ ঘণ্টার story viewer। **Daily subscription photo ও ২৪ ঘণ্টার Story পৃথক feature।**
- নতুন menu register: project root থেকে `node scripts/telegram.cjs menu`। এটি live bot settings বদলায়; এই implementation-এর tests-এ command চালানো হয়নি।

Natural-language chat যেমন “send me a gym photo” স্বয়ংক্রিয়ভাবে library endpoint-এ route করে না। External AI/intent layer-এ routing যোগ করতে হবে, অথবা frontend/Telegram menu-এর explicit photo action ব্যবহার করতে হবে। Specific AI image আগের AI chat flow-তে যায়।

## ৬. Subscription ও credit configuration

Admin `POST /subscription`, existing plan `PUT /subscription/{id}`। নতুন field:

```json
{
  "name":"Premium",
  "price":"29",
  "durationDays":30,
  "creditAllowance":500,
  "messageLimit":0,
  "features":["Daily photo and text","500 credits"],
  "entitlementPolicy":{"kind":"paid","dailyPhoto":true,"dailyText":true}
}
```

VIP-তে client proposal: price=59, creditAllowance=1200। Trial configuration:

```json
{
  "name":"Trial",
  "price":"0",
  "durationDays":3,
  "creditAllowance":0,
  "messageLimit":0,
  "features":["10 replies and one photo per trial day"],
  "entitlementPolicy":{"kind":"trial","trialRepliesPerDay":10,"trialRepliesTotal":30,"trialPhotosTotal":3}
}
```

Trial নতুন AI contract সমর্থিত হলে চালু করুন। Existing zero-price activation-এর one-use account check বহাল আছে। Trial স্বয়ংক্রিয় paid conversion যোগ করা হয়নি। পুরোনো `{}` policy-কে paid legacy হিসেবে ধরা হয়; সেটি daily inclusion দেয় না। পুরোনো membership backfill/financial balance migration এই patch নিজে চালায় না।

Rates: `PUT /admin/credit-costs/{action}` body `{"credits":10}`। Read `/credits/costs`। Client proposal অনুযায়ী `message=1`, `photo=10`, `voice=5`, `transcription=1` set করা যায়। বর্তমান DB rates overwrite করা হয়নি; fallback defaults message1/photo5/voice3/transcription1 আগের pricing-compatible রাখা হয়েছে। Extra package proposal: 100/$7.99, 250/$17.99, 500/$32.99—existing package CRUD ব্যবহার করুন।

`AI_RESPONSE_BILLING_ENABLED=true` হলে:

- Text reply: `message` credits; user text-এর জন্য আলাদা debit নয়।
- Generated photo: `photo` credits; caption-এর জন্য অতিরিক্ত text charge নয়।
- Generated voice: `ceil(voice_characters/500) × voice`।
- Incoming audio: উপরের output charge-এর সঙ্গে `ceil(transcription_seconds/60) × transcription`।
- Human-mode input বা failed AI response: কোনো content debit নয়।
- Missing/invalid AI billing measurement হলে 502, wallet transaction rollback।

Flag false হলে legacy text/voice charge রাখা হয়; নতুন rates/UI চালু করার আগে AI contract test করে flag চালু করুন। Subscription-first, purchased expiry ordering আগের ledger-এ আছে। User upgrade-এ নতুন membership snapshot তৈরি হয়। Existing unused subscription-credit expiry নিয়ম অপরিবর্তিত।

## ৭. Daily quota ও delivery-এর সীমা

- Account প্রতি এক নির্বাচিত companion-এর daily feed—পাঁচজনের প্রতিটির জন্য আলাদা free allowance নয়। Client চাইলে এই business rule পরে নির্দিষ্টভাবে বদলাতে হবে।
- Paid included allowance UTC calendar day; trial day startsAt থেকে rolling ২৪ ঘণ্টা। Routine ও content date companion timezone-এ।
- Trial library request ও scheduled daily photo একই included_photo allowance ব্যবহার করে।
- Website-only opt-in user-ও inbox পায়; Telegram linked থাকলে send হয়। Daily worker প্রতি মিনিটে চলে, bounded batch ব্যবহার করে; ঠিক নির্দিষ্ট সেকেন্ডে delivery guarantee নয়।
- `available`: website inbox-এ আছে; `sent`: Telegram send confirmed; `failed`: definitive rejection; `unknown`: outcome ambiguous; `skipped`: entitlement/quota নেই।
- Failed/unknown Telegram send-এ content inbox-এ থাকে। Automatic resend নেই, যাতে duplicate message না যায়। Manual operational review দরকার; bulk retry endpoint যোগ করা হয়নি।
- Unpublish/revoke already-downloaded photo বা sent Telegram message সরায় না। Cloudinary URLs existing public asset model ব্যবহার করে; এটি DRM/private expiring-media implementation নয়।

## ৮. ENV ও deployment

Local `.env`-এ missing keys false হিসেবে যোগ করা হয়েছে:

```dotenv
DAILY_CONTENT_DELIVERY_ENABLED=false
AI_LIFESTYLE_CONTEXT_ENABLED=false
AI_RESPONSE_BILLING_ENABLED=false
```

Deployment order:

1. Database backup ও migration review করুন। এই কাজের সময় production DB migration চালানো হয়নি।
2. `npm ci`
3. `npx prisma migrate deploy` — নতুন additive migration `20261024120000_lifestyle_content_allowances`।
4. `npx prisma generate`
5. `npm run build` এবং `npm test -- --runInBand`
6. Server restart করুন; প্রথমে flags=false রাখুন। Code নতুন columns select করে, তাই migration ছাড়া নতুন build চালাবেন না।
7. Test admin দিয়ে routine → photo upload → approve → schedule করুন; test user membership policy/opt-in সেট করুন।
8. Controlled staging environment-এ daily flag true করে inbox/Telegram যাচাই করুন। Production daily flag true করলে সব eligible opted-in user-এর due content যাবে।
9. AI team contract implement/verify করার পরে context ও billing flags true করুন।
10. স্থায়ী HTTPS base/frontend URLs এবং existing Telegram/Cloudinary credentials ঠিক রাখুন। Ngrok URL production base নয়।

নতুন কোনো bot token লাগে না। Existing `TELEGRAM_{NAME}_COMPANION_ID`, `TELEGRAM_{NAME}_BOT_TOKEN` এবং Cloudinary settings ব্যবহৃত হয়। কোনো secret এই document-এ রাখবেন না।

## ৯. External AI team-এর কাজ

পড়ুন [AI contract](./ai-lifestyle-contract.md)। এই NestJS repo-তে model training বা AI model source নেই। Routine ব্যবহার, character identity/appearance consistency, long-term user memory এবং natural-language library routing external AI team-কে implement/verify করতে হবে। Client-এর private notes অন্য service-এ পাঠানো এই change-এর অংশ নয়।

Instagram/social auto-posting, short-video generation, CCBill/Segpay gateway ও payment-provider approval এই change-এ করা হয়নি। Existing project-এ এগুলো “done” ধরে নেবেন না।

## ১০. Frontend team-এর checklist

- Admin routine editor, timezone selector, photo upload/approval list, daily schedule draft/preview/publish।
- User daily opt-in companion selector, inbox, allowance display, library-photo button, insufficient-credit/trial-limit UI।
- FormData image upload; Bearer token; retries-এ requestId reuse। 400/402/403/404/429/502 স্পষ্টভাবে দেখান।
- Failed/unknown Telegram delivery status admin-এ দেখান; user-কে নতুন charge দিয়ে automatic retry করাবেন না।
- Existing account, subscription, wallet, Mini App ও stories pages যুক্ত করুন। API docs frontend implementation নিজে তৈরি করে না।

Source contract index: [সম্পূর্ণ API reference](./frontend-handoff/api-reference-bn.md)।

## ১১. পরবর্তী developer/AI agent-এর নির্দেশনা

প্রথমে `git diff`, Prisma migration, `lifestyle` module, `chat.service.ts`, `aiapi.ts` এবং tests পড়ুন। `.env` values, JWT, OTP, password বা bot token document/log-এ লিখবেন না। Test ছাড়া live broadcast/payment/plan mutation করবেন না। External AI acknowledgement পেলে সেটিকে model quality প্রমাণ ধরে নেবেন না—routine, timezone, birthday/memory ও multi-user consistency-এর বাস্তব acceptance test আলাদা করুন।

## ১২. যাচাইয়ের ফল

Nest build ও Prisma schema validation পাস। Automated tests: ১৩টি suite, ৮৩টি test পাস; changed implementation-এর targeted ESLint পাস। এগুলো mocked service/unit tests—live Telegram delivery, Cloudinary upload, production migration বা external AI compatibility test নয়। Production enable করার আগে উপরের staging flow সম্পন্ন করুন।
