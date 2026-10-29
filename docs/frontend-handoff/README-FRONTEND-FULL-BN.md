# Meet Elysia — সম্পূর্ণ Frontend ও Admin API README

**তারিখ: ২৯ অক্টোবর ২০২৬ • Source-derived handover • 118টি route • 61টি DTO class**

Frontend engineer-কে **এই একটি ফাইল** দিলেই website এবং admin dashboard-এর API mapping, flow, upload, DTO, access ও response mapping পড়তে পারবেন। এটি বর্তমান local backend source-এর contract; deployed server একই version চালাচ্ছে কি না rollout team যাচাই করবে। কোনো credentials এই ফাইলে নেই।

## পড়ার ক্রম

1. [Website ও dashboard page map](#screens)
2. [সব API কোন কাজ করে](#routes)
3. [Login, payment, chat ও implementation guide](#flows)
4. [Profile sync ও 24-hour media Story](#publishing)
5. [Routine, image library, daily content ও trial](#lifestyle)
6. [প্রতিটি API-এর exact input/response mapping](#exact)
7. [সব DTO field ও validation](#dto)

Base URL উদাহরণ: local `http://localhost:8080/api/v1`; project-এর দেওয়া deployed URL `https://natalieapi.duckdns.org/api/v1` (এই documentation task-এ live availability পরীক্ষা হয়নি)। Swagger `/api/docs`, deployment-এ enabled থাকতে হবে। Frontend-এর public ENV-তে শুধু API base ও প্রযোজ্য publishable payment key; server secrets নয়।

<a id="screens"></a>
## Website page map

| Page / component | API group | UI কী করবে |
|---|---|---|
| Home, companion cards | GET /companions, GET /media-stories/summary (authenticated) | Cards, filters, pagination, active Story ring |
| Companion detail | GET /companions/:id | Bio/personality/gallery, chat ও Telegram CTA |
| Register / login / reset | /auth/* | Account creation, token/cookie session, OTP reset |
| My account | /user/my-profile, /auth/change-password | Profile ও password forms; known update limitation দেখুন |
| Plans / checkout | GET /subscription, POST /payment/subscription/:subscriptionId | Plan select ও free/paid flow |
| Billing | /payment/subscription/status, /sync, /cancel, /:subscriptionId/upgrade, /payment/billing-portal | Current state, reconciliation, cancel/upgrade/manage billing |
| Wallet / buy credits | /credits/wallet, /credits/packages, /credits/costs, /credits/ledger, POST /payment/credits | Balance, costs, expiry, checkout, history |
| Chat | /chat/conversations, /chat/:companionId/messages, /chat/usage | Text/media result, history, loading, retry requestId |
| Photo library request | POST /lifestyle/companions/:companionId/photo | Approved image, optional tag, requestId |
| Daily feed & preferences | /lifestyle/preference, /lifestyle/allowances, /lifestyle/inbox | Opt-in, selected companion, allowance, daily content |
| 24-hour Story viewer | /media-stories/summary, /media-stories/companions/:companionId | Feed, signed media, expiry, next/previous |
| Life events | /companions/:companionId/stories | Published dated text events; media Story নয় |
| Gallery unlock / history | /companions/:companionId/photos/view, /photos/history | Existing gallery item unlock; library upload নয় |
| Gifts / relationship | /gifts, /gifts/:giftId/send, /relationships | Catalogue, gift debit, nickname/notes |
| Notifications | /notifications, /notifications/:id/read | List ও read state |
| Continue in Telegram | /telegram/status/:companionId, /telegram/connect/:companionId | Login/subscribe/connect/return flow |
| Newsletter / legal | POST /newsletter; /privacy-policy, /terms, /data-deletion | Subscribe ও legal pages; legal paths API prefix-এর বাইরে |

## Admin dashboard page map

| Screen | API | বাস্তব কাজ |
|---|---|---|
| Overview | GET /dashboard/overview | Summary cards; date-series chart API নেই |
| Users | /user + /admin/users/:id/details + /admin/users/:id/ledger | Search, details, existing edit/delete, financial history |
| Companion editor | /companions + /:id/voice | Nested profile/personality/background/voice fields |
| Images | /companions/:id/profile-image, /cover-image, /gallery | Upload; gallery POST append বনাম PUT replace |
| Telegram branding | /admin/companions/:companionId/telegram-profile + /retry | Desired name/about/description ও pending/synced/failed |
| Photo library | /admin/companions/:companionId/lifestyle/photos | Frontend file upload → approve/revoke → list |
| Weekly routine | .../lifestyle/routine, .../lifestyle/context | Timezone, weekly slots, current activity preview |
| Daily schedule | .../lifestyle/daily-content, .../deliveries | Approved photo+text schedule, unpublish, delivery status |
| Media Stories | /admin/companions/:companionId/media-stories | Photo/video upload, list/remove |
| Text life events | /admin/companions/:companionId/stories | day/title/content/published |
| Plans | /subscription | Price, allowance, duration, features, policy |
| Extra packages / rates | /credits/packages, /admin/credit-costs/:action | Package CRUD; message/photo/voice/transcription costs |
| Gifts | /gifts | Catalogue CRUD/deactivation |
| Conversation support | /admin/conversations, /:id, /:id/mode, /:id/replies | Monitoring/takeover/human reply; outbound limitation দেখুন |
| Notifications/newsletter | /admin/notifications, /newsletter/broadcast | Explicit notification/email action |

Admin overview data keys: `totalUsers, totalSubscriptionPlans, activeSubscriptions, activeSubscribers, totalMessages, totalConversations, totalRevenue`। Legacy `totalSubscriptions` = plan count, `totalConversions` = message count। এগুলো conversion-rate chart নয়। Revenue currency conversion করে না; mixed-currency financial chart অনুমান করবেন না।

## চার ধরনের content গুলিয়ে ফেলবেন না

| Content | উদ্দেশ্য | Contract |
|---|---|---|
| Companion gallery | Profile-এর existing image collection ও unlock | /companions/:id/gallery; /photos/view |
| Text StoryEvent | দিনভিত্তিক life-event context | /admin/companions/:id/stories |
| 24h media Story | Expiring photo/video viewer | /media-stories/... |
| Daily subscription content | Included daily approved photo+text | /lifestyle/... |

একটির upload করলে অন্যটিতে automatic publish হয় না। Client-approved image frontend থেকে পাঠাতে হবে; backend admin-এর বদলে ছবি নির্বাচন করে upload করে না।

<a id="routes"></a>
## সব API-এর কাজ ও access

নিচের path **সম্পূর্ণ**; API base-এ ইতিমধ্যে /api/v1 থাকলে সেটি আবার যোগ করবেন না। Guard নেই মানে সব public নয়—signed media ticket, Telegram initData এবং provider webhook signatures আলাদাভাবে যাচাই হয়। User/admin উভয় role লেখা থাকলেও সাধারণত resource authenticated user-এর; arbitrary userId permission নয়।

## Response data কোথা থেকে পড়বেন

সব response-এ একই list shape ধরে frontend hook লিখবেন না। নিচে HTTP JSON response-কে `result` বলা হয়েছে।

| API | UI data path | Pagination/নোট |
|---|---|---|
| GET /companions, /subscription, /user, /newsletter | result.data = array | result.meta.page/limit/total |
| GET /credits/packages, /gifts | result.data = array | Collection-এর actual fields অনুসরণ করুন |
| GET /chat/:companionId/messages | result.data.messages | result.data.total/page/limit |
| POST /chat/:companionId/messages | result.data.response, .message_type, .media | Saved row আলাদা result.data.message |
| POST /lifestyle/companions/:companionId/photo | result.data.response, result.data.aiPayload.media.url | এটি saved ChatMessage; সাধারণ chat POST-এর মতো .media সরাসরি নয় |
| GET /lifestyle/inbox | result.data = delivery array | item.kind অনুযায়ী item.content.text বা item.content.photo.url |
| GET /lifestyle/allowances | result.data.policy, .usage, .periodStart, .periodEnd | Trial/included quota credits থেকে আলাদা |
| GET /lifestyle/preference | result.data object অথবা null | null = preference এখনও save হয়নি |
| GET /media-stories/summary | result.data = array | companionId, count, latestPublishedAt, expiresAt |
| GET /media-stories/companions/:companionId | result.data.stories | .companion, .serverTime, .hasActiveStory; signed mediaPath |
| GET /dashboard/overview | result.data = metrics object | Time-series graph data নয় |
| GET /relationships, /notifications, /credits/ledger | result.data = array | PageDto; সবগুলোতে total/meta নেই |
| GET .../lifestyle/photos, /daily-content, /deliveries | result.data = array | page query, fixed 50; total count নেই |

**Trial UI caveat:** current Telegram Mini App status code totalCredits<=0 দেখে credits_required দেয়; নতুন zero-credit trial allowance সেখানে পৃথকভাবে বিবেচিত হয় না। Trial launch-এর আগে backend Mini App state integration ঠিক করতে হবে। Website-এ /lifestyle/allowances-এর policy/usage ব্যবহার করুন; zero wallet মানেই trial reply বন্ধ নয়।

**Request retry:** chat-এর optional requestId এবং library-এর required requestId একই action retry-তে reuse করুন। Payment, gift, broadcast বা অন্য mutation-এ এই protection আছে ধরে automatic retry চালাবেন না।

### Website: public/auth ও user API

| Method | Path | কাজ | Controller access |
|---|---|---|---|
| POST | `/api/v1/auth/register` | নতুন website account তৈরি; এরপর login | JWT guard নেই; বিশেষ validation/নিচের নোট দেখুন |
| POST | `/api/v1/auth/login` | Email/password login, accessToken ও refresh cookie | JWT guard নেই; বিশেষ validation/নিচের নোট দেখুন |
| GET | `/api/v1/auth/refresh` | HttpOnly refresh cookie দিয়ে নতুন access token | JWT guard নেই; বিশেষ validation/নিচের নোট দেখুন |
| POST | `/api/v1/auth/forgot-password` | Password reset OTP পাঠানো | JWT guard নেই; বিশেষ validation/নিচের নোট দেখুন |
| POST | `/api/v1/auth/verify-otp` | OTP যাচাই করে resetToken নেওয়া | JWT guard নেই; বিশেষ validation/নিচের নোট দেখুন |
| POST | `/api/v1/auth/reset-password` | resetToken দিয়ে নতুন password | JWT guard নেই; বিশেষ validation/নিচের নোট দেখুন |
| POST | `/api/v1/auth/change-password` | বর্তমান password যাচাই করে পরিবর্তন | UseGuards(AuthGuard('admin', 'user')) |
| POST | `/api/v1/auth/logout` | Session logout ও refresh cookie clear | UseGuards(AuthGuard('admin', 'user')) |
| GET | `/api/v1/chat/conversations` | নিজের conversation list | UseGuards(AuthGuard('user')) |
| GET | `/api/v1/chat/:companionId/messages` | নির্বাচিত companion-এর paginated message history | UseGuards(AuthGuard('user')) |
| GET | `/api/v1/chat/usage` | Active subscription, ব্যবহৃত/বাকি credits ও purchased balance | UseGuards(AuthGuard('user')) |
| POST | `/api/v1/chat/:companionId/messages` | Text/transcript পাঠিয়ে AI reply; requestId retry support | UseGuards(AuthGuard('user')) |
| GET | `/api/v1/relationships` | নিজের relationship list | UseGuards(AuthGuard('user', 'admin')) |
| PATCH | `/api/v1/relationships/:companionId` | নিজের nickname/notes edit | UseGuards(AuthGuard('user', 'admin')) |
| GET | `/api/v1/companions/:companionId/stories` | Published dated text/life events; 24h media Story নয় | UseGuards(AuthGuard('user', 'admin')) |
| POST | `/api/v1/companions/:companionId/photos/view` | Existing gallery photo unlock/view; library request নয় | UseGuards(AuthGuard('user', 'admin')) |
| GET | `/api/v1/photos/history` | নিজের viewed-photo history | UseGuards(AuthGuard('user', 'admin')) |
| GET | `/api/v1/credits/ledger` | নিজের credit transaction history | UseGuards(AuthGuard('user', 'admin')) |
| GET | `/api/v1/credits/costs` | বর্তমান per-action credit rates | UseGuards(AuthGuard('user', 'admin')) |
| GET | `/api/v1/notifications` | নিজের notification list | UseGuards(AuthGuard('user', 'admin')) |
| PATCH | `/api/v1/notifications/:id/read` | নিজের notification read করা | UseGuards(AuthGuard('user', 'admin')) |
| GET | `/api/v1/lifestyle/preference` | Daily update preference পড়া | UseGuards(AuthGuard('user')) |
| PUT | `/api/v1/lifestyle/preference` | এক companion নির্বাচন ও daily opt-in/out | UseGuards(AuthGuard('user')) |
| GET | `/api/v1/lifestyle/allowances` | Trial/paid included allowances ও usage | UseGuards(AuthGuard('user')) |
| POST | `/api/v1/lifestyle/companions/:companionId/photo` | Unseen approved library photo request; requestId required | UseGuards(AuthGuard('user')) |
| GET | `/api/v1/lifestyle/inbox` | নিজের included daily photo/text inbox | UseGuards(AuthGuard('user')) |
| GET | `/api/v1/telegram/status/:companionId` | Companion Telegram link ও subscription state | UseGuards(AuthGuard('user')) |
| POST | `/api/v1/telegram/connect/:companionId` | Single-use, 10-minute Telegram connect URL | UseGuards(AuthGuard('user')) |

### Admin dashboard API

| Method | Path | কাজ | Controller access |
|---|---|---|---|
| GET | `/api/v1/dashboard/overview` | Admin summary cards—users, subscriptions, messages, conversations, revenue | UseGuards(AuthGuard('admin')) |
| PUT | `/api/v1/admin/credit-costs/:action` | Action credit rate পরিবর্তন | UseGuards(AuthGuard('admin')) |
| PUT | `/api/v1/admin/companions/:companionId/stories` | Companion/day অনুযায়ী text life event upsert | UseGuards(AuthGuard('admin')) |
| GET | `/api/v1/admin/companions/:companionId/stories` | সব text life events, future/draft সহ | UseGuards(AuthGuard('admin')) |
| GET | `/api/v1/admin/conversations` | Conversation monitoring list | UseGuards(AuthGuard('admin')) |
| GET | `/api/v1/admin/conversations/:id` | Conversation details ও messages | UseGuards(AuthGuard('admin')) |
| PATCH | `/api/v1/admin/conversations/:id/mode` | AI/human mode ও admin takeover | UseGuards(AuthGuard('admin')) |
| POST | `/api/v1/admin/conversations/:id/replies` | Human reply DB-তে save; Telegram push নয় | UseGuards(AuthGuard('admin')) |
| GET | `/api/v1/admin/users/:id/details` | User finance/relationship detail | UseGuards(AuthGuard('admin')) |
| GET | `/api/v1/admin/users/:id/ledger` | নির্বাচিত user-এর ledger | UseGuards(AuthGuard('admin')) |
| POST | `/api/v1/admin/notifications` | নির্বাচিত user-এর in-app notification তৈরি | UseGuards(AuthGuard('admin')) |
| GET | `/api/v1/admin/companions/:companionId/lifestyle/routine` | Weekly routine পড়া | UseGuards(AuthGuard('admin')) |
| PUT | `/api/v1/admin/companions/:companionId/lifestyle/routine` | Timezone ও পুরো weekly routine replace | UseGuards(AuthGuard('admin')) |
| GET | `/api/v1/admin/companions/:companionId/lifestyle/context` | বর্তমান local activity/context preview | UseGuards(AuthGuard('admin')) |
| GET | `/api/v1/admin/companions/:companionId/lifestyle/photos` | Approved/unapproved library list | UseGuards(AuthGuard('admin')) |
| POST | `/api/v1/admin/companions/:companionId/lifestyle/photos` | Frontend image upload; প্রথমে unapproved | UseGuards(AuthGuard('admin')) |
| PATCH | `/api/v1/admin/companions/:companionId/lifestyle/photos/:photoId` | Library photo approval/revoke | UseGuards(AuthGuard('admin')) |
| GET | `/api/v1/admin/companions/:companionId/lifestyle/daily-content` | Daily photo/text schedule list | UseGuards(AuthGuard('admin')) |
| PUT | `/api/v1/admin/companions/:companionId/lifestyle/daily-content` | নির্দিষ্ট local day-এর daily content draft/publish | UseGuards(AuthGuard('admin')) |
| POST | `/api/v1/admin/companions/:companionId/lifestyle/daily-content/:contentId/unpublish` | Daily content-এর নতুন delivery বন্ধ | UseGuards(AuthGuard('admin')) |
| GET | `/api/v1/admin/companions/:companionId/lifestyle/deliveries` | Daily delivery status ও safe error দেখানো | UseGuards(AuthGuard('admin')) |
| GET | `/api/v1/admin/companions/:companionId/telegram-profile` | Telegram profile desired fields ও sync status | UseGuards(AuthGuard('admin')) |
| PUT | `/api/v1/admin/companions/:companionId/telegram-profile` | Display name/about/description save ও sync queue | UseGuards(AuthGuard('admin')) |
| POST | `/api/v1/admin/companions/:companionId/telegram-profile/retry` | Failed profile sync requeue | UseGuards(AuthGuard('admin')) |
| GET | `/api/v1/admin/companions/:companionId/media-stories` | 24h photo/video Story admin metadata list | UseGuards(AuthGuard('admin')) |
| POST | `/api/v1/admin/companions/:companionId/media-stories` | media upload করে 24h Story publish | UseGuards(AuthGuard('admin')) |
| DELETE | `/api/v1/admin/companions/:companionId/media-stories/:storyId` | Story remove | UseGuards(AuthGuard('admin')) |

### Website listing + admin CRUD

| Method | Path | কাজ | Controller access |
|---|---|---|---|
| POST | `/api/v1/companions` | Nested metadata দিয়ে companion তৈরি | UseGuards(AuthGuard('admin')) |
| GET | `/api/v1/companions` | Public companion cards, filter ও pagination | JWT guard নেই; বিশেষ validation/নিচের নোট দেখুন |
| GET | `/api/v1/companions/:id` | Companion details page data | JWT guard নেই; বিশেষ validation/নিচের নোট দেখুন |
| PUT | `/api/v1/companions/:id` | Companion metadata edit | UseGuards(AuthGuard('admin')) |
| PUT | `/api/v1/companions/:id/profile-image` | Profile picture upload; configured হলে Telegram sync queue | UseGuards(AuthGuard('admin')) |
| PUT | `/api/v1/companions/:id/cover-image` | Cover image upload | UseGuards(AuthGuard('admin')) |
| POST | `/api/v1/companions/:id/gallery` | Gallery-তে ছবি যোগ | UseGuards(AuthGuard('admin')) |
| PUT | `/api/v1/companions/:id/gallery` | Gallery replace—append নয় | UseGuards(AuthGuard('admin')) |
| DELETE | `/api/v1/companions/:id` | Companion delete action; confirmation আবশ্যক | UseGuards(AuthGuard('admin')) |
| PUT | `/api/v1/companions/:id/voice` | Companion voiceId বদলানো | UseGuards(AuthGuard('admin')) |
| POST | `/api/v1/credits/packages` | Extra credit package তৈরি | UseGuards(AuthGuard('admin')) |
| GET | `/api/v1/credits/packages` | Active packages দিয়ে purchase cards | JWT guard নেই; বিশেষ validation/নিচের নোট দেখুন |
| PATCH | `/api/v1/credits/packages/:id` | Package price/credits/active state edit | UseGuards(AuthGuard('admin')) |
| DELETE | `/api/v1/credits/packages/:id` | Package deactivate | UseGuards(AuthGuard('admin')) |
| GET | `/api/v1/credits/wallet` | নিজের effective wallet, credit lots/expiry ও recent ledger | UseGuards(AuthGuard('user')) |
| POST | `/api/v1/gifts` | Gift item ও image তৈরি | UseGuards(AuthGuard('admin')) |
| GET | `/api/v1/gifts` | Gift catalogue | JWT guard নেই; বিশেষ validation/নিচের নোট দেখুন |
| PATCH | `/api/v1/gifts/:id` | Gift metadata edit; file PATCH নয় | UseGuards(AuthGuard('admin')) |
| DELETE | `/api/v1/gifts/:id` | Gift deactivate | UseGuards(AuthGuard('admin')) |
| POST | `/api/v1/gifts/:giftId/send` | Companion-কে gift পাঠানো, backend credit debit | UseGuards(AuthGuard('user')) |
| POST | `/api/v1/newsletter` | Newsletter subscribe form | JWT guard নেই; বিশেষ validation/নিচের নোট দেখুন |
| POST | `/api/v1/newsletter/broadcast` | Newsletter email broadcast; explicit admin action | UseGuards(AuthGuard('admin')) |
| GET | `/api/v1/newsletter` | Subscriber list—বর্তমান code-এ guard নেই, public UI নয় | JWT guard নেই; বিশেষ validation/নিচের নোট দেখুন |
| GET | `/api/v1/newsletter/:id` | Subscriber detail—বর্তমান code-এ guard নেই, public UI নয় | JWT guard নেই; বিশেষ validation/নিচের নোট দেখুন |
| GET | `/api/v1/payment/subscription/status` | Recurring billing/subscription status | UseGuards(AuthGuard('user', 'admin')) |
| POST | `/api/v1/payment/subscription/sync` | Verified provider status দিয়ে subscription reconcile; credit-purchase sync নয় | UseGuards(AuthGuard('user', 'admin')) |
| POST | `/api/v1/payment/billing-portal` | Billing portal URL তৈরি | UseGuards(AuthGuard('user', 'admin')) |
| POST | `/api/v1/payment/subscription/cancel` | Recurring subscription cancellation request | UseGuards(AuthGuard('user', 'admin')) |
| POST | `/api/v1/payment/subscription/:subscriptionId/upgrade` | নতুন local plan ID দিয়ে upgrade | UseGuards(AuthGuard('user', 'admin')) |
| POST | `/api/v1/payment/subscription/:subscriptionId` | Plan activation/payment শুরু; free ও paid branch আলাদা | UseGuards(AuthGuard('admin', 'user')) |
| POST | `/api/v1/payment/credits` | packageId দিয়ে credit purchase payment শুরু | UseGuards(AuthGuard('user')) |
| GET | `/api/v1/media-stories/summary` | Website avatar Story ring-এর active count/expiry | UseGuards(AuthGuard('user', 'admin')) |
| GET | `/api/v1/media-stories/companions/:companionId` | Active media Story feed ও signed mediaPath | UseGuards(AuthGuard('user', 'admin')) |
| POST | `/api/v1/subscription` | Subscription plan তৈরি | UseGuards(AuthGuard('admin')) |
| GET | `/api/v1/subscription` | Plan listing/filter | JWT guard নেই; বিশেষ validation/নিচের নোট দেখুন |
| GET | `/api/v1/subscription/:id` | Plan details | JWT guard নেই; বিশেষ validation/নিচের নোট দেখুন |
| PUT | `/api/v1/subscription/:id` | Plan settings ও entitlementPolicy edit | UseGuards(AuthGuard('admin')) |
| DELETE | `/api/v1/subscription/:id` | Plan deactivate | UseGuards(AuthGuard('admin')) |
| POST | `/api/v1/user` | Legacy account creation; website signup-এ /auth/register ব্যবহার | JWT guard নেই; বিশেষ validation/নিচের নোট দেখুন |
| GET | `/api/v1/user` | Admin user list/search | UseGuards(AuthGuard('admin')) |
| GET | `/api/v1/user//overview` | Admin user summary counts—total, approved, subscribed ও free users | UseGuards(AuthGuard('admin')) |
| GET | `/api/v1/user/my-profile` | নিজের current profile | UseGuards(AuthGuard('user', 'admin')) |
| PUT | `/api/v1/user/my-profile` | নিজের profile update; password-only limitation নিচে দেখুন | UseGuards(AuthGuard('user', 'admin')) |
| GET | `/api/v1/user/:id` | Admin user detail | UseGuards(AuthGuard('admin')) |
| PUT | `/api/v1/user/:id` | Admin user edit; DTO permissions অনুসরণ করুন | UseGuards(AuthGuard('admin')) |
| DELETE | `/api/v1/user/:id` | Admin user delete; destructive action confirmation | UseGuards(AuthGuard('admin')) |

### Mini App, media, webhook ও infrastructure

| Method | Path | কাজ | Controller access |
|---|---|---|---|
| GET | `/api/v1/media-stories/:storyId/media` | Signed ticket দিয়ে image/video bytes; Range support | JWT guard নেই; বিশেষ validation/নিচের নোট দেখুন |
| GET | `/api/v1/telegram/stories` | Telegram Story Mini App HTML shell | JWT guard নেই; বিশেষ validation/নিচের নোট দেখুন |
| POST | `/api/v1/telegram/stories/:companionId/feed` | Telegram signed initData দিয়ে linked-user Story feed | JWT guard নেই; বিশেষ validation/নিচের নোট দেখুন |
| GET | `/api/v1/publishing/admin` | Backend test/admin publishing HTML; final dashboard নয় | JWT guard নেই; বিশেষ validation/নিচের নোট দেখুন |
| GET | `/api/v1/telegram/app` | Telegram login Mini App HTML | JWT guard নেই; বিশেষ validation/নিচের নোট দেখুন |
| GET | `/api/v1/telegram/app/settings/:companionId` | Companion ও website register/reset links | JWT guard নেই; বিশেষ validation/নিচের নোট দেখুন |
| POST | `/api/v1/telegram/app/login/:companionId` | Signed Telegram initData + website credentials দিয়ে account link | JWT guard নেই; বিশেষ validation/নিচের নোট দেখুন |
| POST | `/api/v1/telegram/app/status/:companionId` | Signed Telegram session-এর connection/access status | JWT guard নেই; বিশেষ validation/নিচের নোট দেখুন |
| POST | `/api/v1/webhooks/telegram/:companionId` | Telegram provider update, companion-specific secret | JWT guard নেই; বিশেষ validation/নিচের নোট দেখুন |
| POST | `/api/v1/webhooks/telegram` | Legacy/default Telegram provider webhook | JWT guard নেই; বিশেষ validation/নিচের নোট দেখুন |
| POST | `/api/v1/webhook` | Stripe signed webhook; frontend থেকে call নয় | JWT guard নেই; বিশেষ validation/নিচের নোট দেখুন |
| GET | `/` | Backend root response | JWT guard নেই; বিশেষ validation/নিচের নোট দেখুন |
| GET | `/api/v1/health/live` | Process liveness | JWT guard নেই; বিশেষ validation/নিচের নোট দেখুন |
| GET | `/api/v1/health/ready` | Backend readiness check; সব provider tested বোঝায় না | JWT guard নেই; বিশেষ validation/নিচের নোট দেখুন |
| GET | `/privacy-policy` | Privacy policy HTML | JWT guard নেই; বিশেষ validation/নিচের নোট দেখুন |
| GET | `/terms` | Terms HTML | JWT guard নেই; বিশেষ validation/নিচের নোট দেখুন |
| GET | `/data-deletion` | Data-deletion instructions HTML | JWT guard নেই; বিশেষ validation/নিচের নোট দেখুন |

<a id="flows"></a>
# Implementation flow guide

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

`data.clientSecret` দিয়ে payment confirm করুন। `/payment/credits` হলো credit purchase-এর একমাত্র endpoint। Payment-এর পরে wallet সীমিত সময় poll করুন (যেমন ২–৩ সেকেন্ড interval, সর্বোচ্চ ৩০ সেকেন্ড; এটি frontend প্রস্তাব, backend guarantee নয়)। Pending থাকলে “Payment received; balance update pending” এবং Refresh/Support দেখান; আবার Pay চাপিয়ে duplicate purchase করাবেন না।

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
{"message":"Hi, how are you today?","type":"text","requestId":"11111111-1111-4111-8111-111111111111"}
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
- `AI_RESPONSE_BILLING_ENABLED=false` হলে legacy type-based charge থাকে। Flag=true হলে actual reply type অনুযায়ী image/voice/text ও incoming transcription units charge হয়; নতুন AI contract দরকার। নিচের lifestyle অংশের billing নিয়ম অনুসরণ করুন।
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
| Credit costs | PUT `/admin/credit-costs/:action` | message/photo/voice/transcription/low_credit_threshold |
| Gift management | POST `/gifts`, PATCH/DELETE `/gifts/:id` | gift fields, initial image upload, deactivate |
| Stories | GET/PUT `/admin/companions/:companionId/stories` | day, title, content, published |
| Conversations | GET `/admin/conversations`, GET `/admin/conversations/:id` | user/companion context ও messages |
| AI/human control | PATCH `/admin/conversations/:id/mode` | `{"mode":"human"}` বা `{"mode":"ai"}` |
| Human reply | POST `/admin/conversations/:id/replies` | messageId এবং message |
| Notification create | POST `/admin/notifications` | userId, title, body |
| Newsletter | GET `/newsletter`, GET `/newsletter/:id`, POST `/newsletter/broadcast` | subscribers ও email broadcast |

Overview-তে `totalSubscriptionPlans`, `activeSubscriptions`, `activeSubscribers`, `totalMessages`, `totalConversations`, `totalRevenue`, `totalUsers` ব্যবহার করুন। Legacy `totalConversions` আসলে message count; conversion-rate হিসেবে দেখাবেন না।

Human takeover: প্রথমে mode=human সেট করুন, তারপর নির্বাচিত unanswered user message-এর messageId দিয়ে reply করুন। Reply-কারী admin-এর assignment মিলতে হবে; answered message-এ 409 আসতে পারে। Current `humanReply` method response database-এ save করে এবং in-app notification তৈরি করে; **Telegram outbound send করে না**। তাই “Reply delivered to Telegram” success label এখন দেবেন না।

Plan create example:

```json
{"name":"Premium","price":"29.99","creditAllowance":500,"durationDays":30,"features":["Text conversations","Voice replies"],"isPopular":true,"isActive":true}
```

Credit package create example:

```json
{"name":"Extra Credits","credits":200,"price":"4.99","currency":"usd","isActive":true}
```

Credit cost update body: `{"credits":5}`। Action path values: `message`, `photo`, `voice`, `transcription`, `low_credit_threshold`। Arbitrary action তৈরি করা যাবে না। Package ও gift DELETE deactivation করে; user/companion/plan delete-এর জন্য confirmation UI দিন এবং server restriction/error দেখান, cascading effect অনুমান করবেন না।

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

সব exact webhook route reference-এর inventory-তে আছে। Stripe POST `/webhook` raw body ও `stripe-signature` দিয়ে provider call করবে। Frontend fake webhook বা payment success লিখে subscription/credit grant করতে পারবে না। Telegram webhook-এ bot-specific secret validation হয়। Bot secrets browser-এ দেওয়া যাবে না।

GET `/health/live` process health; GET `/health/ready` database/runtime-table readiness। Ready সফল মানে AI, mail, Stripe সব tested নয়। Root `/`, `/privacy-policy`, `/terms`, `/data-deletion` global API prefix-এর বাইরে। Backend-এ থাকা legal text publish-এর আগে owner review করবেন।

Messaging channel এখন Telegram; WhatsApp integration সরানো হয়েছে।

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
3. Admin human reply Telegram-এ push হয় না।
4. Website profile image/name update configured Telegram profile-sync queue-তে যায়; about/description-এর publishing API আছে। Feature flag/token mapping ও sync status যাচাই করুন। Bot username edit এই API-তে নেই।
5. Bot token/username/env পরিবর্তনের public admin endpoint নেই। Frontend-এ এমন Save button বানাবেন না যার API নেই।
6. User self-service Telegram unlink endpoint নেই; transfer flow আলাদা।
7. General all-payments export, refund API, manual wallet top-up API এই controller set-এ নেই। Admin user details-এ recent payment data আছে; এর বাইরে feature হলে backend contract লাগবে।
8. Newsletter GET list/detail controller-এ JWT guard নেই। Subscriber data public হওয়া launch-এর আগে backend review/fix দরকার; শুধু UI লুকানো protection নয়।
9. Credit purchase-এর জন্য শুধু POST `/payment/credits` ব্যবহার করুন।
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


## Publishing integration

Profile sync ও photo/video Story integration-এর সম্পূর্ণ নির্দেশনা: companion-publishing-bn.md (এই README-তেই সংশ্লিষ্ট section আছে)। Backend API ও Telegram viewer তৈরি; website Story ring frontend team-কে integrate করতে হবে।


<a id="publishing"></a>
# Meet Elysia — Profile sync ও ২৪ ঘণ্টার Story

## এখন যা আছে

Admin থেকে companion-এর নাম বা profile photo পরিবর্তন করলে website save হওয়ার পরে Telegram update queue হবে। About ও Description নতুন publishing API দিয়ে পরিবর্তন করা যায়। Bot username পরিবর্তন এই feature-এর অংশ নয়। ছবি Cloudinary-তে এই backend দিয়ে upload করতে হবে; worker সেটিকে JPEG করে Telegram-এ পাঠায়। Client-এর OTP লাগে না।

Photo/video Story প্রকাশের সময় থেকে ঠিক ২৪ ঘণ্টা website API ও Telegram Mini App-এ দেখা যাবে। এটি Telegram-এর native Story bar নয়। Story দেখার জন্য approved adult account এবং Telegram থেকে দেখলে account connection প্রয়োজন; Story দেখায় subscription credit কাটা হয় না। Chat-এর আগের subscription/credit নিয়ম অপরিবর্তিত।

## প্রথমবার পরীক্ষা

1. Backend restart করুন। Target deployment-এ publishing ও lifestyle migrations আছে কি না deployment team যাচাই করবে; এই README live migration claim করে না।
2. Browser-এ `http://localhost:8080/api/v1/publishing/admin` খুলুন। Existing **admin** account দিয়ে login করুন।
3. Elena বা অন্য companion নির্বাচন করুন। Display name, About, Description লিখে **Save profile & queue sync** চাপুন।
4. **Upload profile photo** দিয়ে ছবি দিন। Status প্রথমে `pending`, পরে `processing`, সফল হলে `synced` হবে। Worker প্রতি ১৫ সেকেন্ডে queue পরীক্ষা করে। পাঁচটি bot থাকলে completion-এ আরও সময় লাগতে পারে।
5. Telegram-এ profile খুলে নাম, ছবি ও পরিচিতি যাচাই করুন। Cache থাকলে profile আবার খুলুন। Failure হলে status-এর কারণ দেখুন, configuration ঠিক করে **Retry Telegram sync** চাপুন। Automatic সর্বোচ্চ তিনবার চেষ্টা হয়।
6. **Publish a story** থেকে JPEG/PNG/WebP বা MP4 এবং caption দিন। Default limit ১০ MB; MP4-এর browser playback codec-compatible হতে হবে (H.264/AAC ব্যবহার করুন)।
7. Connected Telegram account দিয়ে companion-কে `/stories` পাঠান। **View … Stories** চাপলে Telegram-এর ভিতরে viewer খুলবে। `/start`-এর welcome message-এও button আছে। Unconnected user-কে আগে login করতে হবে।
8. Next/Previous, video playback, caption এবং Refresh পরীক্ষা করুন। Admin থেকে **Remove story** করলে পরের request-এ সেটি unavailable হবে। মেয়াদ শেষ হলে নতুন feed/media request-এও unavailable হবে। ইতিমধ্যে download করা ছবি/video ফিরিয়ে মুছে দেওয়া যায় না।

Publish করলে সব user-কে unsolicited message পাঠানো হয় না। Story viewer খোলা অবস্থায় expiry পরীক্ষা করে; signed media link পাঁচ মিনিটের, প্রয়োজন হলে Refresh বা viewer পুনরায় খুলুন।

## ENV ও deployment

Deployment environment-এ নিচের settings এবং signing secret backend engineer দেবেন। Secret অন্য কারও সঙ্গে share করবেন না। VPS-এর সব instance-এ একই persistent secret রাখতে হবে।

```dotenv
TELEGRAM_PROFILE_SYNC_ENABLED=true
COMPANION_MEDIA_STORIES_ENABLED=true
PUBLISHING_ADMIN_CONSOLE_ENABLED=true
STORY_MAX_UPLOAD_MB=10
STORY_MEDIA_SIGNING_SECRET=<strong-random-secret>
TELEGRAM_PUBLIC_BASE_URL=https://your-backend-domain.example
```

Existing পাঁচটি companion-এর bot token ও companion ID mapping এবং Cloudinary credentials ঠিক থাকতে হবে। `TELEGRAM_PUBLIC_BASE_URL` backend-এর public HTTPS origin। ngrok URL বদলালে এটি ও আগের webhook configuration update করে server restart করতে হবে। VPS-এ স্থায়ী HTTPS domain ব্যবহার করুন। Existing website registration/subscription URL settings এই feature পরিবর্তন করে না।

নতুন server/database-এ deployment order:

```powershell
cd D:\BACKEND\natalie_joseph_backend_nestjs
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
npm run start:prod
```

Production process manager দিয়ে service চালু রাখুন। Database migration ছাড়া নতুন build চালাবেন না। Frontend admin integration হয়ে গেলে `PUBLISHING_ADMIN_CONSOLE_ENABLED=false` দিয়ে test console বন্ধ করা যায়; admin APIs তখনও role-protected থাকবে। Upload memory-তে পড়ে এবং Story bytes database-এ থাকে; বড় traffic/media library-তে private object storage ও streaming যোগ করা উচিত। Expired bytes প্রতি ১০ মিনিটে cleanup হয়; metadata থাকে। Basic file signatures যাচাই করা হয়, malware scan/transcoding করা হয় না।

## Frontend developer-এর API

সব path-এর আগে `/api/v1`। Normal response-এর `data` ব্যবহার করুন। Admin route-এ admin Bearer token আবশ্যক।

| Method | Path | ব্যবহার |
|---|---|---|
| GET | `/admin/companions/:companionId/telegram-profile` | Sync status, desired fields, lastError |
| PUT | `/admin/companions/:companionId/telegram-profile` | JSON `displayName` (64), `about` (120), `description` (512 characters) |
| POST | `/admin/companions/:companionId/telegram-profile/retry` | Failed/pending profile পুনরায় queue |
| PUT | `/companions/:id/profile-image` | Existing multipart field `profileImage`; website save + Telegram queue |
| GET | `/admin/companions/:companionId/media-stories` | শেষ ১০০টি Story metadata, expired/deleted সহ |
| POST | `/admin/companions/:companionId/media-stories` | multipart `media` file এবং optional `caption` (2048 characters) |
| DELETE | `/admin/companions/:companionId/media-stories/:storyId` | Story সরিয়ে media bytes clear |
| GET | `/media-stories/summary` | Approved adult user/admin JWT; active Story count ও expiry, website ring-এর জন্য |
| GET | `/media-stories/companions/:companionId` | User/admin JWT; active Story feed ও signed `mediaPath` |
| GET | `/media-stories/:storyId/media?ticket=...` | Feed থেকে পাওয়া signed URL; video Range request সমর্থিত |
| GET | `/telegram/stories?companionId=...` | Telegram Mini App viewer shell |
| POST | `/telegram/stories/:companionId/feed` | JSON `initData`; server Telegram signature ও account connection যাচাই করে |

Website ring নিজে frontend-এ implement করতে হবে: summary-তে `count > 0` হলে ring দেখান; click করলে feed পড়ুন, caption ও media render করুন। `mediaPath` ইতিমধ্যে `/api/v1` দিয়ে শুরু—backend origin-এর সঙ্গে যোগ করবেন, API prefix দ্বিতীয়বার যোগ করবেন না। `serverTime` ও `expiresAt` দিয়ে countdown হিসাব করুন এবং expiry-তে refresh করুন।

Website companion profile response-এ `telegramProfileSync`-এর public displayName/about/description আছে। Private queue state admin API-তেই থাকে। Status UI-তে Pending / Updating / Updated / Failed ও Retry দেখান। Telegram ব্যর্থ হলেও ইতিমধ্যে saved website data rollback হবে না।

## যাচাইয়ের সীমা

Local automated tests-এ expiry, access control, signed media link, version/lease concurrency, retry, range request এবং browser script parsing যাচাই করা হয়েছে। Live Telegram profile পরিবর্তন বা বাস্তব account দিয়ে Story publish এই test run-এ করা হয়নি; উপরের ধাপগুলো দিয়ে নিজের approved content পরীক্ষা করুন। Final website/Figma pages এই backend repository-তে তৈরি করা হয়নি; frontend team-এর integration দরকার।

<a id="lifestyle"></a>
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

AI contract appendix নিচে দেওয়া আছে। এই NestJS repo-তে model training বা AI model source নেই। Routine ব্যবহার, character identity/appearance consistency, long-term user memory এবং natural-language library routing external AI team-কে implement/verify করতে হবে। Client-এর private notes অন্য service-এ পাঠানো এই change-এর অংশ নয়।

Instagram/social auto-posting, short-video generation, CCBill/Segpay gateway ও payment-provider approval এই change-এ করা হয়নি। Existing project-এ এগুলো “done” ধরে নেবেন না।

## ১০. Frontend team-এর checklist

- Admin routine editor, timezone selector, photo upload/approval list, daily schedule draft/preview/publish।
- User daily opt-in companion selector, inbox, allowance display, library-photo button, insufficient-credit/trial-limit UI।
- FormData image upload; Bearer token; retries-এ requestId reuse। 400/402/403/404/429/502 স্পষ্টভাবে দেখান।
- Failed/unknown Telegram delivery status admin-এ দেখান; user-কে নতুন charge দিয়ে automatic retry করাবেন না।
- Existing account, subscription, wallet, Mini App ও stories pages যুক্ত করুন। API docs frontend implementation নিজে তৈরি করে না।

Source contract index: সম্পূর্ণ API reference (এই README-তেই সংশ্লিষ্ট section আছে)।

## ১১. পরবর্তী developer/AI agent-এর নির্দেশনা

প্রথমে `git diff`, Prisma migration, `lifestyle` module, `chat.service.ts`, `aiapi.ts` এবং tests পড়ুন। `.env` values, JWT, OTP, password বা bot token document/log-এ লিখবেন না। Test ছাড়া live broadcast/payment/plan mutation করবেন না। External AI acknowledgement পেলে সেটিকে model quality প্রমাণ ধরে নেবেন না—routine, timezone, birthday/memory ও multi-user consistency-এর বাস্তব acceptance test আলাদা করুন।

## ১২. যাচাইয়ের ফল

Nest build ও Prisma schema validation পাস। Automated tests: ১৩টি suite, ৮৩টি test পাস; changed implementation-এর targeted ESLint পাস। এগুলো mocked service/unit tests—live Telegram delivery, Cloudinary upload, production migration বা external AI compatibility test নয়। Production enable করার আগে উপরের staging flow সম্পন্ন করুন।

# External AI contract appendix

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

<a id="exact"></a>
# Exact API request ও response mapping

প্রতিটি route-এর input decorator, DTO এবং controller response mapping নিচে। Body DTO-এর সব field পরের appendix-এ। Controller source **response example নয়**; service result variable ও nullability নির্দিষ্ট flow অনুযায়ী দেখুন। Global JSON envelope আগের section-এর মতো। GET raw HTML/media এই envelope নয়।

## POST /api/v1/auth/register

**কাজ:** নতুন website account তৈরি; এরপর login

Source: `src/app/module/auth/auth.controller.ts:39`

Access: `Controller JWT guard নেই; service/provider validation প্রযোজ্য`

Request parameters ও DTO:

```typescript
@Body() createAuthDto: CreateAuthDto
```

Upload/status/validation metadata:

```typescript
@Post('register')
@ApiOperation({
    summary: 'Register a new user',
  })
@ApiResponse({
    status: HttpStatus.CREATED,
    description: 'User registered successfully',
  })
@ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'User already exists',
  })
@HttpCode(HttpStatus.CREATED)
```

Controller response mapping:

```typescript
{
    const result = await this.authService.register(createAuthDto);

    return {
      message: 'User registered successfully',
      data: result,
    };
  }
```

## POST /api/v1/auth/login

**কাজ:** Email/password login, accessToken ও refresh cookie

Source: `src/app/module/auth/auth.controller.ts:62`

Access: `Controller JWT guard নেই; service/provider validation প্রযোজ্য`

Request parameters ও DTO:

```typescript
@Body() loginAuthDto: LoginAuthDto
@Res({ passthrough: true }) res: Response
```

Upload/status/validation metadata:

```typescript
@Post('login')
@ApiOperation({
    summary: 'Login user',
  })
@ApiResponse({
    status: HttpStatus.OK,
    description: 'Login successful',
  })
@ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid email or password',
  })
@HttpCode(HttpStatus.OK)
```

Controller response mapping:

```typescript
{
    const result = await this.authService.login(loginAuthDto, res);

    return {
      message: 'Login successfully',
      data: result,
    };
  }
```

## GET /api/v1/auth/refresh

**কাজ:** HttpOnly refresh cookie দিয়ে নতুন access token

Source: `src/app/module/auth/auth.controller.ts:88`

Access: `Controller JWT guard নেই; service/provider validation প্রযোজ্য`

Request parameters ও DTO:

```typescript
@Req() req: Request
```

Upload/status/validation metadata:

```typescript
@Get('refresh')
@ApiOperation({
    summary: 'Generate new access token using refresh token',
  })
@ApiCookieAuth('refreshToken')
@ApiResponse({
    status: HttpStatus.OK,
    description: 'Access token refreshed successfully',
  })
@ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Refresh token invalid or missing',
  })
@HttpCode(HttpStatus.OK)
```

Controller response mapping:

```typescript
{
    const result = await this.authService.refreshToken(req);

    return {
      message: 'Token refreshed successfully',
      data: result,
    };
  }
```

## POST /api/v1/auth/forgot-password

**কাজ:** Password reset OTP পাঠানো

Source: `src/app/module/auth/auth.controller.ts:112`

Access: `Controller JWT guard নেই; service/provider validation প্রযোজ্য`

Request parameters ও DTO:

```typescript
@Body() forgotPasswordAuthDto: ForgotPasswordAuthDto
```

Upload/status/validation metadata:

```typescript
@Post('forgot-password')
@ApiOperation({
    summary: 'Send password reset OTP',
  })
@ApiResponse({
    status: HttpStatus.OK,
    description: 'OTP sent successfully',
  })
@ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'User not found',
  })
@HttpCode(HttpStatus.OK)
```

Controller response mapping:

```typescript
{
    const result = await this.authService.forgotPassword(
      forgotPasswordAuthDto.email,
    );

    return {
      message: 'OTP sent successfully',
      data: result,
    };
  }
```

## POST /api/v1/auth/verify-otp

**কাজ:** OTP যাচাই করে resetToken নেওয়া

Source: `src/app/module/auth/auth.controller.ts:137`

Access: `Controller JWT guard নেই; service/provider validation প্রযোজ্য`

Request parameters ও DTO:

```typescript
@Body() verifyOtpAuthDto: VerifyOtpAuthDto
```

Upload/status/validation metadata:

```typescript
@Post('verify-otp')
@ApiOperation({
    summary: 'Verify password reset OTP',
  })
@ApiResponse({
    status: HttpStatus.OK,
    description: 'OTP verified successfully',
  })
@ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid or expired OTP',
  })
@HttpCode(HttpStatus.OK)
```

Controller response mapping:

```typescript
{
    const result = await this.authService.verifyOtp(
      verifyOtpAuthDto.email,
      verifyOtpAuthDto.otp,
    );

    return {
      message: 'OTP verified successfully',
      data: result,
    };
  }
```

## POST /api/v1/auth/reset-password

**কাজ:** resetToken দিয়ে নতুন password

Source: `src/app/module/auth/auth.controller.ts:163`

Access: `Controller JWT guard নেই; service/provider validation প্রযোজ্য`

Request parameters ও DTO:

```typescript
@Body() resetPasswordAuthDto: ResetPasswordAuthDto
```

Upload/status/validation metadata:

```typescript
@Post('reset-password')
@ApiOperation({
    summary: 'Reset password after OTP verification',
  })
@ApiResponse({
    status: HttpStatus.OK,
    description: 'Password reset successfully',
  })
@ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'OTP verification required',
  })
@HttpCode(HttpStatus.OK)
```

Controller response mapping:

```typescript
{
    const result = await this.authService.resetPassword(
      resetPasswordAuthDto.email,
      resetPasswordAuthDto.password,
      resetPasswordAuthDto.resetToken,
    );

    return {
      message: 'Password reset successfully',
      data: result,
    };
  }
```

## POST /api/v1/auth/change-password

**কাজ:** বর্তমান password যাচাই করে পরিবর্তন

Source: `src/app/module/auth/auth.controller.ts:190`

Access: `UseGuards(AuthGuard('admin', 'user'))`

Request parameters ও DTO:

```typescript
@Req() req: Request
@Body() changePasswordAuthDto: ChangePasswordAuthDto
```

Upload/status/validation metadata:

```typescript
@Post('change-password')
@ApiOperation({
    summary: 'Change logged-in user password',
  })
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('admin', 'user'))
@ApiResponse({
    status: HttpStatus.OK,
    description: 'Password changed successfully',
  })
@ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized',
  })
@HttpCode(HttpStatus.OK)
```

Controller response mapping:

```typescript
{
    const userId = req.user!.id;
    const result = await this.authService.changePassword(
      userId,
      changePasswordAuthDto.oldPassword,
      changePasswordAuthDto.newPassword,
    );

    return {
      message: 'Password changed successfully',
      data: result,
    };
  }
```

## POST /api/v1/auth/logout

**কাজ:** Session logout ও refresh cookie clear

Source: `src/app/module/auth/auth.controller.ts:223`

Access: `UseGuards(AuthGuard('admin', 'user'))`

Request parameters ও DTO:

```typescript
@Req() req: Request
@Res({ passthrough: true }) res: Response
```

Upload/status/validation metadata:

```typescript
@Post('logout')
@ApiOperation({
    summary: 'Logout logged-in user',
  })
@ApiBearerAuth('access-token')
@ApiCookieAuth('refreshToken')
@UseGuards(AuthGuard('admin', 'user'))
@ApiResponse({
    status: HttpStatus.OK,
    description: 'Logout successfully',
  })
@HttpCode(HttpStatus.OK)
```

Controller response mapping:

```typescript
{
    const result = await this.authService.logout(req, res);

    return {
      message: 'Logout successfully',
      data: result,
    };
  }
```

## GET /api/v1/chat/conversations

**কাজ:** নিজের conversation list

Source: `src/app/module/chat/chat.controller.ts:28`

Access: `UseGuards(AuthGuard('user'))`

Request parameters ও DTO:

```typescript
@Req() request: Request
```

Upload/status/validation metadata:

```typescript
@Get('conversations')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('user'))
```

Controller response mapping:

```typescript
{
    if (!request.user) throw new UnauthorizedException();
    return { data: await this.chatService.getConversations(request.user.id) };
  }
```

## GET /api/v1/chat/:companionId/messages

**কাজ:** নির্বাচিত companion-এর paginated message history

Source: `src/app/module/chat/chat.controller.ts:36`

Access: `UseGuards(AuthGuard('user'))`

Request parameters ও DTO:

```typescript
@Req() request: Request
@Param('companionId') companionId: string
@Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number
```

Upload/status/validation metadata:

```typescript
@Get(':companionId/messages')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('user'))
```

Controller response mapping:

```typescript
{
    if (!request.user) throw new UnauthorizedException();
    if (page < 1) throw new BadRequestException('Page must be positive');
    return {
      data: await this.chatService.getMessages(
        request.user.id,
        companionId,
        page,
      ),
    };
  }
```

## GET /api/v1/chat/usage

**কাজ:** Active subscription, ব্যবহৃত/বাকি credits ও purchased balance

Source: `src/app/module/chat/chat.controller.ts:55`

Access: `UseGuards(AuthGuard('user'))`

Request parameters ও DTO:

```typescript
@Req() request: Request
```

Upload/status/validation metadata:

```typescript
@Get('usage')
@ApiOperation({ summary: 'Get subscription usage and credit balance' })
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('user'))
```

Controller response mapping:

```typescript
{
    if (!request.user) throw new UnauthorizedException();
    const data = await this.chatService.getUsage(request.user.id);
    return { message: 'Chat usage fetched successfully', data };
  }
```

## POST /api/v1/chat/:companionId/messages

**কাজ:** Text/transcript পাঠিয়ে AI reply; requestId retry support

Source: `src/app/module/chat/chat.controller.ts:65`

Access: `UseGuards(AuthGuard('user'))`

Request parameters ও DTO:

```typescript
@Req() request: Request
@Param('companionId') companionId: string
@Body() payload: SendMessageDto
```

Upload/status/validation metadata:

```typescript
@Post(':companionId/messages')
@HttpCode(HttpStatus.CREATED)
@ApiOperation({ summary: 'Send a message to a companion' })
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('user'))
```

Controller response mapping:

```typescript
{
    if (!request.user) throw new UnauthorizedException();
    const data = await this.chatService.sendMessage(
      request.user.id,
      companionId,
      payload.message,
      request.headers.authorization!,
      payload.type,
      payload.requestId ? `web:${request.user.id}:${companionId}:${payload.requestId}` : undefined,
    );
    return { message: 'Message sent successfully', data };
  }
```

## POST /api/v1/companions

**কাজ:** Nested metadata দিয়ে companion তৈরি

Source: `src/app/module/companions/companions.controller.ts:38`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters ও DTO:

```typescript
@Body() payload: CreateCompanionDto
```

Upload/status/validation metadata:

```typescript
@Post()
@ApiOperation({ summary: 'Create a companion' })
@ApiBearerAuth('access-token')
@ApiConsumes('application/json')
@ApiBody({ type: CreateCompanionDto })
@UseGuards(AuthGuard('admin'))
```

Controller response mapping:

```typescript
{
    const data = await this.companionsService.createCompanion(payload);
    return { message: 'Companion created successfully', data };
  }
```

## GET /api/v1/companions

**কাজ:** Public companion cards, filter ও pagination

Source: `src/app/module/companions/companions.controller.ts:49`

Access: `Controller JWT guard নেই; service/provider validation প্রযোজ্য`

Request parameters ও DTO:

```typescript
@Req() request: Request
```

Upload/status/validation metadata:

```typescript
@Get()
@HttpCode(HttpStatus.OK)
@ApiOperation({ summary: 'Get all companions' })
@ApiQuery({ name: 'searchTerm', required: false, type: String })
@ApiQuery({ name: 'occupation', required: false, type: String })
@ApiQuery({ name: 'location', required: false, type: String })
@ApiQuery({ name: 'status', required: false, type: Boolean })
@ApiQuery({ name: 'interest', required: false, type: String })
@ApiQuery({ name: 'personalityTrait', required: false, type: String })
@ApiQuery({ name: 'page', required: false, type: Number })
@ApiQuery({ name: 'limit', required: false, type: Number })
@ApiQuery({ name: 'sortBy', required: false, type: String })
@ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
```

Controller response mapping:

```typescript
{
    const filters = pick(request.query, [
      'searchTerm',
      'name',
      'title',
      'backstory',
      'occupation',
      'profession',
      'location',
      'status',
      'interest',
      'personalityTrait',
    ]);
    const options = pick(request.query, [
      'page',
      'limit',
      'sortBy',
      'sortOrder',
    ]);
    const result = await this.companionsService.getAllCompanions(
      filters,
      options,
    );
    return {
      message: 'Companions fetched successfully',
      meta: result.meta,
      data: result.data,
    };
  }
```

## GET /api/v1/companions/:id

**কাজ:** Companion details page data

Source: `src/app/module/companions/companions.controller.ts:92`

Access: `Controller JWT guard নেই; service/provider validation প্রযোজ্য`

Request parameters ও DTO:

```typescript
@Param('id') id: string
```

Upload/status/validation metadata:

```typescript
@Get(':id')
@HttpCode(HttpStatus.OK)
@ApiOperation({ summary: 'Get a companion by ID' })
```

Controller response mapping:

```typescript
{
    const data = await this.companionsService.getCompanionById(id);
    return { message: 'Companion fetched successfully', data };
  }
```

## PUT /api/v1/companions/:id

**কাজ:** Companion metadata edit

Source: `src/app/module/companions/companions.controller.ts:100`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters ও DTO:

```typescript
@Param('id') id: string
@Body() payload: UpdateCompanionDto
```

Upload/status/validation metadata:

```typescript
@Put(':id')
@ApiOperation({ summary: 'Update a companion' })
@ApiBearerAuth('access-token')
@ApiConsumes('application/json')
@ApiBody({ type: UpdateCompanionDto })
@UseGuards(AuthGuard('admin'))
```

Controller response mapping:

```typescript
{
    const data = await this.companionsService.updateCompanion(id, payload);
    return { message: 'Companion updated successfully', data };
  }
```

## PUT /api/v1/companions/:id/profile-image

**কাজ:** Profile picture upload; configured হলে Telegram sync queue

Source: `src/app/module/companions/companions.controller.ts:114`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters ও DTO:

```typescript
@Param('id') id: string
@UploadedFiles() files: { profileImage?: Express.Multer.File[] } = {}
```

Upload/status/validation metadata:

```typescript
@Put(':id/profile-image')
@ApiOperation({ summary: 'Set or replace companion profileImage' })
@ApiBearerAuth('access-token')
@ApiConsumes('multipart/form-data')
@ApiBody({
    schema: {
      type: 'object',
      required: ['profileImage'],
      properties: { profileImage: { type: 'string', format: 'binary' } },
    },
  })
@UseGuards(AuthGuard('admin'))
@UseInterceptors(
    FileFieldsInterceptor(
      [{ name: 'profileImage', maxCount: 1 }],
      fileUpload.uploadConfig,
    ),
  )
```

Controller response mapping:

```typescript
{
    const data = await this.companionsService.updateImages(
      id,
      'profileImage',
      files.profileImage ?? [],
      false,
    );
    return { message: 'Companion images updated successfully', data };
  }
```

## PUT /api/v1/companions/:id/cover-image

**কাজ:** Cover image upload

Source: `src/app/module/companions/companions.controller.ts:145`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters ও DTO:

```typescript
@Param('id') id: string
@UploadedFiles() files: { coverImage?: Express.Multer.File[] } = {}
```

Upload/status/validation metadata:

```typescript
@Put(':id/cover-image')
@ApiOperation({ summary: 'Set or replace companion coverImage' })
@ApiBearerAuth('access-token')
@ApiConsumes('multipart/form-data')
@ApiBody({
    schema: {
      type: 'object',
      required: ['coverImage'],
      properties: { coverImage: { type: 'string', format: 'binary' } },
    },
  })
@UseGuards(AuthGuard('admin'))
@UseInterceptors(
    FileFieldsInterceptor(
      [{ name: 'coverImage', maxCount: 1 }],
      fileUpload.uploadConfig,
    ),
  )
```

Controller response mapping:

```typescript
{
    const data = await this.companionsService.updateImages(
      id,
      'coverImage',
      files.coverImage ?? [],
      false,
    );
    return { message: 'Companion images updated successfully', data };
  }
```

## POST /api/v1/companions/:id/gallery

**কাজ:** Gallery-তে ছবি যোগ

Source: `src/app/module/companions/companions.controller.ts:176`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters ও DTO:

```typescript
@Param('id') id: string
@UploadedFiles() files: { galleryImages?: Express.Multer.File[] } = {}
```

Upload/status/validation metadata:

```typescript
@Post(':id/gallery')
@ApiOperation({ summary: 'Add to companion galleryImages' })
@ApiBearerAuth('access-token')
@ApiConsumes('multipart/form-data')
@ApiBody({
    schema: {
      type: 'object',
      required: ['galleryImages'],
      properties: {
        galleryImages: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          maxItems: 10,
        },
      },
    },
  })
@UseGuards(AuthGuard('admin'))
@UseInterceptors(
    FileFieldsInterceptor(
      [{ name: 'galleryImages', maxCount: 10 }],
      fileUpload.uploadConfig,
    ),
  )
```

Controller response mapping:

```typescript
{
    const data = await this.companionsService.updateImages(
      id,
      'galleryImages',
      files.galleryImages ?? [],
      true,
    );
    return { message: 'Companion images updated successfully', data };
  }
```

## PUT /api/v1/companions/:id/gallery

**কাজ:** Gallery replace—append নয়

Source: `src/app/module/companions/companions.controller.ts:213`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters ও DTO:

```typescript
@Param('id') id: string
@UploadedFiles() files: { galleryImages?: Express.Multer.File[] } = {}
```

Upload/status/validation metadata:

```typescript
@Put(':id/gallery')
@ApiOperation({ summary: 'Set or replace companion galleryImages' })
@ApiBearerAuth('access-token')
@ApiConsumes('multipart/form-data')
@ApiBody({
    schema: {
      type: 'object',
      required: ['galleryImages'],
      properties: {
        galleryImages: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          maxItems: 10,
        },
      },
    },
  })
@UseGuards(AuthGuard('admin'))
@UseInterceptors(
    FileFieldsInterceptor(
      [{ name: 'galleryImages', maxCount: 10 }],
      fileUpload.uploadConfig,
    ),
  )
```

Controller response mapping:

```typescript
{
    const data = await this.companionsService.updateImages(
      id,
      'galleryImages',
      files.galleryImages ?? [],
      false,
    );
    return { message: 'Companion images updated successfully', data };
  }
```

## DELETE /api/v1/companions/:id

**কাজ:** Companion delete action; confirmation আবশ্যক

Source: `src/app/module/companions/companions.controller.ts:250`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters ও DTO:

```typescript
@Param('id') id: string
```

Upload/status/validation metadata:

```typescript
@Delete(':id')
@ApiOperation({ summary: 'Delete a companion' })
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('admin'))
```

Controller response mapping:

```typescript
{
    const data = await this.companionsService.deleteCompanion(id);
    return { message: 'Companion deleted successfully', data };
  }
```

## PUT /api/v1/companions/:id/voice

**কাজ:** Companion voiceId বদলানো

Source: `src/app/module/companions/companions.controller.ts:258`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters ও DTO:

```typescript
@Param('id') id: string
@Body() payload: UpdateVoiceDto
```

Upload/status/validation metadata:

```typescript
@Put(':id/voice')
@ApiOperation({ summary: 'Update companion voice ID' })
@ApiBearerAuth('access-token')
@ApiBody({ type: UpdateVoiceDto })
@UseGuards(AuthGuard('admin'))
```

Controller response mapping:

```typescript
{
    const data = await this.companionsService.updateVoiceSettings(
      id,
      payload.voiceId,
    );

    return { message: 'Voice ID updated successfully', data };
  }
```

## POST /api/v1/credits/packages

**কাজ:** Extra credit package তৈরি

Source: `src/app/module/credit/credit.controller.ts:29`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters ও DTO:

```typescript
@Body() payload: CreateCreditPackageDto
```

Upload/status/validation metadata:

```typescript
@Post('packages')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('admin'))
@ApiOperation({ summary: 'Create a credit package (admin)' })
```

Controller response mapping:

```typescript
{
    const data = await this.creditService.createPackage(payload);
    return { message: 'Credit package created successfully', data };
  }
```

## GET /api/v1/credits/packages

**কাজ:** Active packages দিয়ে purchase cards

Source: `src/app/module/credit/credit.controller.ts:38`

Access: `Controller JWT guard নেই; service/provider validation প্রযোজ্য`

Request parameters ও DTO:

```typescript
// No explicit parameters
```

Upload/status/validation metadata:

```typescript
@Get('packages')
@ApiOperation({ summary: 'Get active credit packages' })
```

Controller response mapping:

```typescript
{
    const data = await this.creditService.getActivePackages();
    return { message: 'Credit packages fetched successfully', data };
  }
```

## PATCH /api/v1/credits/packages/:id

**কাজ:** Package price/credits/active state edit

Source: `src/app/module/credit/credit.controller.ts:45`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters ও DTO:

```typescript
@Param('id') id: string
@Body() payload: UpdateCreditPackageDto
```

Upload/status/validation metadata:

```typescript
@Patch('packages/:id')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('admin'))
@ApiOperation({ summary: 'Update a credit package (admin)' })
```

Controller response mapping:

```typescript
{
    const data = await this.creditService.updatePackage(id, payload);
    return { message: 'Credit package updated successfully', data };
  }
```

## DELETE /api/v1/credits/packages/:id

**কাজ:** Package deactivate

Source: `src/app/module/credit/credit.controller.ts:57`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters ও DTO:

```typescript
@Param('id') id: string
```

Upload/status/validation metadata:

```typescript
@Delete('packages/:id')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('admin'))
@ApiOperation({ summary: 'Deactivate a credit package (admin)' })
```

Controller response mapping:

```typescript
{
    const data = await this.creditService.deactivatePackage(id);
    return { message: 'Credit package deactivated successfully', data };
  }
```

## GET /api/v1/credits/wallet

**কাজ:** নিজের effective wallet, credit lots/expiry ও recent ledger

Source: `src/app/module/credit/credit.controller.ts:66`

Access: `UseGuards(AuthGuard('user'))`

Request parameters ও DTO:

```typescript
@Req() request: Request
```

Upload/status/validation metadata:

```typescript
@Get('wallet')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('user'))
@ApiOperation({ summary: 'Get wallet balance and recent transactions' })
```

Controller response mapping:

```typescript
{
    if (!request.user) throw new UnauthorizedException();
    const data = await this.creditService.getWallet(request.user.id);
    return { message: 'Wallet fetched successfully', data };
  }
```

## GET /api/v1/dashboard/overview

**কাজ:** Admin summary cards—users, subscriptions, messages, conversations, revenue

Source: `src/app/module/dashboard/dashboard.controller.ts:17`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters ও DTO:

```typescript
// No explicit parameters
```

Upload/status/validation metadata:

```typescript
@Get('overview')
@ApiOperation({ summary: 'Get dashboard overview' })
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('admin'))
@HttpCode(HttpStatus.OK)
```

Controller response mapping:

```typescript
{
    const data = await this.dashboardService.dashboardOverview();

    return {
      message: 'Dashboard overview fetched successfully',
      data,
    };
  }
```

## GET /api/v1/relationships

**কাজ:** নিজের relationship list

Source: `src/app/module/engagement/engagement.controller.ts:39`

Access: `UseGuards(AuthGuard('user', 'admin'))`

Request parameters ও DTO:

```typescript
@Req() req: Request
@Query() query: PageDto
```

Upload/status/validation metadata:

```typescript
@Get('relationships')
```

Controller response mapping:

```typescript
{
    return { data: await this.service.relationships(req.user!.id, query) };
  }
```

## PATCH /api/v1/relationships/:companionId

**কাজ:** নিজের nickname/notes edit

Source: `src/app/module/engagement/engagement.controller.ts:45`

Access: `UseGuards(AuthGuard('user', 'admin'))`

Request parameters ও DTO:

```typescript
@Req() req: Request
@Param('companionId') id: string
@Body() body: RelationshipDto
```

Upload/status/validation metadata:

```typescript
@Patch('relationships/:companionId')
```

Controller response mapping:

```typescript
{
    return {
      data: await this.service.updateRelationship(req.user!.id, id, body),
    };
  }
```

## GET /api/v1/companions/:companionId/stories

**কাজ:** Published dated text/life events; 24h media Story নয়

Source: `src/app/module/engagement/engagement.controller.ts:54`

Access: `UseGuards(AuthGuard('user', 'admin'))`

Request parameters ও DTO:

```typescript
@Param('companionId') id: string
@Query() query: PageDto
```

Upload/status/validation metadata:

```typescript
@Get('companions/:companionId/stories')
```

Controller response mapping:

```typescript
{
    return { data: await this.service.stories(id, query) };
  }
```

## POST /api/v1/companions/:companionId/photos/view

**কাজ:** Existing gallery photo unlock/view; library request নয়

Source: `src/app/module/engagement/engagement.controller.ts:60`

Access: `UseGuards(AuthGuard('user', 'admin'))`

Request parameters ও DTO:

```typescript
@Req() req: Request
@Param('companionId') id: string
@Body() body: PhotoDto
```

Upload/status/validation metadata:

```typescript
@Post('companions/:companionId/photos/view')
```

Controller response mapping:

```typescript
{
    return {
      data: await this.service.viewPhoto(req.user!.id, id, body.photoUrl),
    };
  }
```

## GET /api/v1/photos/history

**কাজ:** নিজের viewed-photo history

Source: `src/app/module/engagement/engagement.controller.ts:69`

Access: `UseGuards(AuthGuard('user', 'admin'))`

Request parameters ও DTO:

```typescript
@Req() req: Request
@Query() query: PageDto
```

Upload/status/validation metadata:

```typescript
@Get('photos/history')
```

Controller response mapping:

```typescript
{
    return { data: await this.service.photoHistory(req.user!.id, query) };
  }
```

## GET /api/v1/credits/ledger

**কাজ:** নিজের credit transaction history

Source: `src/app/module/engagement/engagement.controller.ts:75`

Access: `UseGuards(AuthGuard('user', 'admin'))`

Request parameters ও DTO:

```typescript
@Req() req: Request
@Query() query: PageDto
```

Upload/status/validation metadata:

```typescript
@Get('credits/ledger')
```

Controller response mapping:

```typescript
{
    return { data: await this.service.ledger(req.user!.id, query) };
  }
```

## GET /api/v1/credits/costs

**কাজ:** বর্তমান per-action credit rates

Source: `src/app/module/engagement/engagement.controller.ts:81`

Access: `UseGuards(AuthGuard('user', 'admin'))`

Request parameters ও DTO:

```typescript
// No explicit parameters
```

Upload/status/validation metadata:

```typescript
@Get('credits/costs')
```

Controller response mapping:

```typescript
{
    return { data: await this.credits.getCosts() };
  }
```

## GET /api/v1/notifications

**কাজ:** নিজের notification list

Source: `src/app/module/engagement/engagement.controller.ts:84`

Access: `UseGuards(AuthGuard('user', 'admin'))`

Request parameters ও DTO:

```typescript
@Req() req: Request
@Query() query: PageDto
```

Upload/status/validation metadata:

```typescript
@Get('notifications')
```

Controller response mapping:

```typescript
{
    return { data: await this.service.notifications(req.user!.id, query) };
  }
```

## PATCH /api/v1/notifications/:id/read

**কাজ:** নিজের notification read করা

Source: `src/app/module/engagement/engagement.controller.ts:90`

Access: `UseGuards(AuthGuard('user', 'admin'))`

Request parameters ও DTO:

```typescript
@Req() req: Request
@Param('id') id: string
```

Upload/status/validation metadata:

```typescript
@Patch('notifications/:id/read')
```

Controller response mapping:

```typescript
{
    return { data: await this.service.readNotification(req.user!.id, id) };
  }
```

## PUT /api/v1/admin/credit-costs/:action

**কাজ:** Action credit rate পরিবর্তন

Source: `src/app/module/engagement/engagement.controller.ts:107`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters ও DTO:

```typescript
@Param('action') action: string
@Body() body: CostDto
```

Upload/status/validation metadata:

```typescript
@Put('credit-costs/:action')
```

Controller response mapping:

```typescript
{
    return { data: await this.service.setCost(action, body.credits) };
  }
```

## PUT /api/v1/admin/companions/:companionId/stories

**কাজ:** Companion/day অনুযায়ী text life event upsert

Source: `src/app/module/engagement/engagement.controller.ts:113`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters ও DTO:

```typescript
@Param('companionId') id: string
@Body() body: StoryDto
```

Upload/status/validation metadata:

```typescript
@Put('companions/:companionId/stories')
```

Controller response mapping:

```typescript
{
    return { data: await this.service.saveStory(id, body) };
  }
```

## GET /api/v1/admin/companions/:companionId/stories

**কাজ:** সব text life events, future/draft সহ

Source: `src/app/module/engagement/engagement.controller.ts:119`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters ও DTO:

```typescript
@Param('companionId') id: string
@Query() query: PageDto
```

Upload/status/validation metadata:

```typescript
@Get('companions/:companionId/stories')
```

Controller response mapping:

```typescript
{
    return { data: await this.service.stories(id, query, true) };
  }
```

## GET /api/v1/admin/conversations

**কাজ:** Conversation monitoring list

Source: `src/app/module/engagement/engagement.controller.ts:125`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters ও DTO:

```typescript
@Query() query: PageDto
```

Upload/status/validation metadata:

```typescript
@Get('conversations')
```

Controller response mapping:

```typescript
{
    return { data: await this.service.conversations(query) };
  }
```

## GET /api/v1/admin/conversations/:id

**কাজ:** Conversation details ও messages

Source: `src/app/module/engagement/engagement.controller.ts:128`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters ও DTO:

```typescript
@Param('id') id: string
@Query() query: PageDto
```

Upload/status/validation metadata:

```typescript
@Get('conversations/:id')
```

Controller response mapping:

```typescript
{
    return { data: await this.service.conversation(id, query) };
  }
```

## PATCH /api/v1/admin/conversations/:id/mode

**কাজ:** AI/human mode ও admin takeover

Source: `src/app/module/engagement/engagement.controller.ts:134`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters ও DTO:

```typescript
@Req() req: Request
@Param('id') id: string
@Body() body: ModeDto
```

Upload/status/validation metadata:

```typescript
@Patch('conversations/:id/mode')
```

Controller response mapping:

```typescript
{
    return { data: await this.service.setMode(id, req.user!.id, body.mode) };
  }
```

## POST /api/v1/admin/conversations/:id/replies

**কাজ:** Human reply DB-তে save; Telegram push নয়

Source: `src/app/module/engagement/engagement.controller.ts:141`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters ও DTO:

```typescript
@Req() req: Request
@Param('id') id: string
@Body() body: HumanReplyDto
```

Upload/status/validation metadata:

```typescript
@Post('conversations/:id/replies')
```

Controller response mapping:

```typescript
{
    return { data: await this.service.humanReply(id, req.user!.id, body) };
  }
```

## GET /api/v1/admin/users/:id/details

**কাজ:** User finance/relationship detail

Source: `src/app/module/engagement/engagement.controller.ts:148`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters ও DTO:

```typescript
@Param('id') id: string
```

Upload/status/validation metadata:

```typescript
@Get('users/:id/details')
```

Controller response mapping:

```typescript
{
    return { data: await this.service.userDetails(id) };
  }
```

## GET /api/v1/admin/users/:id/ledger

**কাজ:** নির্বাচিত user-এর ledger

Source: `src/app/module/engagement/engagement.controller.ts:151`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters ও DTO:

```typescript
@Param('id') id: string
@Query() query: PageDto
```

Upload/status/validation metadata:

```typescript
@Get('users/:id/ledger')
```

Controller response mapping:

```typescript
{
    return { data: await this.service.ledger(id, query) };
  }
```

## POST /api/v1/admin/notifications

**কাজ:** নির্বাচিত user-এর in-app notification তৈরি

Source: `src/app/module/engagement/engagement.controller.ts:157`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters ও DTO:

```typescript
@Body() body: NotificationDto
```

Upload/status/validation metadata:

```typescript
@Post('notifications')
```

Controller response mapping:

```typescript
{
    return {
      data: await this.prisma.notification.create({
        data: { ...body, type: 'admin' },
      }),
    };
  }
```

## POST /api/v1/gifts

**কাজ:** Gift item ও image তৈরি

Source: `src/app/module/gift/gift.controller.ts:37`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters ও DTO:

```typescript
@Body() payload: CreateGiftDto
@UploadedFile() file?: Express.Multer.File
```

Upload/status/validation metadata:

```typescript
@Post()
@ApiOperation({ summary: 'Create a gift (admin)' })
@ApiConsumes('multipart/form-data')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('admin'))
@UseInterceptors(FileInterceptor('image', fileUpload.uploadConfig))
```

Controller response mapping:

```typescript
{
    const data = await this.giftService.createGift(payload, file);
    return { message: 'Gift created successfully', data };
  }
```

## GET /api/v1/gifts

**কাজ:** Gift catalogue

Source: `src/app/module/gift/gift.controller.ts:51`

Access: `Controller JWT guard নেই; service/provider validation প্রযোজ্য`

Request parameters ও DTO:

```typescript
@Req() req: Request
```

Upload/status/validation metadata:

```typescript
@Get()
@ApiOperation({ summary: 'Get active gifts' })
@ApiQuery({ name: 'searchTerm', required: false, type: String })
@ApiQuery({ name: 'name', required: false, type: String })
@ApiQuery({ name: 'sortBy', required: false, type: String })
@ApiQuery({ name: 'sortOrder', required: false, type: String })
@ApiQuery({ name: 'limit', required: false, type: Number })
@ApiQuery({ name: 'page', required: false, type: Number })
@HttpCode(HttpStatus.OK)
```

Controller response mapping:

```typescript
{
    const filters = pick(req.query, ['searchTerm', 'name']);
    const options = pick(req.query, ['sortBy', 'sortOrder', 'limit', 'page']);
    const result = await this.giftService.getActiveGifts(filters, options);
    return {
      message: 'Gifts fetched successfully',
      meta: result.meta,
      data: result.data,
    };
  }
```

## PATCH /api/v1/gifts/:id

**কাজ:** Gift metadata edit; file PATCH নয়

Source: `src/app/module/gift/gift.controller.ts:71`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters ও DTO:

```typescript
@Param('id') id: string
@Body() payload: UpdateGiftDto
```

Upload/status/validation metadata:

```typescript
@Patch(':id')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('admin'))
@ApiOperation({ summary: 'Update a gift (admin)' })
```

Controller response mapping:

```typescript
{
    const data = await this.giftService.updateGift(id, payload);
    return { message: 'Gift updated successfully', data };
  }
```

## DELETE /api/v1/gifts/:id

**কাজ:** Gift deactivate

Source: `src/app/module/gift/gift.controller.ts:80`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters ও DTO:

```typescript
@Param('id') id: string
```

Upload/status/validation metadata:

```typescript
@Delete(':id')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('admin'))
@ApiOperation({ summary: 'Deactivate a gift (admin)' })
```

Controller response mapping:

```typescript
{
    const data = await this.giftService.deactivateGift(id);
    return { message: 'Gift deactivated successfully', data };
  }
```

## POST /api/v1/gifts/:giftId/send

**কাজ:** Companion-কে gift পাঠানো, backend credit debit

Source: `src/app/module/gift/gift.controller.ts:89`

Access: `UseGuards(AuthGuard('user'))`

Request parameters ও DTO:

```typescript
@Req() request: Request
@Param('giftId') giftId: string
@Body() payload: SendGiftDto
```

Upload/status/validation metadata:

```typescript
@Post(':giftId/send')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('user'))
@ApiOperation({ summary: 'Send a gift to a companion using credits' })
```

Controller response mapping:

```typescript
{
    if (!request.user) throw new UnauthorizedException();
    const data = await this.giftService.sendGift(
      request.user.id,
      payload.companionId,
      giftId,
    );
    return { message: 'Gift sent successfully', data };
  }
```

## GET /api/v1/admin/companions/:companionId/lifestyle/routine

**কাজ:** Weekly routine পড়া

Source: `src/app/module/lifestyle/lifestyle.controller.ts:48`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters ও DTO:

```typescript
@Param('companionId', ParseUUIDPipe) id: string
```

Upload/status/validation metadata:

```typescript
@Get('routine')
```

Controller response mapping:

```typescript
{
    return { data: await this.service.routine(id) };
  }
```

## PUT /api/v1/admin/companions/:companionId/lifestyle/routine

**কাজ:** Timezone ও পুরো weekly routine replace

Source: `src/app/module/lifestyle/lifestyle.controller.ts:53`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters ও DTO:

```typescript
@Param('companionId', ParseUUIDPipe) id: string
@Body() dto: RoutineDto
```

Upload/status/validation metadata:

```typescript
@Put('routine')
```

Controller response mapping:

```typescript
{
    return { data: await this.service.saveRoutine(id, dto) };
  }
```

## GET /api/v1/admin/companions/:companionId/lifestyle/context

**কাজ:** বর্তমান local activity/context preview

Source: `src/app/module/lifestyle/lifestyle.controller.ts:59`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters ও DTO:

```typescript
@Param('companionId', ParseUUIDPipe) id: string
```

Upload/status/validation metadata:

```typescript
@Get('context')
```

Controller response mapping:

```typescript
{
    await this.service.companion(id);
    return { data: await this.service.context(id) };
  }
```

## GET /api/v1/admin/companions/:companionId/lifestyle/photos

**কাজ:** Approved/unapproved library list

Source: `src/app/module/lifestyle/lifestyle.controller.ts:65`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters ও DTO:

```typescript
@Param('companionId', ParseUUIDPipe) id: string
@Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number
```

Upload/status/validation metadata:

```typescript
@Get('photos')
```

Controller response mapping:

```typescript
{
    return { data: await this.service.photos(id, pageNumber(page)) };
  }
```

## POST /api/v1/admin/companions/:companionId/lifestyle/photos

**কাজ:** Frontend image upload; প্রথমে unapproved

Source: `src/app/module/lifestyle/lifestyle.controller.ts:71`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters ও DTO:

```typescript
@Param('companionId', ParseUUIDPipe) id: string
@Body() dto: LibraryPhotoDto
@UploadedFile() file?: Express.Multer.File
```

Upload/status/validation metadata:

```typescript
@Post('photos')
@ApiConsumes('multipart/form-data')
@ApiBody({
    schema: {
      type: 'object',
      required: ['image'],
      properties: {
        image: { type: 'string', format: 'binary' },
        caption: { type: 'string' },
        tags: { type: 'string', example: 'gym,morning' },
      },
    },
  })
@UseInterceptors(FileInterceptor('image', fileUpload.uploadConfig))
```

Controller response mapping:

```typescript
{
    return { data: await this.service.upload(id, dto, file) };
  }
```

## PATCH /api/v1/admin/companions/:companionId/lifestyle/photos/:photoId

**কাজ:** Library photo approval/revoke

Source: `src/app/module/lifestyle/lifestyle.controller.ts:92`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters ও DTO:

```typescript
@Param('companionId', ParseUUIDPipe) id: string
@Param('photoId', ParseUUIDPipe) photoId: string
@Body() dto: ApprovePhotoDto
```

Upload/status/validation metadata:

```typescript
@Patch('photos/:photoId')
```

Controller response mapping:

```typescript
{
    return { data: await this.service.approve(id, photoId, dto.approved) };
  }
```

## GET /api/v1/admin/companions/:companionId/lifestyle/daily-content

**কাজ:** Daily photo/text schedule list

Source: `src/app/module/lifestyle/lifestyle.controller.ts:99`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters ও DTO:

```typescript
@Param('companionId', ParseUUIDPipe) id: string
@Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number
```

Upload/status/validation metadata:

```typescript
@Get('daily-content')
```

Controller response mapping:

```typescript
{
    return { data: await this.service.daily(id, pageNumber(page)) };
  }
```

## PUT /api/v1/admin/companions/:companionId/lifestyle/daily-content

**কাজ:** নির্দিষ্ট local day-এর daily content draft/publish

Source: `src/app/module/lifestyle/lifestyle.controller.ts:105`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters ও DTO:

```typescript
@Param('companionId', ParseUUIDPipe) id: string
@Body() dto: DailyContentDto
```

Upload/status/validation metadata:

```typescript
@Put('daily-content')
```

Controller response mapping:

```typescript
{
    return { data: await this.service.saveDaily(id, dto) };
  }
```

## POST /api/v1/admin/companions/:companionId/lifestyle/daily-content/:contentId/unpublish

**কাজ:** Daily content-এর নতুন delivery বন্ধ

Source: `src/app/module/lifestyle/lifestyle.controller.ts:111`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters ও DTO:

```typescript
@Param('companionId', ParseUUIDPipe) id: string
@Param('contentId', ParseUUIDPipe) contentId: string
```

Upload/status/validation metadata:

```typescript
@Post('daily-content/:contentId/unpublish')
```

Controller response mapping:

```typescript
{
    return { data: await this.service.unpublish(id, contentId) };
  }
```

## GET /api/v1/admin/companions/:companionId/lifestyle/deliveries

**কাজ:** Daily delivery status ও safe error দেখানো

Source: `src/app/module/lifestyle/lifestyle.controller.ts:117`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters ও DTO:

```typescript
@Param('companionId', ParseUUIDPipe) id: string
@Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number
```

Upload/status/validation metadata:

```typescript
@Get('deliveries')
```

Controller response mapping:

```typescript
{
    return {
      data: await this.prisma.dailyDelivery.findMany({
        where: { content: { companionId: id } },
        orderBy: { createdAt: 'desc' },
        skip: (pageNumber(page) - 1) * 50,
        take: 50,
      }),
    };
  }
```

## GET /api/v1/lifestyle/preference

**কাজ:** Daily update preference পড়া

Source: `src/app/module/lifestyle/lifestyle.controller.ts:140`

Access: `UseGuards(AuthGuard('user'))`

Request parameters ও DTO:

```typescript
@Req() req: Request
```

Upload/status/validation metadata:

```typescript
@Get('preference')
```

Controller response mapping:

```typescript
{
    return { data: await this.service.preference(req.user!.id) };
  }
```

## PUT /api/v1/lifestyle/preference

**কাজ:** এক companion নির্বাচন ও daily opt-in/out

Source: `src/app/module/lifestyle/lifestyle.controller.ts:143`

Access: `UseGuards(AuthGuard('user'))`

Request parameters ও DTO:

```typescript
@Req() req: Request
@Body() dto: DailyPreferenceDto
```

Upload/status/validation metadata:

```typescript
@Put('preference')
```

Controller response mapping:

```typescript
{
    return { data: await this.service.preference(req.user!.id, dto) };
  }
```

## GET /api/v1/lifestyle/allowances

**কাজ:** Trial/paid included allowances ও usage

Source: `src/app/module/lifestyle/lifestyle.controller.ts:149`

Access: `UseGuards(AuthGuard('user'))`

Request parameters ও DTO:

```typescript
@Req() req: Request
```

Upload/status/validation metadata:

```typescript
@Get('allowances')
```

Controller response mapping:

```typescript
{
    return { data: await this.service.usage(req.user!.id) };
  }
```

## POST /api/v1/lifestyle/companions/:companionId/photo

**কাজ:** Unseen approved library photo request; requestId required

Source: `src/app/module/lifestyle/lifestyle.controller.ts:152`

Access: `UseGuards(AuthGuard('user'))`

Request parameters ও DTO:

```typescript
@Req() req: Request
@Param('companionId', ParseUUIDPipe) id: string
@Body() dto: PhotoRequestDto
```

Upload/status/validation metadata:

```typescript
@Post('companions/:companionId/photo')
```

Controller response mapping:

```typescript
{
    return { data: await this.service.requestPhoto(req.user!.id, id, dto) };
  }
```

## GET /api/v1/lifestyle/inbox

**কাজ:** নিজের included daily photo/text inbox

Source: `src/app/module/lifestyle/lifestyle.controller.ts:159`

Access: `UseGuards(AuthGuard('user'))`

Request parameters ও DTO:

```typescript
@Req() req: Request
@Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number
```

Upload/status/validation metadata:

```typescript
@Get('inbox')
```

Controller response mapping:

```typescript
{
    await this.service.active(this.prisma, req.user!.id);
    return {
      data: await this.prisma.dailyDelivery.findMany({
        where: {
          userId: req.user!.id,
          status: { in: ['available', 'sent', 'unknown', 'failed'] },
          content: { published: true, photo: { approved: true } },
        },
        include: { content: { include: { photo: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: (pageNumber(page) - 1) * 50,
      }),
    };
  }
```

## POST /api/v1/newsletter

**কাজ:** Newsletter subscribe form

Source: `src/app/module/newsletter/newsletter.controller.ts:30`

Access: `Controller JWT guard নেই; service/provider validation প্রযোজ্য`

Request parameters ও DTO:

```typescript
@Body() createNewsletterDto: CreateNewsletterDto
```

Upload/status/validation metadata:

```typescript
@Post()
@ApiOperation({ summary: 'Subscribe to newsletter' })
@HttpCode(HttpStatus.CREATED)
```

Controller response mapping:

```typescript
{
    const data = await this.newsletterService.sendMail(createNewsletterDto);
    return {
      message: 'Newsletter subscription saved successfully',
      data,
    };
  }
```

## POST /api/v1/newsletter/broadcast

**কাজ:** Newsletter email broadcast; explicit admin action

Source: `src/app/module/newsletter/newsletter.controller.ts:41`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters ও DTO:

```typescript
@Body() dto: BroadcastNewsletterDto
```

Upload/status/validation metadata:

```typescript
@Post('broadcast')
@ApiOperation({ summary: 'Broadcast an email to all newsletter subscribers' })
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('admin'))
@HttpCode(HttpStatus.OK)
```

Controller response mapping:

```typescript
{
    const data = await this.newsletterService.broadcastNewsletter(dto);

    return {
      message: 'Newsletter broadcast sent successfully',
      data,
    };
  }
```

## GET /api/v1/newsletter

**কাজ:** Subscriber list—বর্তমান code-এ guard নেই, public UI নয়

Source: `src/app/module/newsletter/newsletter.controller.ts:55`

Access: `Controller JWT guard নেই; service/provider validation প্রযোজ্য`

Request parameters ও DTO:

```typescript
@Req() req: Request
```

Upload/status/validation metadata:

```typescript
@Get()
@ApiOperation({ summary: 'Get all newsletter' })
@ApiQuery({
    name: 'searchTerm',
    type: String,
    required: false,
    description: 'Search term',
  })
@ApiQuery({
    name: 'email',
    type: String,
    required: false,
    description: 'Email',
  })
@ApiQuery({
    name: 'page',
    type: Number,
    required: false,
    description: 'Page number',
  })
@ApiQuery({
    name: 'limit',
    type: Number,
    required: false,
    description: 'Limit number',
  })
@ApiQuery({
    name: 'sortBy',
    type: String,
    required: false,
    description: 'Sort by',
  })
@ApiQuery({
    name: 'sortOrder',
    type: String,
    required: false,
    description: 'Sort order',
  })
@HttpCode(HttpStatus.OK)
```

Controller response mapping:

```typescript
{
    const params = pick(req.query, ['searchTerm', 'email']);
    const options = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);
    const result = await this.newsletterService.getAllNewsletter(
      params,
      options,
    );

    return {
      message: 'Get all newsletter successfully',
      meta: result.meta,
      data: result.data,
    };
  }
```

## GET /api/v1/newsletter/:id

**কাজ:** Subscriber detail—বর্তমান code-এ guard নেই, public UI নয়

Source: `src/app/module/newsletter/newsletter.controller.ts:109`

Access: `Controller JWT guard নেই; service/provider validation প্রযোজ্য`

Request parameters ও DTO:

```typescript
@Param('id') id: string
```

Upload/status/validation metadata:

```typescript
@Get(':id')
@ApiOperation({ summary: 'Get newsletter by id' })
@HttpCode(HttpStatus.OK)
```

Controller response mapping:

```typescript
{
    const result = await this.newsletterService.getNewsletterById(id);

    return {
      message: 'Get newsletter by id successfully',
      data: result,
    };
  }
```

## GET /api/v1/payment/subscription/status

**কাজ:** Recurring billing/subscription status

Source: `src/app/module/payment/payment.controller.ts:28`

Access: `UseGuards(AuthGuard('user', 'admin'))`

Request parameters ও DTO:

```typescript
@Req() request: Request
```

Upload/status/validation metadata:

```typescript
@Get('subscription/status')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('user', 'admin'))
```

Controller response mapping:

```typescript
{
    return this.billing.status(request.user!.id);
  }
```

## POST /api/v1/payment/subscription/sync

**কাজ:** Verified provider status দিয়ে subscription reconcile; credit-purchase sync নয়

Source: `src/app/module/payment/payment.controller.ts:35`

Access: `UseGuards(AuthGuard('user', 'admin'))`

Request parameters ও DTO:

```typescript
@Req() request: Request
```

Upload/status/validation metadata:

```typescript
@Post('subscription/sync')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('user', 'admin'))
@ApiOperation({
    summary:
      'Verify Stripe payment and synchronize subscription access without charging again',
  })
```

Controller response mapping:

```typescript
{
    return { data: await this.billing.sync(request.user!.id) };
  }
```

## POST /api/v1/payment/billing-portal

**কাজ:** Billing portal URL তৈরি

Source: `src/app/module/payment/payment.controller.ts:46`

Access: `UseGuards(AuthGuard('user', 'admin'))`

Request parameters ও DTO:

```typescript
@Req() request: Request
```

Upload/status/validation metadata:

```typescript
@Post('billing-portal')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('user', 'admin'))
```

Controller response mapping:

```typescript
{
    return this.billing.portal(request.user!.id);
  }
```

## POST /api/v1/payment/subscription/cancel

**কাজ:** Recurring subscription cancellation request

Source: `src/app/module/payment/payment.controller.ts:53`

Access: `UseGuards(AuthGuard('user', 'admin'))`

Request parameters ও DTO:

```typescript
@Req() request: Request
```

Upload/status/validation metadata:

```typescript
@Post('subscription/cancel')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('user', 'admin'))
```

Controller response mapping:

```typescript
{
    return this.billing.cancel(request.user!.id);
  }
```

## POST /api/v1/payment/subscription/:subscriptionId/upgrade

**কাজ:** নতুন local plan ID দিয়ে upgrade

Source: `src/app/module/payment/payment.controller.ts:60`

Access: `UseGuards(AuthGuard('user', 'admin'))`

Request parameters ও DTO:

```typescript
@Req() request: Request
@Param('subscriptionId') id: string
```

Upload/status/validation metadata:

```typescript
@Post('subscription/:subscriptionId/upgrade')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('user', 'admin'))
```

Controller response mapping:

```typescript
{
    return this.billing.upgrade(request.user!.id, id);
  }
```

## POST /api/v1/payment/subscription/:subscriptionId

**কাজ:** Plan activation/payment শুরু; free ও paid branch আলাদা

Source: `src/app/module/payment/payment.controller.ts:67`

Access: `UseGuards(AuthGuard('admin', 'user'))`

Request parameters ও DTO:

```typescript
@Req() request: Request
@Param('subscriptionId') subscriptionId: string
```

Upload/status/validation metadata:

```typescript
@Post('subscription/:subscriptionId')
@HttpCode(HttpStatus.CREATED)
@ApiOperation({ summary: 'Initiate a subscription payment' })
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('admin', 'user'))
```

Controller response mapping:

```typescript
{
    if (!request.user) {
      throw new UnauthorizedException();
    }

    const result = await this.paymentService.paySubscriber(
      request.user.id,
      subscriptionId,
    );

    return {
      message: 'Payment initiated successfully',
      data: result,
    };
  }
```

## POST /api/v1/payment/credits

**কাজ:** packageId দিয়ে credit purchase payment শুরু

Source: `src/app/module/payment/payment.controller.ts:91`

Access: `UseGuards(AuthGuard('user'))`

Request parameters ও DTO:

```typescript
@Req() request: Request
@Body() payload: BuyCreditsDto
```

Upload/status/validation metadata:

```typescript
@Post('credits')
@HttpCode(HttpStatus.CREATED)
@ApiOperation({ summary: 'Buy a credit package by package ID' })
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('user'))
```

Controller response mapping:

```typescript
{
    if (!request.user) throw new UnauthorizedException();
    const result = await this.paymentService.buyCredits(
      request.user.id,
      payload.packageId,
    );
    return { message: 'Credit payment initiated successfully', data: result };
  }
```

## GET /api/v1/admin/companions/:companionId/telegram-profile

**কাজ:** Telegram profile desired fields ও sync status

Source: `src/app/module/publishing/publishing.controller.ts:50`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters ও DTO:

```typescript
@Param('companionId', ParseUUIDPipe) id: string
```

Upload/status/validation metadata:

```typescript
@Get('telegram-profile')
```

Controller response mapping:

```typescript
{
    await this.stories.companion(id);
    return { data: await this.profiles.status(id) };
  }
```

## PUT /api/v1/admin/companions/:companionId/telegram-profile

**কাজ:** Display name/about/description save ও sync queue

Source: `src/app/module/publishing/publishing.controller.ts:55`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters ও DTO:

```typescript
@Param('companionId', ParseUUIDPipe) id: string
@Body() dto: TelegramProfileDto
```

Upload/status/validation metadata:

```typescript
@Put('telegram-profile')
```

Controller response mapping:

```typescript
{
    await this.stories.companion(id);
    return { data: await this.profiles.save(id, dto) };
  }
```

## POST /api/v1/admin/companions/:companionId/telegram-profile/retry

**কাজ:** Failed profile sync requeue

Source: `src/app/module/publishing/publishing.controller.ts:63`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters ও DTO:

```typescript
@Param('companionId', ParseUUIDPipe) id: string
```

Upload/status/validation metadata:

```typescript
@Post('telegram-profile/retry')
```

Controller response mapping:

```typescript
{
    return { data: await this.profiles.retry(id) };
  }
```

## GET /api/v1/admin/companions/:companionId/media-stories

**কাজ:** 24h photo/video Story admin metadata list

Source: `src/app/module/publishing/publishing.controller.ts:67`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters ও DTO:

```typescript
@Param('companionId', ParseUUIDPipe) id: string
```

Upload/status/validation metadata:

```typescript
@Get('media-stories')
```

Controller response mapping:

```typescript
{
    return { data: await this.stories.adminList(id) };
  }
```

## POST /api/v1/admin/companions/:companionId/media-stories

**কাজ:** media upload করে 24h Story publish

Source: `src/app/module/publishing/publishing.controller.ts:71`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters ও DTO:

```typescript
@Param('companionId', ParseUUIDPipe) id: string
@Body() dto: PublishMediaStoryDto
@UploadedFile() file?: Express.Multer.File
```

Upload/status/validation metadata:

```typescript
@Post('media-stories')
@ApiConsumes('multipart/form-data')
@ApiBody({
    schema: {
      type: 'object',
      required: ['media'],
      properties: {
        caption: { type: 'string', maxLength: 2048 },
        media: { type: 'string', format: 'binary' },
      },
    },
  })
@UseInterceptors(
    FileInterceptor('media', {
      storage: memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
```

Controller response mapping:

```typescript
{
    return { data: await this.stories.publish(id, dto.caption || '', file) };
  }
```

## DELETE /api/v1/admin/companions/:companionId/media-stories/:storyId

**কাজ:** Story remove

Source: `src/app/module/publishing/publishing.controller.ts:96`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters ও DTO:

```typescript
@Param('companionId', ParseUUIDPipe) id: string
@Param('storyId', ParseUUIDPipe) storyId: string
```

Upload/status/validation metadata:

```typescript
@Delete('media-stories/:storyId')
```

Controller response mapping:

```typescript
{
    return { data: await this.stories.remove(id, storyId) };
  }
```

## GET /api/v1/media-stories/summary

**কাজ:** Website avatar Story ring-এর active count/expiry

Source: `src/app/module/publishing/publishing.controller.ts:111`

Access: `UseGuards(AuthGuard('user', 'admin'))`

Request parameters ও DTO:

```typescript
@Req() req: Request
```

Upload/status/validation metadata:

```typescript
@Get('summary')
@Header('Cache-Control', 'no-store')
```

Controller response mapping:

```typescript
{
    return { data: await this.stories.summary(req.user!.id) };
  }
```

## GET /api/v1/media-stories/companions/:companionId

**কাজ:** Active media Story feed ও signed mediaPath

Source: `src/app/module/publishing/publishing.controller.ts:116`

Access: `UseGuards(AuthGuard('user', 'admin'))`

Request parameters ও DTO:

```typescript
@Param('companionId', ParseUUIDPipe) id: string
@Req() req: Request
```

Upload/status/validation metadata:

```typescript
@Get('companions/:companionId')
@Header('Cache-Control', 'no-store')
```

Controller response mapping:

```typescript
{
    return { data: await this.stories.list(id, req.user!.id) };
  }
```

## GET /api/v1/media-stories/:storyId/media

**কাজ:** Signed ticket দিয়ে image/video bytes; Range support

Source: `src/app/module/publishing/publishing.controller.ts:130`

Access: `Controller JWT guard নেই; service/provider validation প্রযোজ্য`

Request parameters ও DTO:

```typescript
@Param('storyId', ParseUUIDPipe) id: string
@Query('ticket') ticket: string | string[] | undefined
@Headers('range') range: string | undefined
@Res() res: Response
```

Upload/status/validation metadata:

```typescript
@Get(':storyId/media')
@SetMetadata('rawResponse', true)
```

Controller response mapping:

```typescript
{
    if (ticket !== undefined && typeof ticket !== 'string')
      throw new ForbiddenException('Invalid media link');
    const safeTicket = ticket ?? '';
    const row = await this.stories.media(id, safeTicket);
    const bytes = Buffer.from(row.media);
    const length = bytes.length;
    res.set({
      'Content-Type': row.mimeType,
      'Cache-Control': 'private, no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'Accept-Ranges': 'bytes',
    });
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match || (!match[1] && !match[2]))
        return res.status(416).set('Content-Range', `bytes */${length}`).end();
      const start = match[1]
        ? Number(match[1])
        : Math.max(0, length - Number(match[2]));
      const end = match[1]
        ? match[2]
          ? Math.min(Number(match[2]), length - 1)
          : length - 1
        : length - 1;
      if (
        !Number.isSafeInteger(start) ||
        !Number.isSafeInteger(end) ||
        start > end ||
        start >= length
      )
        return res.status(416).set('Content-Range', `bytes */${length}`).end();
      return res
        .status(206)
        .set({
          'Content-Range': `bytes ${start}-${end}/${length}`,
          'Content-Length': String(end - start + 1),
        })
        .send(bytes.subarray(start, end + 1));
    }
    return res.set('Content-Length', String(length)).send(bytes);
  }
```

## GET /api/v1/telegram/stories

**কাজ:** Telegram Story Mini App HTML shell

Source: `src/app/module/publishing/publishing.controller.ts:187`

Access: `Controller JWT guard নেই; service/provider validation প্রযোজ্য`

Request parameters ও DTO:

```typescript
@Res() res: Response
```

Upload/status/validation metadata:

```typescript
@Get()
@SetMetadata('rawResponse', true)
```

Controller response mapping:

```typescript
{
    const nonce = randomBytes(18).toString('base64');
    return res
      .set({
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}' https://telegram.org; style-src 'nonce-${nonce}'; img-src 'self'; media-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors https://web.telegram.org https://*.telegram.org`,
      })
      .type('html')
      .send(storyViewer.replaceAll('__NONCE__', nonce));
  }
```

## POST /api/v1/telegram/stories/:companionId/feed

**কাজ:** Telegram signed initData দিয়ে linked-user Story feed

Source: `src/app/module/publishing/publishing.controller.ts:201`

Access: `Controller JWT guard নেই; service/provider validation প্রযোজ্য`

Request parameters ও DTO:

```typescript
@Param('companionId', ParseUUIDPipe) id: string
@Body() dto: StorySessionDto
```

Upload/status/validation metadata:

```typescript
@Post(':companionId/feed')
@Header('Cache-Control', 'no-store')
```

Controller response mapping:

```typescript
{
    return {
      data: await this.stories.list(
        id,
        await this.stories.telegramUser(id, dto.initData),
      ),
    };
  }
```

## GET /api/v1/publishing/admin

**কাজ:** Backend test/admin publishing HTML; final dashboard নয়

Source: `src/app/module/publishing/publishing.controller.ts:220`

Access: `Controller JWT guard নেই; service/provider validation প্রযোজ্য`

Request parameters ও DTO:

```typescript
@Res() res: Response
```

Upload/status/validation metadata:

```typescript
@Get('admin')
@SetMetadata('rawResponse', true)
```

Controller response mapping:

```typescript
{
    if (this.config.get('PUBLISHING_ADMIN_CONSOLE_ENABLED') !== 'true')
      throw new NotFoundException();
    const nonce = randomBytes(18).toString('base64');
    return res
      .set({
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; img-src 'self' blob:; media-src 'self' blob:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`,
      })
      .type('html')
      .send(publishingConsole.replaceAll('__NONCE__', nonce));
  }
```

## POST /api/v1/subscription

**কাজ:** Subscription plan তৈরি

Source: `src/app/module/subscription/subscription.controller.ts:26`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters ও DTO:

```typescript
@Body() createSubscriptionDto: CreateSubscriptionDto
```

Upload/status/validation metadata:

```typescript
@Post()
@ApiOperation({ summary: 'Create subscription' })
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('admin'))
```

Controller response mapping:

```typescript
{
    const result = await this.subscriptionService.createSubscription(
      createSubscriptionDto,
    );
    return {
      message: 'Subscription created successfully',
      data: result,
    };
  }
```

## GET /api/v1/subscription

**কাজ:** Plan listing/filter

Source: `src/app/module/subscription/subscription.controller.ts:42`

Access: `Controller JWT guard নেই; service/provider validation প্রযোজ্য`

Request parameters ও DTO:

```typescript
@Req() req: Request
```

Upload/status/validation metadata:

```typescript
@Get()
@ApiOperation({ summary: 'Get all subscription' })
@ApiQuery({
    name: 'page',
    type: 'number',
    required: false,
  })
@ApiQuery({
    name: 'limit',
    type: 'number',
    required: false,
  })
@ApiQuery({
    name: 'sortBy',
    type: 'string',
    required: false,
  })
@ApiQuery({
    name: 'sortOrder',
    type: 'string',
    required: false,
  })
@ApiQuery({
    name: 'name',
    type: 'string',
    required: false,
  })
@ApiQuery({
    name: 'features',
    type: 'string',
    required: false,
  })
@ApiQuery({
    name: 'isPopular',
    type: 'boolean',
    required: false,
  })
@ApiQuery({
    name: 'isActive',
    type: 'boolean',
    required: false,
  })
@ApiQuery({
    name: 'searchTerm',
    type: 'string',
    required: false,
  })
@HttpCode(HttpStatus.OK)
```

Controller response mapping:

```typescript
{
    const filters = pick(req.query, [
      'searchTerm',
      'name',
      'features',
      'isPopular',
      'isActive',
    ]);
    const params = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);
    const result = await this.subscriptionService.getAllSubscription(
      filters,
      params,
    );
    return {
      message: 'Subscription fetched successfully',
      meta: result.meta,
      data: result.data,
    };
  }
```

## GET /api/v1/subscription/:id

**কাজ:** Plan details

Source: `src/app/module/subscription/subscription.controller.ts:110`

Access: `Controller JWT guard নেই; service/provider validation প্রযোজ্য`

Request parameters ও DTO:

```typescript
@Param('id') id: string
```

Upload/status/validation metadata:

```typescript
@Get(':id')
@ApiOperation({ summary: 'Get subscription by id' })
@HttpCode(HttpStatus.OK)
```

Controller response mapping:

```typescript
{
    const result = await this.subscriptionService.getSubscriptionById(id);
    return {
      message: 'Subscription fetched successfully',
      data: result,
    };
  }
```

## PUT /api/v1/subscription/:id

**কাজ:** Plan settings ও entitlementPolicy edit

Source: `src/app/module/subscription/subscription.controller.ts:121`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters ও DTO:

```typescript
@Param('id') id: string
@Body() updateSubscriptionDto: UpdateSubscriptionDto
```

Upload/status/validation metadata:

```typescript
@Put(':id')
@ApiOperation({ summary: 'Update subscription' })
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('admin'))
```

Controller response mapping:

```typescript
{
    const result = await this.subscriptionService.updateSubscription(
      id,
      updateSubscriptionDto,
    );
    return {
      message: 'Subscription updated successfully',
      data: result,
    };
  }
```

## DELETE /api/v1/subscription/:id

**কাজ:** Plan deactivate

Source: `src/app/module/subscription/subscription.controller.ts:139`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters ও DTO:

```typescript
@Param('id') id: string
```

Upload/status/validation metadata:

```typescript
@Delete(':id')
@ApiOperation({ summary: 'Delete subscription' })
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('admin'))
```

Controller response mapping:

```typescript
{
    const result = await this.subscriptionService.deleteSubscription(id);
    return {
      message: 'Subscription deleted successfully',
      data: result,
    };
  }
```

## GET /api/v1/telegram/status/:companionId

**কাজ:** Companion Telegram link ও subscription state

Source: `src/app/module/telegram/telegram-connect.controller.ts:28`

Access: `UseGuards(AuthGuard('user'))`

Request parameters ও DTO:

```typescript
@Req() request: Request
@Param('companionId', ParseUUIDPipe) companionId: string
```

Upload/status/validation metadata:

```typescript
@Get('status/:companionId')
@ApiOperation({
    summary: 'Get Telegram linking/subscription status and return-to-bot URL',
    description:
      'Use after payment confirmation. Credit balance is available from the credit wallet API. This endpoint does not grant credits or activate subscriptions.',
  })
@ApiParam({ name: 'companionId', format: 'uuid' })
```

Controller response mapping:

```typescript
{
    return { data: await this.ai.status(request.user!.id, companionId) };
  }
```

## POST /api/v1/telegram/connect/:companionId

**কাজ:** Single-use, 10-minute Telegram connect URL

Source: `src/app/module/telegram/telegram-connect.controller.ts:42`

Access: `UseGuards(AuthGuard('user'))`

Request parameters ও DTO:

```typescript
@Req() request: Request
@Param('companionId', ParseUUIDPipe) companionId: string
```

Upload/status/validation metadata:

```typescript
@Post('connect/:companionId')
@ApiOperation({
    summary: 'Create a 10-minute, single-use Telegram account link',
    description:
      'Requires an approved adult user and active subscription. Open data.telegramUrl and press START in Telegram.',
  })
@ApiParam({ name: 'companionId', format: 'uuid' })
@ApiResponse({
    status: 402,
    description:
      'Active subscription required. Subscribe on the website, then retry.',
  })
```

Controller response mapping:

```typescript
{
    return { data: await this.ai.connect(request.user!.id, companionId) };
  }
```

## GET /api/v1/telegram/app

**কাজ:** Telegram login Mini App HTML

Source: `src/app/module/telegram/telegram-mini-app.controller.ts:43`

Access: `Controller JWT guard নেই; service/provider validation প্রযোজ্য`

Request parameters ও DTO:

```typescript
@Res() response: Response
```

Upload/status/validation metadata:

```typescript
@Get()
@SetMetadata('rawResponse', true)
```

Controller response mapping:

```typescript
{
    const nonce = randomBytes(18).toString('base64');
    response
      .set({
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}' https://telegram.org; style-src 'nonce-${nonce}'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors https://web.telegram.org https://*.telegram.org`,
      })
      .type('html')
      .send(telegramLoginPage.replaceAll('__NONCE__', nonce));
  }
```

## GET /api/v1/telegram/app/settings/:companionId

**কাজ:** Companion ও website register/reset links

Source: `src/app/module/telegram/telegram-mini-app.controller.ts:58`

Access: `Controller JWT guard নেই; service/provider validation প্রযোজ্য`

Request parameters ও DTO:

```typescript
@Param('companionId', ParseUUIDPipe) companionId: string
```

Upload/status/validation metadata:

```typescript
@Get('settings/:companionId')
@Header('Cache-Control', 'no-store')
```

Controller response mapping:

```typescript
{
    return { data: await this.app.settings(companionId) };
  }
```

## POST /api/v1/telegram/app/login/:companionId

**কাজ:** Signed Telegram initData + website credentials দিয়ে account link

Source: `src/app/module/telegram/telegram-mini-app.controller.ts:64`

Access: `Controller JWT guard নেই; service/provider validation প্রযোজ্য`

Request parameters ও DTO:

```typescript
@Param('companionId', ParseUUIDPipe) id: string
@Body() body: TelegramLoginDto
```

Upload/status/validation metadata:

```typescript
@Post('login/:companionId')
@HttpCode(200)
@Header('Cache-Control', 'no-store')
```

Controller response mapping:

```typescript
{
    return {
      data: await this.app.login(
        id,
        body.initData,
        body.email,
        body.password,
        body.confirmTransfer,
      ),
    };
  }
```

## POST /api/v1/telegram/app/status/:companionId

**কাজ:** Signed Telegram session-এর connection/access status

Source: `src/app/module/telegram/telegram-mini-app.controller.ts:82`

Access: `Controller JWT guard নেই; service/provider validation প্রযোজ্য`

Request parameters ও DTO:

```typescript
@Param('companionId', ParseUUIDPipe) id: string
@Body() body: TelegramSessionDto
```

Upload/status/validation metadata:

```typescript
@Post('status/:companionId')
@HttpCode(200)
@Header('Cache-Control', 'no-store')
```

Controller response mapping:

```typescript
{
    return { data: await this.app.status(id, body.initData) };
  }
```

## POST /api/v1/webhooks/telegram/:companionId

**কাজ:** Telegram provider update, companion-specific secret

Source: `src/app/module/telegram/telegram-webhook.controller.ts:24`

Access: `Controller JWT guard নেই; service/provider validation প্রযোজ্য`

Request parameters ও DTO:

```typescript
@Param('companionId', ParseUUIDPipe) companionId: string
@Body() body: unknown
@Headers('x-telegram-bot-api-secret-token') secret?: string
```

Upload/status/validation metadata:

```typescript
@Post(':companionId')
@HttpCode(200)
```

Controller response mapping:

```typescript
{
    const key = this.telegram.botKey(companionId);
    this.telegram.verifySecret(secret, key);
    await this.queue.receive(body, key);
    return { ok: true };
  }
```

## POST /api/v1/webhooks/telegram

**কাজ:** Legacy/default Telegram provider webhook

Source: `src/app/module/telegram/telegram-webhook.controller.ts:37`

Access: `Controller JWT guard নেই; service/provider validation প্রযোজ্য`

Request parameters ও DTO:

```typescript
@Body() body: unknown
@Headers('x-telegram-bot-api-secret-token') secret?: string
```

Upload/status/validation metadata:

```typescript
@Post()
@HttpCode(200)
```

Controller response mapping:

```typescript
{
    this.telegram.verifySecret(secret);
    await this.queue.receive(body);
    return { ok: true };
  }
```

## POST /api/v1/user

**কাজ:** Legacy account creation; website signup-এ /auth/register ব্যবহার

Source: `src/app/module/user/user.controller.ts:38`

Access: `Controller JWT guard নেই; service/provider validation প্রযোজ্য`

Request parameters ও DTO:

```typescript
@Body() createUserDto: CreateUserDto
```

Upload/status/validation metadata:

```typescript
@Post()
@ApiOperation({
    summary: 'create user',
  })
@HttpCode(HttpStatus.CREATED)
```

Controller response mapping:

```typescript
{
    const result = await this.userService.createUser(createUserDto);

    return {
      message: 'create user successfully',
      data: result,
    };
  }
```

## GET /api/v1/user

**কাজ:** Admin user list/search

Source: `src/app/module/user/user.controller.ts:52`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters ও DTO:

```typescript
@Req() req: Request
```

Upload/status/validation metadata:

```typescript
@Get()
@ApiOperation({
    summary: 'get all user',
  })
@ApiQuery({
    name: 'searchTerm',
    type: String,
    required: false,
    description: 'search term',
  })
@ApiQuery({
    name: 'role',
    type: String,
    required: false,
    description: 'role',
  })
@ApiQuery({
    name: 'email',
    type: String,
    required: false,
    description: 'email',
  })
@ApiQuery({
    name: 'name',
    type: String,
    required: false,
    description: 'name',
  })
@ApiQuery({
    name: 'phoneNumber',
    type: String,
    required: false,
    description: 'phoneNumber',
  })
@ApiQuery({
    name: 'status',
    type: String,
    required: false,
    description: 'status',
  })
@ApiQuery({
    name: 'page',
    type: Number,
    required: false,
    description: 'page number',
  })
@ApiQuery({
    name: 'limit',
    type: Number,
    required: false,
    description: 'limit number',
  })
@ApiQuery({
    name: 'sortBy',
    type: String,
    required: false,
    description: 'sort by',
  })
@ApiQuery({
    name: 'sortOrder',
    type: String,
    required: false,
    description: 'sort order',
  })
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('admin'))
@HttpCode(HttpStatus.OK)
```

Controller response mapping:

```typescript
{
    const filters = pick(req.query, [
      'searchTerm',
      'role',
      'email',
      'name',
      'phoneNumber',
      'status',
    ]);
    const options = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);
    const result = await this.userService.getAllUser(filters, options);

    return {
      message: 'get all user successfully',
      meta: result.meta,
      data: result.data,
    };
  }
```

## GET /api/v1/user//overview

**কাজ:** Admin user summary counts—total, approved, subscribed ও free users

Source: `src/app/module/user/user.controller.ts:138`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters ও DTO:

```typescript
// No explicit parameters
```

Upload/status/validation metadata:

```typescript
@Get('/overview')
@ApiOperation({ summary: 'User overview' })
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('admin'))
@HttpCode(HttpStatus.OK)
```

Controller response mapping:

```typescript
{
    const result = await this.userService.getAllUserOverview();
    return {
      message: 'get all user overview successfully',
      data: result,
    };
  }
```

## GET /api/v1/user/my-profile

**কাজ:** নিজের current profile

Source: `src/app/module/user/user.controller.ts:151`

Access: `UseGuards(AuthGuard('user', 'admin'))`

Request parameters ও DTO:

```typescript
@Req() req: Request
```

Upload/status/validation metadata:

```typescript
@Get('my-profile')
@ApiOperation({
    summary: 'get my profile',
  })
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('user', 'admin'))
@HttpCode(HttpStatus.OK)
```

Controller response mapping:

```typescript
{
    const id = req.user!.id;
    const result = await this.userService.myProfile(id);

    return {
      message: 'get my profile successfully',
      data: result,
    };
  }
