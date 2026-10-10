# Meet Elysia — Frontend ও Admin integration নির্দেশনা

**প্রস্তুত: ১০ অক্টোবর ২০২৬ • ভাষা: বাংলা • ভিত্তি: বর্তমান NestJS source code**

এই document frontend engineer-এর handoff। Website, admin panel, subscription/credits এবং Telegram return flow একসঙ্গে implement করতে ব্যবহার করুন। এটি live deployment certification নয়। Source-এ যা আছে এবং যে কাজ নতুন করে লাগবে—দুটো আলাদা করে দেওয়া হয়েছে। কোনো secret, real password, customer record বা bot token দেওয়া হয়নি।

## ১. সঙ্গে দেওয়া ফাইল

- `frontend-integration-bn.md`: screen, business flow, request example, response ব্যবহার ও release checklist।
- `api-reference-bn.md`: সব ৯৫টি endpoint, access guard, query/body/upload parameter, controller response mapping এবং ৫২টি DTO class-এর exact field/validation। কোনো controller বাদ দেওয়া হয়নি।
- `api-contract.json`: একই route/DTO inventory machine-readable format; এটি OpenAPI নয়।
- `frontend-integration-bn.html`: browser-এ পড়ার জন্য guide ও সম্পূর্ণ reference একসঙ্গে।

Source পরিবর্তন হলে repo root থেকে `node scripts/export-frontend-contract.cjs` চালিয়ে reference regenerate করুন। মূল flow guide-ও পরিবর্তনের সঙ্গে review করতে হবে।

## ২. API connection ও response

Local base: `http://localhost:8080/api/v1`। Deployed base: `https://<backend-domain>/api/v1`। Frontend-এ একটি public environment variable-এ base URL রাখুন। Bot token, Stripe secret, database URL, JWT signing secret বা AI credentials frontend-এ যাবে না।

Protected request:

```http
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Normal JSON response:

```json
{
  "statusCode": 200,
  "success": true,
  "message": "...",
  "meta": {"page": 1, "limit": 10, "total": 20},
  "data": {}
}
```

`meta` সব endpoint-এ থাকে না। `data` object, array বা null হতে পারে। Response-এর success boolean ও HTTP status দেখুন; শুধু message string দিয়ে success নির্ধারণ করবেন না। Controller সরাসরি object return করলেও interceptor সাধারণত `data`-তে সেটি রাখে। HTML/legal pages ও raw webhook response আলাদা।

Request body-তে validation DTO অনুসরণ করুন। Whitelist চালু: অতিরিক্ত field পাঠালে persist হবে ধরে নেবেন না। IDs আলাদা: userId, companionId, conversationId, messageId, subscription plan ID, credit package ID ও Stripe subscription ID এক জিনিস নয়। Payment route-এর `subscriptionId` সাধারণত local **plan ID**; `sub_...` নয়।

## ৩. কোন screen-এ কোন API

এই guide-এর নিচের path-গুলোর আগে `/api/v1` যোগ হবে, যদি আলাদা করে না বলা থাকে।

| Screen/কাজ | API | Frontend-এর কাজ |
|---|---|---|
| Registration | POST `/auth/register` | নাম, email, phoneNumber, password, adultEligible |
| Login | POST `/auth/login` | accessToken ও sanitized user ব্যবহার |
| Session restore | GET `/auth/refresh`, GET `/user/my-profile` | cookie দিয়ে refresh; current role/status দেখুন |
| Forgot password | POST `/auth/forgot-password`, `/auth/verify-otp`, `/auth/reset-password` | ৩ ধাপ; resetToken ধরে শেষ request |
| Profile | GET/PUT `/user/my-profile` | profile form + optional profileImage |
| Companion listing | GET `/companions` | filters, pagination, profile cards |
| Companion details | GET `/companions/:id` | bio, personality, gallery, chat/connect CTA |
| Plans | GET `/subscription`, GET `/subscription/:id` | active plans, price, allowance, duration |
| Subscription payment | POST `/payment/subscription/:subscriptionId` | free activation বা Stripe clientSecret flow |
| Billing settings | GET `/payment/subscription/status`, POST `/payment/billing-portal` | current plan/status ও manage billing link |
| Wallet | GET `/credits/wallet`, `/chat/usage`, `/credits/costs` | effective balance, expiry, action costs |
| Buy credits | GET `/credits/packages`, POST `/payment/credits` | packageId দিয়ে payment শুরু |
| Ledger | GET `/credits/ledger` | paginated credit transaction history |
| Chat list | GET `/chat/conversations` | conversation cards |
| Chat room | GET/POST `/chat/:companionId/messages` | messages, reply, image/audio render |
| Relationships | GET `/relationships`, PATCH `/relationships/:companionId` | nickname, notes, interaction data |
| Stories | GET `/companions/:companionId/stories` | প্রকাশিত current/past story |
| Gallery unlock | POST `/companions/:companionId/photos/view` | photoUrl পাঠিয়ে unlock/charge ফলাফল |
| Photo history | GET `/photos/history` | আগে দেখা gallery items |
| Gifts | GET `/gifts`, POST `/gifts/:giftId/send` | companionId দিয়ে gift পাঠানো |
| Notifications | GET `/notifications`, PATCH `/notifications/:id/read` | list ও read state |
| Telegram connection | POST `/telegram/connect/:companionId`, GET `/telegram/status/:companionId` | secure link ও return-to-bot |
| WhatsApp connection | POST `/whatsapp/connect/:companionId` | returned whatsappUrl খুলুন |
| Newsletter | POST `/newsletter` | email subscription form |

## ৪. Registration, login ও password reset

Registration example (dummy data):

```json
{"name":"Demo User","email":"demo@example.com","phoneNumber":"+8801700000000","password":"ExampleOnly123!","adultEligible":true}
```

`adultEligible` user-এর confirmation থেকে নিন; silently true করবেন না। Register response-এ account data আসে, accessToken নয়; তারপর login করুন। `/user`-এও legacy create endpoint আছে; সাধারণ signup-এ `/auth/register` ব্যবহার করুন।

Login body:

```json
{"email":"demo@example.com","password":"ExampleOnly123!"}
```

`data.accessToken` API call-এ ব্যবহার করুন; `data.user.role` অনুযায়ী user/admin navigation দিন। Frontend route guard UX-এর জন্য; backend guard চূড়ান্ত authority। Login/subscription-এর পুরোনো JWT claim দিয়ে balance বা subscription সক্রিয় ধরে রাখবেন না।

Refresh token HttpOnly cookie-তে আসে। Login ও refresh request-এ `credentials: 'include'` বা Axios `withCredentials: true` লাগবে। বর্তমান cookie `secure:true`, `sameSite:'strict'`। আলাদা site/domain-এ frontend/backend বসালে refresh cookie block হতে পারে; HTTPS এবং same-site deployment/reverse proxy staging-এ যাচাই করুন। শুধু CORS চালু করলেই cross-site cookie ঠিক হয় না। Access token memory-তে রাখার design ব্যবহার করা যায়; password/OTP/resetToken localStorage-এ রাখবেন না।

Password reset:

1. POST `/auth/forgot-password`: `{"email":"demo@example.com"}`।
2. POST `/auth/verify-otp`: `{"email":"demo@example.com","otp":"123456"}`। OTP ছয় অক্ষরের string।
3. Response-এর `data.resetToken` নিয়ে POST `/auth/reset-password`: `{"email":"demo@example.com","password":"NewExample123!","resetToken":"<returned-token>"}`।
4. সফল হলে sensitive form state clear করে আবার login। Password পরিবর্তন/reset হলে পুরোনো session invalid হয়।

Change password: POST `/auth/change-password`, body `email`, `oldPassword`, `newPassword`। Logout: POST `/auth/logout`; UI token/state clear করুন।

## ৫. Subscription, payment ও wallet flow

Plan list থেকে local plan `id` নির্বাচন → POST `/payment/subscription/:subscriptionId`।

- Free plan: `data.activated:true`, `clientSecret:null` হলে payment form খুলবেন না। Usage/status refetch করুন। Free trial আবার নেওয়া বা existing subscription replace করা backend আটকায়।
- Paid plan: `data.clientSecret` দিয়ে Stripe frontend payment UI-তে confirmation সম্পন্ন করুন। Response-এর `stripeSubscriptionId`, `status`, `activated` fields optional/branch-dependent; missing field ধরে crash করবেন না।
- একই active plan থাকলে `alreadySubscribed:true` আসতে পারে। Existing recurring plan-এর জন্য নতুন subscription creation বারবার করবেন না।
- Plan বদলাতে POST `/payment/subscription/:subscriptionId/upgrade`; cancellation POST `/payment/subscription/cancel`। Cancellation-এর effective state response/status থেকে দেখান; সঙ্গে সঙ্গে expiry ধরে নেবেন না।
- Billing portal: POST `/payment/billing-portal` → `data.url` খুলুন।

**Payment success screen subscription/credit activation-এর প্রমাণ নয়।** Stripe webhook backend-এ state update করে। Confirmation-এর পরে POST `/payment/subscription/sync` (subscription-এর জন্য) → GET `/payment/subscription/status` → GET `/chat/usage` এবং `/credits/wallet`। Sync আবার charge করে না; purchased credit payment-এর generic sync API নয়।

Credit purchase:

```http
POST /api/v1/payment/credits
```
```json
{"packageId":"<credit-package-id>"}
```

`data.clientSecret` দিয়ে payment confirm করুন। `/credits/purchase` একই কাজের alternative route; **একই purchase-এর জন্য দুটো endpoint hit করবেন না**। Payment-এর পরে wallet সীমিত সময় poll করুন (যেমন ২–৩ সেকেন্ড interval, সর্বোচ্চ ৩০ সেকেন্ড; এটি frontend প্রস্তাব, backend guarantee নয়)। Pending থাকলে “Payment received; balance update pending” এবং Refresh/Support দেখান; আবার Pay চাপিয়ে duplicate purchase করাবেন না।

Usage response-এর fields:

| Field | ব্যবহার |
|---|---|
| subscription | active subscription object; না থাকলে null |
| subscription.startsAt/endsAt/createdAt | শুরু, শেষ ও record creation date |
| subscription.creditAllowance/creditsUsed/subscriptionCreditsRemaining | plan credit progress |
| purchasedCredits / creditBalance | effective purchased credit balance |
| totalCredits | plan remainder + purchased credits |
| lowCredit / threshold | low credit banner |

`messagesRemaining=0` দেখেই chat block করবেন না। Active subscription + যথেষ্ট purchased credits থাকলে backend credits ব্যবহার করতে পারে। UI-তে action-specific cost `/credits/costs` থেকে নিন; image/voice-কে text-এর সমান cost ধরবেন না। Active subscription না থাকলে purchased credits থাকলেও access-এর নিয়ম backend নির্ধারণ করে।

Wallet-এর `creditTransactions` recent ৫০টি; সব history চাইলে `/credits/ledger?page=1&limit=50`। `purchasedCreditLots`-এ `remainingAmount`, `expiresAt` পাওয়া যায়। Date UTC থেকে user timezone-এ format করুন। Amount decimal string আসতে পারে; display-এর জন্য সচেতনভাবে convert করুন। Client পাঠানো price/credit amount দিয়ে payment তৈরি হয় না—package/plan ID পাঠাতে হবে।

## ৬. Website থেকে Telegram—সঠিক end-to-end flow

1. Companion select → companionId ধরে রাখুন।
2. Login না থাকলে website login/register → সফল হলে আগের companion-এ ফিরুন।
3. GET `/chat/usage` ও `/telegram/status/:companionId`।
4. Subscription না থাকলে plan/payment flow শেষ করুন, তারপর status refetch।
5. Linked এবং active হলে status response-এর `data.telegramUrl` খুলুন। Credits পর্যাপ্ত কি না wallet/usage-এ আলাদা দেখুন।
6. Unlinked হলে POST `/telegram/connect/:companionId` (empty body)। Response `data.telegramUrl`, `data.expiresAt`।
7. Returned URL খুলে Telegram-এ Start চাপতে বলুন। Link ১০ মিনিট, single-use; page load-এ বারবার link তৈরি নয়, explicit button click-এ করুন।
8. Website-এ ফেরার পরে status refetch করে linked state দেখান। Expired/used link হলে নতুন link দিন।

Telegram status response fields: `companionId`, `companionName`, `linked`, `hasActiveSubscription`, `telegramUrl`, `creditsUrl`, `subscriptionUrl`। শুধু URL পাওয়া মানেই linked নয়।

**Automatic redirect-এর অর্থ:** website authentication/payment শেষে user-কে একটি স্পষ্ট “Continue in Telegram” button দিন। ইচ্ছা করলে সফল state-এ navigation চেষ্টা করা যায়, কিন্তু browser/app opening fail হলে button fallback রাখুন। Backend নিজে user-এর browser খুলে দেয় না এবং user-এর Start action bypass করে না।

### Telegram Mini App থেকে website-এ আসা

Existing backend login window: GET `/telegram/app?companionId=<uuid>`। Telegram-এর button থেকে খোলে। Signed `initData` ছাড়া সাধারণ browser-এ সেটিকে login page হিসেবে চালাবেন না।

- GET `/telegram/app/settings/:companionId`: companionName, botUrl, registerUrl, forgotPasswordUrl।
- POST `/telegram/app/login/:companionId`: `initData`, `email`, `password`, optional `confirmTransfer`।
- POST `/telegram/app/status/:companionId`: `{"initData":"<Telegram signed value>"}`।
- `linked:false`: login প্রয়োজন। `transferRequired:true` এলে পুরোনো Telegram binding বদলানোর স্পষ্ট consent এবং password re-entry ছাড়া confirmTransfer পাঠাবেন না।
- Linked হলে state `ready`, `subscription_required`, `credits_required`; `totalCredits`, `endsAt`, `actionUrl` দিয়ে UI দেখান। `ready` মানে সব ধরনের request-এর পর্যাপ্ত cost আছে এমন guarantee নয়।

Registration/reset/payment links-এ `companionId`, `source=telegram`, `returnTo` query আসতে পারে। Frontend auth ও payment navigation জুড়ে context ধরে রাখবে। `returnTo` untrusted input—শুধু নিজস্ব configured HTTPS backend/app URL allowlist করুন; arbitrary redirect করবেন না। Password/token query string-এ দেবেন না। Registration/login শেষে website bearer session তৈরি করে উপরের connect flow শেষ করুন। Telegram Mini App-এর signed session website bearer session-এর বিকল্প নয়।

## ৭. Chat, image, voice ও history

Text request:

```json
{"message":"Hi, how are you today?","type":"text"}
```

POST `/chat/:companionId/messages` response-এর `data`:

```json
{
  "message_type":"text",
  "media":null,
  "transcript":null,
  "mode":"ai",
  "message":{"id":"<saved-message-id>"},
  "response":"<companion reply>",
  "conversationId":"<conversation-id>",
  "usage":{"chargedFrom":"subscription","creditBalance":200}
}
```

এটি shape বোঝানোর সংক্ষিপ্ত example; সব saved message/usage field এখানে দেখানো হয়নি। `media` থাকলে `id`, `kind` (`image`/`audio`), `url`, `mime_type`, `byte_size` আসে। `message_type` অনুযায়ী text/image/audio render করুন; response null হতে পারে, বিশেষ করে human mode-এ। History-তে saved row-এর field ব্যবহার করুন; POST response ও history shape এক নয়।

- Image request একই text message endpoint দিয়ে natural-language request; request DTO-তে `type:"image"` নেই। AI image result না দিলে fake image success দেখাবেন না।
- বর্তমান chat service request-এর `type` দেখে text-এর জন্য `message` cost এবং voice-এর জন্য `voice` cost charge করে। AI image output হলেই আলাদা `photo` cost charge হয় না; `photo` cost উপরের gallery-view endpoint-এ ব্যবহৃত হয়। Pricing UI-তে এই পার্থক্য রাখুন।
- Website voice request DTO: `type:"voice"` এবং `message`-এ **transcript**। এই route multipart microphone file নেয় না। Website raw-audio upload/transcription-এর আলাদা API বর্তমানে নেই; প্রয়োজন হলে backend/AI integration কাজ লাগবে। Telegram voice pipeline আলাদা।
- Audio media URL যদি protected upstream হয়, browser playback authorization/CORS পরীক্ষা করতে হবে। বর্তমানে website-এর জন্য আলাদা media proxy endpoint controller-এ নেই।
- GET messages: `?page=1`; `data.messages`, `data.total`, `data.page`, `data.limit` (৫০)। Page-এর messages chronological order-এ আসে; পুরোনো page prepend করে ID অনুযায়ী dedupe করুন।
- Send চলাকালে button disable/loading দিন। Timeout হলে blind automatic POST retry করবেন না: website route-এ client-supplied idempotency field নেই। History refresh করে message save হয়েছে কি না বুঝে retry দিন।
- WebSocket/SSE controller নেই। New reply/notification চাইলে controlled polling বা নতুন realtime backend কাজ লাগবে। Telegram delivery আর website message save একই বিষয় নয়।

## ৮. Gifts, gallery, stories, relationships, notifications

- Gift send: POST `/gifts/:giftId/send`, `{"companionId":"<uuid>"}`। Cost ও wallet backend নির্ধারণ করে। Success-এর পরে wallet/history refetch।
- Gallery view/unlock: POST `/companions/:companionId/photos/view`, `{"photoUrl":"<galleryImages থেকে URL>"}`। Arbitrary URL নয়। আগে unlock করা একই photo আবার view করলে দ্বিতীয়বার charge হয় না। শুধু image render করলেই view API call হয় না।
- Gallery URL public response-এ পাওয়া গেলে blur UI-কে secure media paywall হিসেবে দাবি করবেন না; protected media delivery আলাদা কাজ।
- Relationship PATCH body: optional `nickname`, `notes`; আলাদা user/companion relationship।
- Stories user list শুধু published এবং current/past day; admin list unpublished/future-ও দেখতে পারে। একই companion/day admin save করলে upsert হয়।
- Notifications: list, mark-read; notification create করা Telegram push পাঠানোর সমান নয়।
- Engagement pagination `page` >=1, `limit` 1–100, default50। সব list-এ total/meta নেই; collection ছোট হলে next-page UX accordingly করুন।

## ৯. Admin panel—সম্পূর্ণ screen map

| Admin screen | Endpoint | Controls |
|---|---|---|
| Overview | GET `/dashboard/overview` | user, active subscriber, revenue, message ও conversation metrics |
| Users | GET `/user`, GET `/user/:id`, PUT `/user/:id`, DELETE `/user/:id` | search/filter, details, edit, delete |
| User finance/details | GET `/admin/users/:id/details`, `/admin/users/:id/ledger` | wallet, recent payments/subscriptions, relationships, ledger |
| Companions | GET/POST `/companions`, GET/PUT/DELETE `/companions/:id` | profile/personality/style/status forms |
| Companion images | PUT `.../:id/profile-image`, PUT `.../:id/cover-image`, POST/PUT `.../:id/gallery` | upload, append বনাম replace |
| Voice settings | PUT `/companions/:id/voice` | `voiceId` |
| Plan management | POST `/subscription`, PUT/DELETE `/subscription/:id` | price, allowance, duration, features, active/popular |
| Credit packages | POST `/credits/packages`, PATCH/DELETE `/credits/packages/:id` | name, credits, price, currency, active |
| Credit costs | PUT `/admin/credit-costs/:action` | message/photo/voice/low_credit_threshold |
| Gift management | POST `/gifts`, PATCH/DELETE `/gifts/:id` | gift fields, initial image upload, deactivate |
| Stories | GET/PUT `/admin/companions/:companionId/stories` | day, title, content, published |
| Conversations | GET `/admin/conversations`, GET `/admin/conversations/:id` | user/companion context ও messages |
| AI/human control | PATCH `/admin/conversations/:id/mode` | `{"mode":"human"}` বা `{"mode":"ai"}` |
| Human reply | POST `/admin/conversations/:id/replies` | messageId এবং message |
| Notification create | POST `/admin/notifications` | userId, title, body |
| Newsletter | GET `/newsletter`, GET `/newsletter/:id`, POST `/newsletter/broadcast` | subscribers ও email broadcast |

Overview-তে `totalSubscriptionPlans`, `activeSubscriptions`, `activeSubscribers`, `totalMessages`, `totalConversations`, `totalRevenue`, `totalUsers` ব্যবহার করুন। Legacy `totalConversions` আসলে message count; conversion-rate হিসেবে দেখাবেন না।

Human takeover: প্রথমে mode=human সেট করুন, তারপর নির্বাচিত unanswered user message-এর messageId দিয়ে reply করুন। Reply-কারী admin-এর assignment মিলতে হবে; answered message-এ 409 আসতে পারে। Current `humanReply` method response database-এ save করে এবং in-app notification তৈরি করে; **Telegram/WhatsApp outbound send করে না**। তাই “Reply delivered to Telegram” success label এখন দেবেন না।

Plan create example:

```json
{"name":"Premium","price":"29.99","creditAllowance":500,"durationDays":30,"features":["Text conversations","Voice replies"],"isPopular":true,"isActive":true}
```

Credit package create example:

```json
{"name":"Extra Credits","credits":200,"price":"4.99","currency":"usd","isActive":true}
```

Credit cost update body: `{"credits":5}`। Action path values: `message`, `photo`, `voice`, `low_credit_threshold`। Arbitrary action তৈরি করা যাবে না। Package ও gift DELETE deactivation করে; user/companion/plan delete-এর জন্য confirmation UI দিন এবং server restriction/error দেখান, cascading effect অনুমান করবেন না।

**DTO-তে থাকা সব field-এর exact spelling ও nested structures reference document-এ আছে।** Companion create-এর nested personality, communication, relationship/style fields বাদ দিয়ে শুধু name পাঠালে পূর্ণ model তৈরি হবে ধরে নেবেন না। API model অনুযায়ী tabbed admin form তৈরি করুন।

## ১০. Upload ও list contract

| কাজ | Encoding | File field |
|---|---|---|
| Own/admin user profile | multipart/form-data | profileImage |
| Companion create/update metadata | application/json | file নয়; আলাদা image endpoints |
| Companion profile | multipart/form-data | profileImage, ১টি |
| Companion cover | multipart/form-data | coverImage, ১টি |
| Gallery append/replace | multipart/form-data | galleryImages, সর্বোচ্চ১০টি |
| Gift create | multipart/form-data | image |

FormData পাঠানোর সময় Content-Type boundary browser-কে বানাতে দিন। Upload helper-এর per-file limit ১০MB; frontend-এও যাচাই করুন। Companion gallery POST append, PUT replace। ভুল করে PUT দিয়ে পুরোনো gallery মুছবেন না। Gift PATCH controller-এ upload interceptor নেই; create upload-এর মতো file PATCH করবেন না।

Query names exact reference-এ আছে। Common `page`, `limit`, `sortBy`, `sortOrder` সব route-এ নেই। User list filters: searchTerm/role/email/name। Subscription: searchTerm/name/features/isPopular/isActive। Companion list controller-এর pick allowlist ও ApiQuery metadata দুটো reference-এ দেখুন; unchecked arbitrary sort field দেবেন না।

## ১১. Webhook ও infrastructure route—frontend button নয়

সব exact webhook route reference-এর inventory-তে আছে। Stripe POST `/webhook` raw body ও `stripe-signature` দিয়ে provider call করবে। Frontend fake webhook বা payment success লিখে subscription/credit grant করতে পারবে না। Telegram webhook-এ bot-specific secret validation হয়; WhatsApp-এ provider verification/signature। Bot secrets browser-এ দেওয়া যাবে না।

GET `/health/live` process health; GET `/health/ready` database/runtime-table readiness। Ready সফল মানে AI, mail, Stripe সব tested নয়। Root `/`, `/privacy-policy`, `/terms`, `/data-deletion` global API prefix-এর বাইরে। Backend-এ থাকা legal text publish-এর আগে owner review করবেন।

WhatsApp connect response `data.whatsappUrl` খুলে prefilled START message user-কে send করতে হবে। `/whatsapp/test` বর্তমান guard-এ user/admin দুটোই আছে, যদিও এটি operational testing route; সাধারণ user UI-তে expose করবেন না, backend permission review লাগবে।

## ১২. Error ও UX handling

| Status | UI আচরণ |
|---|---|
| 400 | validation/operation message দেখান; field value ঠিক করতে দিন |
| 401 | refresh একবার চেষ্টা; ব্যর্থ হলে login, redirect loop নয় |
| 402 | usage refetch; subscription নেই হলে Subscribe, active কিন্তু credit কম হলে Buy Credits |
| 403 | approved/adult/account permission সমস্যা; আবার payment নয় |
| 404 | item নেই বা companion unavailable |
| 409 | account conflict/already answered/takeover conflict; state refetch |
| 429 | retry-after থাকলে মানুন; cooldown দেখান, loop নয় |
| 502/503 | upstream/database temporarily unavailable; retry option, raw stack নয় |

Error body সাধারণত `success:false`, `statusCode`, `message`, `errorSources`। Production stack user-কে দেখাবেন না। Rate limits-এর কারণে repeated login retry এড়িয়ে চলুন। Paid POST request auto-retry নয়। UI loading, empty, pending-payment, failed, expired-link, insufficient-credit—সব state design করুন।

## ১৩. Frontend URL ও deployment সমন্বয়

| Backend env | Frontend engineer কী দেবে |
|---|---|
| FRONTEND_URL | website HTTPS origin |
| CORS_ORIGINS | user website/admin-এর exact allowed origins |
| TELEGRAM_CONNECT_URL | website login/connect page |
| TELEGRAM_REGISTER_URL | registration page |
| TELEGRAM_FORGOT_PASSWORD_URL | reset flow entry page |
| TELEGRAM_SUBSCRIPTION_URL | plan/checkout page |
| TELEGRAM_CREDITS_URL | credit-package checkout page |

Paths design প্রস্তাব: `/login`, `/register`, `/forgot-password`, `/subscriptions`, `/credits`, `/companions/:id`, `/chat/:id`, `/account`, `/admin`। এগুলো API route নয় এবং এখন deploy করা frontend page হিসেবে যাচাই করা হয়নি। Actual route তৈরি করে URL backend engineer-কে দিন। `/api/docs` কখনো user checkout/register page নয়। Frontend URL changing-এ env update ও backend restart লাগে। Mini App-এ পুরোনো button থাকলে নতুন `/login` button নিন।

Production backend rollout/migration/queue/HTTPS নির্দেশনা repo-এর `docs/production-deployment.md`-এ আছে। Frontend credentials দিয়ে migration বা bot setup করবে না। Telegram-এর digital purchase policy সিদ্ধান্ত backend/payment owner-এর সঙ্গে confirm করতে হবে; website Stripe flow থাকা মানেই Telegram in-app sales release অনুমোদিত ধরে নেবেন না।

## ১৪. জানা সীমাবদ্ধতা ও handoff blockers

1. Website raw voice upload/transcription route নেই; transcript-only chat contract আছে।
2. Website realtime socket/SSE route নেই; controlled polling বা নতুন backend কাজ লাগবে।
3. Admin human reply Telegram/WhatsApp-এ push হয় না।
4. Website admin profile image update Telegram bot-এর BotFather picture/name নিজে বদলায় না। Bot branding আলাদা configuration।
5. Bot token/username/env পরিবর্তনের public admin endpoint নেই। Frontend-এ এমন Save button বানাবেন না যার API নেই।
6. User self-service Telegram unlink endpoint নেই; transfer flow আলাদা।
7. General all-payments export, refund API, manual wallet top-up API এই controller set-এ নেই। Admin user details-এ recent payment data আছে; এর বাইরে feature হলে backend contract লাগবে।
8. Newsletter GET list/detail controller-এ JWT guard নেই। Subscriber data public হওয়া launch-এর আগে backend review/fix দরকার; শুধু UI লুকানো protection নয়।
9. `/whatsapp/test` user role-ও গ্রহণ করে। Public launch-এর আগে access policy ঠিক করুন।
10. Cookie same-site deployment, registration/payment return handling, protected audio playback, real checkout URLs ও mobile test এখনো frontend integration-এর acceptance কাজ।
11. Response inventory source-derived; provider-dependent live response ও field nullability staging-এ verify করতে হবে। কোনো route list মানেই feature live-tested নয়।
12. User update service বর্তমানে optional password না থাকলেও bcrypt.hash call করে। তাই name/photo-only profile update fail হতে পারে। Frontend থেকে dummy password পাঠিয়ে workaround করবেন না; backend fix প্রয়োজন।
13. UpdateUserDto-তে role/status/adultEligible নেই। এই fields দিয়ে admin approve/block/role-change control বর্তমানে কাজ করবে ধরে UI বানাবেন না; আলাদা backend contract লাগবে।

## ১৫. Implementation order ও acceptance checklist

প্রথমে shared API client + authentication → companion pages → subscription/wallet/payment → Telegram return flow → website chat/media → user account/history → admin management → device/error-state tests।

- [ ] Registration, login, refresh, logout; wrong password এবং blocked user।
- [ ] OTP → resetToken → password reset; পুরোনো token invalid।
- [ ] User role দিয়ে admin request rejected; admin-কে user-only chat endpoint access ধরে নেওয়া হয়নি।
- [ ] Free trial একবার; paid plan success/cancel/failure/incomplete এবং renew/cancel state।
- [ ] Stripe success কিন্তু webhook pending UI; duplicate Pay prevention।
- [ ] Plan credits শেষ, purchased credits আছে—chat চালু। Subscription expired হলে সঠিক CTA।
- [ ] Credit expiry ও ledger; image/voice/gift costs, no double charge on photo re-view।
- [ ] Website → Telegram fresh link → Start → linked; expired link recovery।
- [ ] Mini App → registration/payment → website session → Continue in Telegram।
- [ ] Wrong Telegram account transfer consent; no silent reassignment।
- [ ] Text/media/history, null response, loading, timeout, retry এবং human mode।
- [ ] Admin companion nested fields, append/replace gallery, plan/package/story/cost update।
- [ ] Newsletter/test-route access blockers owner resolved।
- [ ] Android/iOS/Desktop/Web; website HTTPS cookie ও cross-origin media।
- [ ] Final URLs, production payment mode, webhooks, backups/migrations deployment team verified।

## ১৬. ছোট frontend request example

```typescript
// BASE আপনার public frontend environment থেকে আসবে।
async function request(path: string, token?: string, body?: unknown) {
  const response = await fetch(`${BASE}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'include',
    headers: {
      ...(body === undefined ? {} : {'Content-Type': 'application/json'}),
      ...(token ? {Authorization: `Bearer ${token}`} : {}),
    },
    ...(body === undefined ? {} : {body: JSON.stringify(body)}),
  });
  const result = await response.json();
  if (!response.ok || result.success === false) {
    throw Object.assign(new Error(result.message || 'Request failed'), {
      status: response.status, details: result.errorSources,
    });
  }
  return result; // data ও optional meta caller আলাদাভাবে ব্যবহার করবে।
}

// Click handler-এ call; page mount-এ বারবার connect token তৈরি করবেন না।
const connected = await request(`/telegram/connect/${companionId}`, token, {});
window.location.assign(connected.data.telegramUrl);
```

এটি minimal example; production API client-এ abort/loading, একবার refresh, form field error mapping এবং safe redirect allowlist যোগ করুন। PATCH/PUT/DELETE/upload-এর জন্য method-aware wrapper লাগবে।