```

## PUT /api/v1/user/my-profile

**কাজ:** নিজের profile update; password-only limitation নিচে দেখুন

Source: `src/app/module/user/user.controller.ts:168`

Access: `UseGuards(AuthGuard('user', 'admin'))`

Request parameters ও DTO:

```typescript
@Req() req: Request
@Body() updateUserDto: UpdateUserDto
@UploadedFile() file?: Express.Multer.File
```

Upload/status/validation metadata:

```typescript
@Put('my-profile')
@ApiOperation({
    summary: 'update my profile',
  })
@ApiConsumes('multipart/form-data')
@ApiBody({ type: UpdateUserDto })
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('user', 'admin'))
@UseInterceptors(FileInterceptor('profileImage', fileUpload.uploadConfig))
@HttpCode(HttpStatus.OK)
```

Controller response mapping:

```typescript
{
    const id = req.user!.id;
    const result = await this.userService.UpdateMyProfile(
      id,
      updateUserDto,
      file,
    );

    return {
      message: 'update my profile successfully',
      data: result,
    };
  }
```

## GET /api/v1/user/:id

**কাজ:** Admin user detail

Source: `src/app/module/user/user.controller.ts:196`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters ও DTO:

```typescript
@Param('id') id: string
```

Upload/status/validation metadata:

```typescript
@Get(':id')
@ApiOperation({
    summary: 'get user by id',
  })
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('admin'))
@HttpCode(HttpStatus.OK)
```

Controller response mapping:

```typescript
{
    const result = await this.userService.getUserById(id);

    return {
      message: 'get user by id successfully',
      data: result,
    };
  }
```

## PUT /api/v1/user/:id

**কাজ:** Admin user edit; DTO permissions অনুসরণ করুন

Source: `src/app/module/user/user.controller.ts:212`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters ও DTO:

```typescript
@Param('id') id: string
@Body() updateUserDto: UpdateUserDto
@UploadedFile() file?: Express.Multer.File
```

Upload/status/validation metadata:

```typescript
@Put(':id')
@ApiOperation({
    summary: 'update user',
  })
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('admin'))
@UseInterceptors(FileInterceptor('profileImage', fileUpload.uploadConfig))
@HttpCode(HttpStatus.OK)
```

Controller response mapping:

```typescript
{
    const result = await this.userService.updateUser(id, updateUserDto, file);

    return {
      message: 'update user successfully',
      data: result,
    };
  }
```

## DELETE /api/v1/user/:id

**কাজ:** Admin user delete; destructive action confirmation

Source: `src/app/module/user/user.controller.ts:233`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters ও DTO:

```typescript
@Param('id') id: string
```

Upload/status/validation metadata:

```typescript
@Delete(':id')
@ApiOperation({
    summary: 'delete user',
  })
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('admin'))
@HttpCode(HttpStatus.OK)
```

Controller response mapping:

```typescript
{
    const result = await this.userService.deleteUser(id);

    return {
      message: 'delete user successfully',
      data: result,
    };
  }
```

## POST /api/v1/webhook

**কাজ:** Stripe signed webhook; frontend থেকে call নয়

Source: `src/app/module/webhook/webhook.controller.ts:14`

Access: `Controller JWT guard নেই; service/provider validation প্রযোজ্য`

Request parameters ও DTO:

```typescript
@Req() req: RawBodyRequest<Request>
@Headers('stripe-signature') signature?: string
```

Upload/status/validation metadata:

```typescript
@Post()
@HttpCode(200)
@ApiOperation({ summary: 'Stripe webhook handler' })
```

Controller response mapping:

```typescript
{
    return this.webhookService.handleWebhook(req.rawBody, signature);
  }
```

## GET /

**কাজ:** Backend root response

Source: `src/app.controller.ts:11`

Access: `Controller JWT guard নেই; service/provider validation প্রযোজ্য`

Request parameters ও DTO:

```typescript
@Res() res: Response
```

Upload/status/validation metadata:

```typescript
@Get()
```

Controller response mapping:

```typescript
{
    return res.type('html').send(this.appService.getHello());
  }
```

## GET /api/v1/health/live

**কাজ:** Process liveness

Source: `src/health.controller.ts:14`

Access: `Controller JWT guard নেই; service/provider validation প্রযোজ্য`

Request parameters ও DTO:

```typescript
// No explicit parameters
```

Upload/status/validation metadata:

```typescript
@Get('live')
```

Controller response mapping:

```typescript
{
    return { status: 'ok' };
  }
```

## GET /api/v1/health/ready

**কাজ:** Backend readiness check; সব provider tested বোঝায় না

Source: `src/health.controller.ts:17`

Access: `Controller JWT guard নেই; service/provider validation প্রযোজ্য`

Request parameters ও DTO:

```typescript
// No explicit parameters
```

Upload/status/validation metadata:

```typescript
@Get('ready')
```

Controller response mapping:

```typescript
{
    try {
      const rows = await this.prisma.$queryRaw<
        { ready: boolean }[]
      >`SELECT (to_regclass('request_limits') IS NOT NULL AND to_regclass('telegram_jobs') IS NOT NULL) AS ready`;
      if (!rows[0]?.ready) throw new Error();
      return { status: 'ready' };
    } catch {
      throw new ServiceUnavailableException('Service not ready');
    }
  }
```

## GET /privacy-policy

**কাজ:** Privacy policy HTML

Source: `src/legal-pages.controller.ts:40`

Access: `Controller JWT guard নেই; service/provider validation প্রযোজ্য`

Request parameters ও DTO:

```typescript
// No explicit parameters
```

Upload/status/validation metadata:

```typescript
@Get('privacy-policy')
@Header('Content-Type', 'text/html; charset=utf-8')
```

Controller response mapping:

```typescript
{
    return page(
      'Privacy Policy',
      `
      <p>This policy describes information processed by Meet Elysia through its website, accounts, AI companion features and Telegram integration.</p>
      <h2>Information we process</h2>
      <ul>
        <li>Account information such as your email, name, password hash, optional phone number and profile image.</li>
        <li>Messages you send, generated responses, conversation identifiers, selected companions and interaction history.</li>
        <li>For Telegram, your Telegram user/chat identifiers, message identifiers, message content and account-linking information received through Telegram.</li>
        <li>Subscription status, payment records, payment-provider identifiers, credits and purchases.</li>
        <li>Operational information used to investigate errors, secure accounts and process message delivery.</li>
      </ul>
      <h2>How information is used</h2>
      <p>We use this information to authenticate accounts, link Telegram conversations to users and companions, generate and deliver replies, manage subscriptions and credits, provide support and troubleshoot the service. Authorized administrators can access conversations for support and human takeover.</p>
      <h2>Service providers</h2>
      <p>Operating the service involves providers for hosting and database storage, AI processing, email, media storage and payments. Relevant message content and conversation context are sent to the configured AI service when AI replies are enabled. Telegram processes Telegram messages; Stripe handles payment processing; uploaded profile media may be stored through Cloudinary. These providers process information under their own applicable terms and privacy policies.</p>
      <h2>Storage and retention</h2>
      <p>Account, conversation and transaction information is stored to operate the service. Retention varies by record type and provider; there is no single automatic deletion period for all records. Contact us to request deletion or ask about a particular record. Some records may need to be retained for applicable obligations, dispute resolution or security, and provider backups may follow separate retention schedules.</p>
      <h2>Your choices and requests</h2>
      <p>You may stop messaging the service and contact ${contactLink} to request access, correction or deletion of your information. Follow our <a href="/data-deletion">data deletion instructions</a> to identify the account or Telegram data involved. Deleting a chat in Telegram does not itself delete records held by Meet Elysia.</p>
      <h2>Security and updates</h2>
      <p>Account passwords are stored as hashes. No online system can guarantee absolute security; do not send passwords, payment card details or other unnecessary sensitive information in companion chats. Updates to this policy will be reflected on this page.</p>
    `,
    );
  }
```

## GET /terms

**কাজ:** Terms HTML

Source: `src/legal-pages.controller.ts:69`

Access: `Controller JWT guard নেই; service/provider validation প্রযোজ্য`

Request parameters ও DTO:

```typescript
// No explicit parameters
```

Upload/status/validation metadata:

```typescript
@Get('terms')
@Header('Content-Type', 'text/html; charset=utf-8')
```

Controller response mapping:

```typescript
{
    return page(
      'Terms of Service',
      `
      <p>These terms describe use of Meet Elysia's account, companion chat and Telegram features. By using the service, you agree to these terms.</p>
      <h2>Accounts and responsible use</h2>
      <p>Provide accurate account information, use only accounts and phone numbers you are authorized to use, and keep your credentials secure. Do not use the service for unlawful activity, harassment, fraud, unauthorized access or interference with other users or systems.</p>
      <h2>Companion conversations</h2>
      <p>Companions are AI-powered characters. Generated responses may be inaccurate or inappropriate and should not be relied on as professional advice or emergency assistance. Authorized administrators may participate through human takeover. Availability and response times can vary.</p>
      <h2>Subscriptions and credits</h2>
      <p>Some features require a subscription or credits. Review the price, renewal terms and purchase details shown at checkout before paying. Contact ${contactLink} for billing, cancellation or refund questions; applicable consumer rights remain unaffected.</p>
      <h2>Your content and privacy</h2>
      <p>Only submit content you have permission to share. You allow the service and its providers to process that content as needed to deliver the requested features. See our <a href="/privacy-policy">Privacy Policy</a> for data handling and our <a href="/data-deletion">Data Deletion</a> page for removal requests.</p>
      <h2>Third-party services and access</h2>
      <p>Telegram, payment services and other integrated providers have their own terms. Features may change or become unavailable. Access may be restricted to address abuse, security issues or violations of these terms.</p>
      <h2>Contact and changes</h2>
      <p>Questions or requests to close an account can be sent to ${contactLink}. Revised terms will be posted here with an updated date.</p>
    `,
    );
  }
```

## GET /data-deletion

**কাজ:** Data-deletion instructions HTML

Source: `src/legal-pages.controller.ts:92`

Access: `Controller JWT guard নেই; service/provider validation প্রযোজ্য`

Request parameters ও DTO:

```typescript
// No explicit parameters
```

Upload/status/validation metadata:

```typescript
@Get('data-deletion')
@Header('Content-Type', 'text/html; charset=utf-8')
```

Controller response mapping:

```typescript
{
    return page(
      'Data Deletion Instructions',
      `
      <p>You can request deletion of your Meet Elysia account or data associated with its Telegram integration by email.</p>
      <h2>Submit a request</h2>
      <ol>
        <li>Email ${contactLink} with the subject <strong>Meet Elysia Data Deletion Request</strong>.</li>
        <li>Send from your registered email where possible. Include the account email and, for Telegram data, your Telegram username or user ID.</li>
        <li>Specify whether you want the entire account deleted or only particular data, such as Telegram linking information or conversation history.</li>
      </ol>
      <p>Do not include passwords, one-time codes, access tokens or payment card details.</p>
      <h2>What happens next</h2>
      <p>The support team handles requests manually and may ask for information needed to verify account ownership before processing deletion. Ask in the same email for confirmation of completion and the status of any retained records.</p>
      <h2>Scope and limitations</h2>
      <p>A request can cover your profile, stored conversations and Telegram account links. Records subject to applicable retention obligations or needed for disputes or security may require separate handling. Copies held in provider backups may follow their retention schedules.</p>
      <p>Deleting Meet Elysia data does not delete your Telegram account or copies held by Telegram or message recipients. Deleting a Telegram chat alone does not submit a deletion request to Meet Elysia. If you have an active subscription, include a cancellation request so support can address billing separately.</p>
      <p>Read our <a href="/privacy-policy">Privacy Policy</a> for an overview of the information processed by the service.</p>
    `,
    );
  }
```

<a id="dto"></a>
# সব DTO field, nested object ও validation

`IsOptional` optional; `PartialType(Base)` base fields optional করে। Nested object `Type`/`ValidateNested` দেখে form বানান। `ApiProperty` example production default নয়। `messageLimit` legacy field; creditAllowance/policy আলাদা। Body-এর extra field ValidationPipe whitelist-এ বাদ যেতে পারে—unsupported admin permission field পাঠাবেন না।

## CreateAuthDto

Source: `src/app/module/auth/dto/create-auth.dto.ts`

```typescript
export class CreateAuthDto {
  @ApiProperty({
    example: 'John Doe',
    description: 'User full name',
  })
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  name!: string;

  @ApiProperty({
    example: 'john@example.com',
    description: 'User email address',
  })
  @IsEmail({}, { message: 'Please provide a valid email' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;

  @ApiProperty({
    example: '01712345678',
    description: 'User phone number',
  })
  @IsString()
  @IsNotEmpty({ message: 'Phone number is required' })
  phoneNumber!: string;

  @ApiProperty({
    example: 'Password123',
    description: 'User password',
    minLength: 6,
  })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(6, {
    message: 'Password must be at least 6 characters',
  })
  password!: string;

  @ApiPropertyOptional({
    example: true,
    default: false,
    description: 'Whether the companion is adult eligible',
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  adultEligible?: boolean;
}
```

## LoginAuthDto

Source: `src/app/module/auth/dto/create-auth.dto.ts`

```typescript
export class LoginAuthDto {
  @ApiProperty({
    example: 'john@example.com',
  })
  @IsEmail({}, { message: 'Please provide a valid email' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;

  @ApiProperty({
    example: 'Password123',
  })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  password!: string;
}
```

## ForgotPasswordAuthDto

Source: `src/app/module/auth/dto/create-auth.dto.ts`

```typescript
export class ForgotPasswordAuthDto {
  @ApiProperty({
    example: 'john@example.com',
  })
  @IsEmail({}, { message: 'Please provide a valid email' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;
}
```

## VerifyOtpAuthDto

Source: `src/app/module/auth/dto/create-auth.dto.ts`

```typescript
export class VerifyOtpAuthDto {
  @ApiProperty({
    example: 'john@example.com',
  })
  @IsEmail({}, { message: 'Please provide a valid email' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;

  @ApiProperty({
    example: '123456',
    description: '6 digit OTP',
  })
  @IsString()
  @IsNotEmpty({ message: 'OTP is required' })
  @Matches(/^\d{6}$/, {
    message: 'OTP must be exactly 6 digits',
  })
  otp!: string;
}
```

## ResetPasswordAuthDto

Source: `src/app/module/auth/dto/create-auth.dto.ts`

```typescript
export class ResetPasswordAuthDto {
  @ApiProperty({ description: 'Single-use resetToken returned by verify-otp' })
  @IsString()
  @Matches(/^[a-f0-9]{64}$/)
  resetToken!: string;
  @ApiProperty({
    example: 'john@example.com',
  })
  @IsEmail({}, { message: 'Please provide a valid email' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;

  @ApiProperty({
    example: 'NewPassword123',
    minLength: 6,
  })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(6, {
    message: 'Password must be at least 6 characters',
  })
  password!: string;
}
```

## ChangePasswordAuthDto

Source: `src/app/module/auth/dto/create-auth.dto.ts`

```typescript
export class ChangePasswordAuthDto {
  @ApiProperty({
    example: 'OldPassword123',
  })
  @IsString()
  @IsNotEmpty({ message: 'Old password is required' })
  oldPassword!: string;

  @ApiProperty({
    example: 'NewPassword123',
    minLength: 6,
  })
  @IsString()
  @IsNotEmpty({ message: 'New password is required' })
  @MinLength(6, {
    message: 'New password must be at least 6 characters',
  })
  newPassword!: string;
}
```

## UpdateAuthDto

Source: `src/app/module/auth/dto/update-auth.dto.ts`

```typescript
export class UpdateAuthDto extends PartialType(CreateAuthDto) {}
```

## SendMessageDto

Source: `src/app/module/chat/dto/send-message.dto.ts`

```typescript
export class SendMessageDto {
  @ApiProperty({required:false,description:'UUID; reuse on retries to avoid duplicate replies and charges'})
  @IsOptional()
  @IsUUID()
  requestId?: string;
  @ApiProperty({
    enum: ['text', 'voice'],
    required: false,
    description: 'Voice messages supply their transcript in message.',
  })
  @IsOptional()
  @IsIn(['text', 'voice'])
  type?: 'text' | 'voice';

  @ApiProperty({ example: 'Hello, how are you?' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  message!: string;
}
```

## CompanionPersonalityDto

Source: `src/app/module/companions/dto/create-companion.dto.ts`

```typescript
export class CompanionPersonalityDto {
  @ApiProperty({ type: [String] })
  @Transform(toArray)
  @IsArray()
  @IsString({ each: true })
  traits!: string[];

  @ApiProperty({})
  @IsString()
  @IsNotEmpty()
  about!: string;

  @ApiProperty({})
  @IsString()
  @IsNotEmpty()
  essence!: string;

  @ApiProperty({ type: [String] })
  @Transform(toArray)
  @IsArray()
  @IsString({ each: true })
  sharedTraits!: string[];
}
```

## CompanionCommunicationStyleDto

Source: `src/app/module/companions/dto/create-companion.dto.ts`

```typescript
export class CompanionCommunicationStyleDto {
  @ApiProperty({ type: [String] })
  @Transform(toArray)
  @IsArray()
  @IsString({ each: true })
  styleTraits!: string[];

  @ApiProperty({})
  @IsString()
  @IsNotEmpty()
  topicsSheEnjoys!: string;

  @ApiProperty({ type: [String] })
  @Transform(toArray)
  @IsArray()
  @IsString({ each: true })
  whatYouExperience!: string[];
}
```

## CompanionBackgroundDto

Source: `src/app/module/companions/dto/create-companion.dto.ts`

```typescript
export class CompanionBackgroundDto {
  @ApiProperty({})
  @IsString()
  @IsNotEmpty()
  location!: string;

  @ApiProperty({})
  @IsString()
  @IsNotEmpty()
  occupation!: string;

  @ApiProperty({ type: [String] })
  @Transform(toArray)
  @IsArray()
  @IsString({ each: true })
  lifestyle!: string[];
}
```

## CompanionVisualProfileDto

Source: `src/app/module/companions/dto/create-companion.dto.ts`

```typescript
export class CompanionVisualProfileDto {
  @ApiProperty({ type: [String] })
  @Transform(toArray)
  @IsArray()
  @IsString({ each: true })
  aestheticKeywords!: string[];

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  note?: string | null;

  @ApiProperty({ type: [String] })
  @Transform(toArray)
  @IsArray()
  @IsString({ each: true })
  referenceImages!: string[];

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  physicalIdentity?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  generationInstructions?: string | null;
}
```

## CompanionVoiceSettingsDto

Source: `src/app/module/companions/dto/create-companion.dto.ts`

```typescript
export class CompanionVoiceSettingsDto {
  @ApiProperty({})
  @Transform(toNumber)
  @IsNumber()
  stability!: number;

  @ApiProperty({})
  @Transform(toNumber)
  @IsNumber()
  similarityBoost!: number;

  @ApiProperty({})
  @Transform(toNumber)
  @IsNumber()
  style!: number;

  @ApiProperty({})
  @Transform(toBoolean)
  @IsBoolean()
  useSpeakerBoost!: boolean;

  @ApiProperty({})
  @Transform(toNumber)
  @IsNumber()
  speed!: number;
}
```

## CompanionVoiceDto

Source: `src/app/module/companions/dto/create-companion.dto.ts`

```typescript
export class CompanionVoiceDto {
  @ApiProperty({})
  @IsString()
  @IsNotEmpty()
  provider!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  voiceId?: string | null;

  @ApiPropertyOptional({
    type: () => CompanionVoiceSettingsDto,
    description: 'Nested JSON object',
  })
  @IsOptional()
  @nested(CompanionVoiceSettingsDto)
  @IsObject()
  @ValidateNested()
  settings?: CompanionVoiceSettingsDto;
}
```

## CreateCompanionDto

Source: `src/app/module/companions/dto/create-companion.dto.ts`

```typescript
export class CreateCompanionDto {
  @ApiProperty({})
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({})
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  version?: number;

  @ApiProperty({})
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional({ type: Number, nullable: true })
  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(18)
  age?: number | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  backstory?: string | null;

  @ApiProperty({ type: [String] })
  @Transform(toArray)
  @IsArray()
  @IsString({ each: true })
  voiceDescription!: string[];

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  profileImage?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  coverImage?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(toArray)
  @IsArray()
  @IsString({ each: true })
  galleryImages?: string[];

  @ApiPropertyOptional({})
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(toBoolean)
  @IsBoolean()
  status?: boolean;

  @ApiProperty({ type: [String] })
  @Transform(toArray)
  @IsArray()
  @IsString({ each: true })
  interests!: string[];

  @ApiPropertyOptional({
    type: () => CompanionPersonalityDto,
    description: 'Nested JSON object',
  })
  @IsOptional()
  @nested(CompanionPersonalityDto)
  @IsObject()
  @ValidateNested()
  personality?: CompanionPersonalityDto;

  @ApiPropertyOptional({
    type: () => CompanionCommunicationStyleDto,
    description: 'Nested JSON object',
  })
  @IsOptional()
  @nested(CompanionCommunicationStyleDto)
  @IsObject()
  @ValidateNested()
  communicationStyle?: CompanionCommunicationStyleDto;

  @ApiPropertyOptional({
    type: () => CompanionBackgroundDto,
    description: 'Nested JSON object',
  })
  @IsOptional()
  @nested(CompanionBackgroundDto)
  @IsObject()
  @ValidateNested()
  background?: CompanionBackgroundDto;

  @ApiPropertyOptional({
    type: () => CompanionVisualProfileDto,
    description: 'Nested JSON object',
  })
  @IsOptional()
  @nested(CompanionVisualProfileDto)
  @IsObject()
  @ValidateNested()
  visualProfile?: CompanionVisualProfileDto;

  @ApiPropertyOptional({
    type: () => CompanionVoiceDto,
    description: 'Nested JSON object',
  })
  @IsOptional()
  @nested(CompanionVoiceDto)
  @IsObject()
  @ValidateNested()
  voice?: CompanionVoiceDto;
}
```

## UpdateCompanionPersonalityDto

Source: `src/app/module/companions/dto/update-companion.dto.ts`

```typescript
export class UpdateCompanionPersonalityDto extends PartialType(
  CompanionPersonalityDto,
  { skipNullProperties: false },
) {}
```

## UpdateCompanionCommunicationStyleDto

Source: `src/app/module/companions/dto/update-companion.dto.ts`

```typescript
export class UpdateCompanionCommunicationStyleDto extends PartialType(
  CompanionCommunicationStyleDto,
  { skipNullProperties: false },
) {}
```

## UpdateCompanionBackgroundDto

Source: `src/app/module/companions/dto/update-companion.dto.ts`

```typescript
export class UpdateCompanionBackgroundDto extends PartialType(
  CompanionBackgroundDto,
  { skipNullProperties: false },
) {}
```

## UpdateCompanionVisualProfileDto

Source: `src/app/module/companions/dto/update-companion.dto.ts`

```typescript
export class UpdateCompanionVisualProfileDto extends PartialType(
  CompanionVisualProfileDto,
  { skipNullProperties: false },
) {}
```

## UpdateCompanionVoiceSettingsDto

Source: `src/app/module/companions/dto/update-companion.dto.ts`

```typescript
export class UpdateCompanionVoiceSettingsDto extends PartialType(
  CompanionVoiceSettingsDto,
  { skipNullProperties: false },
) {}
```

## UpdateCompanionVoiceDto

Source: `src/app/module/companions/dto/update-companion.dto.ts`

```typescript
export class UpdateCompanionVoiceDto extends PartialType(
  OmitType(CompanionVoiceDto, ['settings'] as const),
  { skipNullProperties: false },
) {
  @ApiPropertyOptional({ type: () => UpdateCompanionVoiceSettingsDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @nested(UpdateCompanionVoiceSettingsDto)
  settings?: UpdateCompanionVoiceSettingsDto;
}
```

## UpdateCompanionDto

Source: `src/app/module/companions/dto/update-companion.dto.ts`

```typescript
export class UpdateCompanionDto extends PartialType(
  OmitType(CreateCompanionDto, [
    'personality',
    'communicationStyle',
    'background',
    'visualProfile',
    'voice',
  ] as const),
  { skipNullProperties: false },
) {
  @ApiPropertyOptional({ type: () => UpdateCompanionPersonalityDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @nested(UpdateCompanionPersonalityDto)
  personality?: UpdateCompanionPersonalityDto;
  @ApiPropertyOptional({ type: () => UpdateCompanionCommunicationStyleDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @nested(UpdateCompanionCommunicationStyleDto)
  communicationStyle?: UpdateCompanionCommunicationStyleDto;
  @ApiPropertyOptional({ type: () => UpdateCompanionBackgroundDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @nested(UpdateCompanionBackgroundDto)
  background?: UpdateCompanionBackgroundDto;
  @ApiPropertyOptional({ type: () => UpdateCompanionVisualProfileDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @nested(UpdateCompanionVisualProfileDto)
  visualProfile?: UpdateCompanionVisualProfileDto;
  @ApiPropertyOptional({ type: () => UpdateCompanionVoiceDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @nested(UpdateCompanionVoiceDto)
  voice?: UpdateCompanionVoiceDto;
}
```

## UpdateVoiceDto

Source: `src/app/module/companions/dto/update-companion.dto.ts`

```typescript
export class UpdateVoiceDto {
  @ApiProperty({ example: 'your-provider-voice-id' })
  @IsString()
  @IsNotEmpty()
  voiceId: string;
}
```

## CreateCreditPackageDto

Source: `src/app/module/credit/dto/credit.dto.ts`

```typescript
export class CreateCreditPackageDto {
  @ApiProperty({ example: 'Starter Credits' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 100 })
  @IsInt()
  @Min(1)
  credits!: number;

  @ApiProperty({ example: '4.99' })
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, { message: 'Price must be a valid amount' })
  price!: string;

  @ApiPropertyOptional({ example: 'usd', default: 'usd' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
```

## UpdateCreditPackageDto

Source: `src/app/module/credit/dto/credit.dto.ts`

```typescript
export class UpdateCreditPackageDto extends PartialType(
  CreateCreditPackageDto,
) {}
```

## CreateDashboardDto

Source: `src/app/module/dashboard/dto/create-dashboard.dto.ts`

```typescript
export class CreateDashboardDto {}
```

## UpdateDashboardDto

Source: `src/app/module/dashboard/dto/update-dashboard.dto.ts`

```typescript
export class UpdateDashboardDto extends PartialType(CreateDashboardDto) {}
```

## PageDto

Source: `src/app/module/engagement/engagement.dto.ts`

```typescript
export class PageDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;
  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;
}
```

## RelationshipDto

Source: `src/app/module/engagement/engagement.dto.ts`

```typescript
export class RelationshipDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nickname?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}
```

## CostDto

Source: `src/app/module/engagement/engagement.dto.ts`

```typescript
export class CostDto {
  @ApiProperty()
  @IsInt()
  @Min(0)
  @Max(1000000)
  credits!: number;
}
```

## ModeDto

Source: `src/app/module/engagement/engagement.dto.ts`

```typescript
export class ModeDto {
  @ApiProperty({ enum: ['ai', 'human'] })
  @IsIn(['ai', 'human'])
  mode!: 'ai' | 'human';
}
```

## HumanReplyDto

Source: `src/app/module/engagement/engagement.dto.ts`

```typescript
export class HumanReplyDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  messageId!: string;
  @ApiProperty()
  @IsString()
  @Matches(/\S/)
  @MaxLength(5000)
  message!: string;
}
```

## StoryDto

Source: `src/app/module/engagement/engagement.dto.ts`

```typescript
export class StoryDto {
  @ApiProperty({ example: '2026-09-08' })
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  day!: string;
  @ApiProperty()
  @IsString()
  @Matches(/\S/)
  @MaxLength(200)
  title!: string;
  @ApiProperty()
  @IsString()
  @Matches(/\S/)
  @MaxLength(20000)
  content!: string;
  @ApiProperty()
  @IsBoolean()
  published!: boolean;
}
```

## PhotoDto

Source: `src/app/module/engagement/engagement.dto.ts`

```typescript
export class PhotoDto {
  @ApiProperty({ description: 'URL from this companion’s galleryImages' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  photoUrl!: string;
}
```

## NotificationDto

Source: `src/app/module/engagement/engagement.dto.ts`

```typescript
export class NotificationDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  userId!: string;
  @ApiProperty()
  @IsString()
  @Matches(/\S/)
  @MaxLength(200)
  title!: string;
  @ApiProperty()
  @IsString()
  @Matches(/\S/)
  @MaxLength(5000)
  body!: string;
}
```

## CreateGiftDto

Source: `src/app/module/gift/dto/gift.dto.ts`

```typescript
export class CreateGiftDto {
  @ApiProperty({ example: 'Rose' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({
    example: 'https://example.com/rose.png',
    type: 'string',
    format: 'binary',
  })
  @IsOptional()
  @IsString()
  image?: string;

  @ApiPropertyOptional({ example: 10 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  creditCost!: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;
}
```

## UpdateGiftDto

Source: `src/app/module/gift/dto/gift.dto.ts`

```typescript
export class UpdateGiftDto extends PartialType(CreateGiftDto) {}
```

## SendGiftDto

Source: `src/app/module/gift/dto/gift.dto.ts`

```typescript
export class SendGiftDto {
  @ApiProperty({ example: 'companion-id' })
  @IsString()
  @IsNotEmpty()
  companionId!: string;
}
```

## RoutineSlotDto

Source: `src/app/module/lifestyle/lifestyle.dto.ts`

```typescript
export class RoutineSlotDto {
  @ApiProperty({ description: 'ISO weekday: Monday=1, Sunday=7' })
  @IsInt()
  @Min(1)
  @Max(7)
  day!: number;
  @ApiProperty({ example: '06:00' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  start!: string;
  @ApiProperty({ example: '12:00' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  end!: string;
  @ApiProperty() @IsString() @Matches(/\S/) @MaxLength(500) activity!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;
}
```

## RoutineDto

Source: `src/app/module/lifestyle/lifestyle.dto.ts`

```typescript
export class RoutineDto {
  @ApiProperty({ example: 'Asia/Dubai' })
  @IsString()
  @MaxLength(80)
  timezone!: string;
  @ApiProperty({ type: [RoutineSlotDto] })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => RoutineSlotDto)
  weekly!: RoutineSlotDto[];
}
```

## LibraryPhotoDto

Source: `src/app/module/lifestyle/lifestyle.dto.ts`

```typescript
export class LibraryPhotoDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) caption =
    '';
  @ApiPropertyOptional({
    description: 'Comma-separated tags, e.g. gym,morning,sporty',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  tags = '';
}
```

## ApprovePhotoDto

Source: `src/app/module/lifestyle/lifestyle.dto.ts`

```typescript
export class ApprovePhotoDto {
  @ApiProperty() @IsBoolean() approved!: boolean;
}
```

## DailyContentDto

Source: `src/app/module/lifestyle/lifestyle.dto.ts`

```typescript
export class DailyContentDto {
  @ApiProperty({ example: '2026-10-25' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  day!: string;
  @ApiProperty({ description: 'ISO instant including timezone' })
  @IsDateString({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/)
  publishAt!: string;
  @ApiProperty({
    description: 'End of delivery window; missed content is skipped',
  })
  @IsDateString({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/)
  expiresAt!: string;
  @ApiProperty() @IsUUID() photoId!: string;
  @ApiProperty() @IsString() @Matches(/\S/) @MaxLength(4000) text!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) activity =
    '';
  @ApiPropertyOptional() @IsOptional() @IsBoolean() published = false;
}
```

## DailyPreferenceDto

Source: `src/app/module/lifestyle/lifestyle.dto.ts`

```typescript
export class DailyPreferenceDto {
  @ApiProperty() @IsUUID() companionId!: string;
  @ApiProperty() @IsBoolean() enabled!: boolean;
}
```

## PhotoRequestDto

Source: `src/app/module/lifestyle/lifestyle.dto.ts`

```typescript
export class PhotoRequestDto {
  @ApiProperty({
    description: 'Unique per user request; reuse on network retry',
  })
  @IsUUID()
  requestId!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) tag?: string;
}
```

## EntitlementPolicyDto

Source: `src/app/module/lifestyle/lifestyle.dto.ts`

```typescript
export class EntitlementPolicyDto {
  @ApiProperty({ enum: ['paid', 'trial'] }) @IsIn(['paid', 'trial']) kind!:
    'paid' | 'trial';
  @ApiPropertyOptional() @IsOptional() @IsBoolean() dailyPhoto = false;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() dailyText = false;
  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  trialRepliesPerDay = 10;
  @ApiPropertyOptional({ default: 30 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  trialRepliesTotal = 30;
  @ApiPropertyOptional({ default: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  trialPhotosTotal = 3;
}
```

## BroadcastNewsletterDto

Source: `src/app/module/newsletter/dto/broadcast-newsletter.dto.ts`

```typescript
export class BroadcastNewsletterDto {
  @ApiProperty({ example: 'Latest news from Elysia' })
  @IsString()
  @IsNotEmpty()
  subject: string;

  @ApiProperty({ example: '<h1>Hello!</h1><p>Here is our latest update.</p>' })
  @IsString()
  @IsNotEmpty()
  html: string;
}
```

## CreateNewsletterDto

Source: `src/app/module/newsletter/dto/create-newsletter.dto.ts`

```typescript
export class CreateNewsletterDto {
  @ApiProperty({
    example: '[EMAIL_ADDRESS]',
    description: 'The email of the user',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
```

## UpdateNewsletterDto

Source: `src/app/module/newsletter/dto/update-newsletter.dto.ts`

```typescript
export class UpdateNewsletterDto extends PartialType(CreateNewsletterDto) {}
```

## BuyCreditsDto

Source: `src/app/module/payment/dto/buy-credits.dto.ts`

```typescript
export class BuyCreditsDto {
  @ApiProperty({ example: 'credit-package-id' })
  @IsString()
  @IsNotEmpty()
  packageId!: string;
}
```

## CreatePaymentDto

Source: `src/app/module/payment/dto/create-payment.dto.ts`

```typescript
export class CreatePaymentDto {}
```

## UpdatePaymentDto

Source: `src/app/module/payment/dto/update-payment.dto.ts`

```typescript
export class UpdatePaymentDto extends PartialType(CreatePaymentDto) {}
```

## TelegramProfileDto

Source: `src/app/module/publishing/publishing.dto.ts`

```typescript
export class TelegramProfileDto {
  @ApiPropertyOptional({ maxLength: 64 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  displayName?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  about?: string;

  @ApiPropertyOptional({ maxLength: 512 })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  description?: string;
}
```

## PublishMediaStoryDto

Source: `src/app/module/publishing/publishing.dto.ts`

```typescript
export class PublishMediaStoryDto {
  @ApiPropertyOptional({ maxLength: 2048 })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  caption?: string;
}
```

## StorySessionDto

Source: `src/app/module/publishing/publishing.dto.ts`

```typescript
export class StorySessionDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(8192)
  initData!: string;
}
```

## CreateSubscriptionDto

Source: `src/app/module/subscription/dto/create-subscription.dto.ts`

```typescript
export class CreateSubscriptionDto {
  @ApiPropertyOptional({ type: EntitlementPolicyDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => EntitlementPolicyDto)
  entitlementPolicy?: EntitlementPolicyDto;
  @ApiProperty({
    example: 'Premium Plan',
    description: 'Subscription plan name',
  })
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  name!: string;

  @ApiProperty({
    example: '29.99',
    description: 'Subscription plan price',
  })
  @IsString()
  @IsNotEmpty({ message: 'Price is required' })
  price!: string;

  @ApiPropertyOptional({
    example: 1000,
    description: 'Deprecated: use creditAllowance',
  })
  @IsOptional()
  @IsInt({ message: 'Message limit must be an integer' })
  @Min(0, {
    message: 'Message limit cannot be negative',
  })
  messageLimit?: number;

  @ApiPropertyOptional({
    example: 500,
    description: 'Credits granted for each subscription period',
  })
  @IsOptional()
  @IsInt({ message: 'Credit allowance must be an integer' })
  @Min(0, { message: 'Credit allowance cannot be negative' })
  creditAllowance?: number;

  @ApiProperty({ example: 30, required: false, default: 30 })
  @IsOptional()
  @IsInt()
  @Min(1)
  durationDays?: number;

  @ApiProperty({
    example: [
      '1000 messages per month',
      'Priority support',
      'Advanced AI features',
    ],
    description: 'List of subscription features',
    type: [String],
  })
  @IsArray({
    message: 'Features must be an array',
  })
  @IsString({
    each: true,
    message: 'Each feature must be a string',
  })
  features!: string[];

  @ApiPropertyOptional({
    example: true,
    default: false,
    description: 'Whether this plan is popular',
  })
  @IsOptional()
  @IsBoolean({
    message: 'isPopular must be a boolean',
  })
  isPopular?: boolean;

  @ApiPropertyOptional({
    example: true,
    default: true,
    description: 'Whether this subscription plan is active',
  })
  @IsOptional()
  @IsBoolean({
    message: 'isActive must be a boolean',
  })
  isActive?: boolean;
}
```

## UpdateSubscriptionDto

Source: `src/app/module/subscription/dto/update-subscription.dto.ts`

```typescript
export class UpdateSubscriptionDto extends PartialType(CreateSubscriptionDto) {}
```

## TelegramSessionDto

Source: `src/app/module/telegram/telegram-mini-app.controller.ts`

```typescript
class TelegramSessionDto {
  @IsString() @MinLength(1) @MaxLength(8192) initData!: string;
}
```

## TelegramLoginDto

Source: `src/app/module/telegram/telegram-mini-app.controller.ts`

```typescript
class TelegramLoginDto extends TelegramSessionDto {
  @IsOptional() @IsBoolean() confirmTransfer?: boolean;
  @IsEmail() @MaxLength(254) email!: string;
  @IsString() @MinLength(1) @MaxLength(256) password!: string;
}
```

## CreateUserDto

Source: `src/app/module/user/dto/create-user.dto.ts`

```typescript
export class CreateUserDto {
  @ApiPropertyOptional({ example: '' })
  @IsString()
  @IsNotEmpty({ message: 'Name is requried' })
  name!: string;

  @ApiPropertyOptional({ example: '' })
  @IsEmail()
  @IsNotEmpty({ message: 'Email is requried' })
  email!: string;

  @ApiPropertyOptional({ example: '' })
  @IsString()
  @IsNotEmpty({ message: 'Password is requried' })
  password!: string;

  @ApiPropertyOptional({ example: '' })
  @IsString()
  @IsNotEmpty({ message: 'Phone number is requried' })
  phoneNumber!: string;

  @ApiPropertyOptional({ type: 'string', format: 'binary' })
  @IsString()
  @IsOptional()
  profileImage?: string;
}
```

## UpdateUserDto

Source: `src/app/module/user/dto/update-user.dto.ts`

```typescript
export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['email', 'password'] as const),
) {}
```

# Response enum values

এগুলো database/response enum; সব value সব request DTO-তে allowed নয়। যেমন ChatMessageType-এ photo থাকলেও SendMessageDto.type কেবল text/voice নেয়।

```prisma
enum UserRole {
  admin
  user
}

enum Status {
  pending
  approved
  rejected
}

enum PaymentStatus {
  pending
  completed
  failed
  refunded
}

enum CreditDirection {
  credit
  debit
}

enum CreditReason {
  purchase
  opening_balance
  subscription_grant
  subscription_expiry
  expiry
  photo
  voice
  extra_message
  gift
}

enum ChatMessageType {
  text
  voice
  photo
  gift
}

enum GiftTransactionStatus {
  completed
  refunded
}

```

# Documentation refresh

Backend route/DTO পরিবর্তন হলে repository root থেকে:

```powershell
node scripts/export-frontend-contract.cjs
node scripts/build-full-frontend-readme.cjs
```

Generator প্রতিটি endpoint-এর purpose mapping ও code-fence balance যাচাই করে। নতুন endpoint হলে generator-এর purpose map-ও হালনাগাদ করুন। Service-এর behavior বদলালে flow guide-ও review করতে হবে; শুধু route scan business logic যাচাই করে না।
