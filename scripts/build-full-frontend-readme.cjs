// Documentation only: no env reads, database, provider calls or application startup.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root,p),'utf8').replace(/\r\n/g,'\n');
const contract = JSON.parse(read('docs/frontend-handoff/api-contract.json'));
const purpose = {
 AuthController: {register:'নতুন website account তৈরি; এরপর login',login:'Email/password login, accessToken ও refresh cookie',refreshToken:'HttpOnly refresh cookie দিয়ে নতুন access token',forgotPassword:'Password reset OTP পাঠানো',verifyOtp:'OTP যাচাই করে resetToken নেওয়া',resetPassword:'resetToken দিয়ে নতুন password',changePassword:'বর্তমান password যাচাই করে পরিবর্তন',logout:'Session logout ও refresh cookie clear'},
 ChatController:{getConversations:'নিজের conversation list',getMessages:'নির্বাচিত companion-এর paginated message history',getUsage:'Active subscription, ব্যবহৃত/বাকি credits ও purchased balance',sendMessage:'Text/transcript পাঠিয়ে AI reply; requestId retry support'},
 CompanionsController:{createCompanion:'Nested metadata দিয়ে companion তৈরি',getAllCompanions:'Public companion cards, filter ও pagination',getCompanionById:'Companion details page data',updateCompanion:'Companion metadata edit',updateProfileImage:'Profile picture upload; configured হলে Telegram sync queue',updateCoverImage:'Cover image upload',addGalleryImages:'Gallery-তে ছবি যোগ',updateGalleryImages:'Gallery replace—append নয়',deleteCompanion:'Companion delete action; confirmation আবশ্যক',updateVoice:'Companion voiceId বদলানো'},
 CreditController:{createPackage:'Extra credit package তৈরি',getPackages:'Active packages দিয়ে purchase cards',updatePackage:'Package price/credits/active state edit',deactivatePackage:'Package deactivate',purchase:'Credit purchase payment শুরু; /payment/credits-এর alternative',getWallet:'নিজের effective wallet, credit lots/expiry ও recent ledger'},
 DashboardController:{dashboardOverview:'Admin summary cards—users, subscriptions, messages, conversations, revenue'},
 EngagementController:{relationships:'নিজের relationship list',relationship:'নিজের nickname/notes edit',stories:'Published dated text/life events; 24h media Story নয়',photo:'Existing gallery photo unlock/view; library request নয়',photos:'নিজের viewed-photo history',ledger:'নিজের credit transaction history',costs:'বর্তমান per-action credit rates',notifications:'নিজের notification list',read:'নিজের notification read করা'},
 EngagementAdminController:{cost:'Action credit rate পরিবর্তন',story:'Companion/day অনুযায়ী text life event upsert',stories:'সব text life events, future/draft সহ',conversations:'Conversation monitoring list',conversation:'Conversation details ও messages',mode:'AI/human mode ও admin takeover',reply:'Human reply DB-তে save; Telegram push নয়',user:'User finance/relationship detail',ledger:'নির্বাচিত user-এর ledger',notification:'নির্বাচিত user-এর in-app notification তৈরি'},
 GiftController:{createGift:'Gift item ও image তৈরি',getGifts:'Gift catalogue',updateGift:'Gift metadata edit; file PATCH নয়',deactivateGift:'Gift deactivate',sendGift:'Companion-কে gift পাঠানো, backend credit debit'},
 LifestyleAdminController:{routine:'Weekly routine পড়া',saveRoutine:'Timezone ও পুরো weekly routine replace',context:'বর্তমান local activity/context preview',photos:'Approved/unapproved library list',upload:'Frontend image upload; প্রথমে unapproved',approve:'Library photo approval/revoke',daily:'Daily photo/text schedule list',save:'নির্দিষ্ট local day-এর daily content draft/publish',unpublish:'Daily content-এর নতুন delivery বন্ধ',deliveries:'Daily delivery status ও safe error দেখানো'},
 LifestyleController:{preference:'Daily update preference পড়া',save:'এক companion নির্বাচন ও daily opt-in/out',allowances:'Trial/paid included allowances ও usage',photo:'Unseen approved library photo request; requestId required',inbox:'নিজের included daily photo/text inbox'},
 NewsletterController:{sendMail:'Newsletter subscribe form',broadcastNewsletter:'Newsletter email broadcast; explicit admin action',getAllNewsletter:'Subscriber list—বর্তমান code-এ guard নেই, public UI নয়',getNewsletterById:'Subscriber detail—বর্তমান code-এ guard নেই, public UI নয়'},
 PaymentController:{status:'Recurring billing/subscription status',sync:'Verified provider status দিয়ে subscription reconcile; credit-purchase sync নয়',portal:'Billing portal URL তৈরি',cancel:'Recurring subscription cancellation request',upgrade:'নতুন local plan ID দিয়ে upgrade',paySubscriber:'Plan activation/payment শুরু; free ও paid branch আলাদা',buyCredits:'packageId দিয়ে credit purchase payment শুরু'},
 PublishingAdminController:{status:'Telegram profile desired fields ও sync status',profile:'Display name/about/description save ও sync queue',retry:'Failed profile sync requeue',list:'24h photo/video Story admin metadata list',publish:'media upload করে 24h Story publish',remove:'Story remove'},
 MediaStoryController:{summary:'Website avatar Story ring-এর active count/expiry',feed:'Active media Story feed ও signed mediaPath'},
 StoryMediaController:{media:'Signed ticket দিয়ে image/video bytes; Range support'},
 TelegramStoryController:{page:'Telegram Story Mini App HTML shell',feed:'Telegram signed initData দিয়ে linked-user Story feed'},
 PublishingConsoleController:{page:'Backend test/admin publishing HTML; final dashboard নয়'},
 SubscriptionController:{createSubscription:'Subscription plan তৈরি',getAllSubscription:'Plan listing/filter',getSubscriptionById:'Plan details',updateSubscription:'Plan settings ও entitlementPolicy edit',deleteSubscription:'Plan deactivate'},
 TelegramConnectController:{status:'Companion Telegram link ও subscription state',connect:'Single-use, 10-minute Telegram connect URL'},
 TelegramMiniAppController:{page:'Telegram login Mini App HTML',settings:'Companion ও website register/reset links',login:'Signed Telegram initData + website credentials দিয়ে account link',status:'Signed Telegram session-এর connection/access status'},
 TelegramWebhookController:{receiveForCompanion:'Telegram provider update, companion-specific secret',receive:'Legacy/default Telegram provider webhook'},
 UserController:{createUser:'Legacy account creation; website signup-এ /auth/register ব্যবহার',getAllUser:'Admin user list/search',myProfile:'নিজের current profile',UpdateMyProfile:'নিজের profile update; password-only limitation নিচে দেখুন',getUserById:'Admin user detail',updateUser:'Admin user edit; DTO permissions অনুসরণ করুন',deleteUser:'Admin user delete; destructive action confirmation'},
 WebhookController:{handleWebhook:'Stripe signed webhook; frontend থেকে call নয়'},
 WhatsAppConnectController:{connect:'WhatsApp link/prefilled START message URL'},
 WhatsAppWebhookController:{verifyWebhook:'Meta webhook subscription verification',receiveWebhook:'Meta signed incoming events'},
 WhatsAppController:{test:'Operational WhatsApp test; সাধারণ user website feature নয়'},
 AppController:{getHello:'Backend root response'},
 HealthController:{live:'Process liveness',ready:'Backend readiness check; সব provider tested বোঝায় না'},
 LegalPagesController:{privacyPolicy:'Privacy policy HTML',terms:'Terms HTML',dataDeletion:'Data-deletion instructions HTML'},
};
for (const r of contract.routes) if(!purpose[r.controller]?.[r.handler]) throw new Error(`Missing purpose: ${r.controller}.${r.handler}`);
const groups=[
 ['website','Website: public/auth ও user API',new Set(['AuthController','ChatController','EngagementController','LifestyleController','TelegramConnectController','WhatsAppConnectController'])],
 ['admin','Admin dashboard API',new Set(['DashboardController','EngagementAdminController','LifestyleAdminController','PublishingAdminController'])],
 ['shared','Website listing + admin CRUD',new Set(['CompanionsController','CreditController','GiftController','SubscriptionController','UserController','PaymentController','NewsletterController','MediaStoryController'])],
 ['system','Mini App, media, webhook ও infrastructure',new Set(['StoryMediaController','TelegramStoryController','PublishingConsoleController','TelegramMiniAppController','TelegramWebhookController','WebhookController','WhatsAppWebhookController','WhatsAppController','AppController','HealthController','LegalPagesController'])],
];
const head=`# Meet Elysia — সম্পূর্ণ Frontend ও Admin API README

**তারিখ: ২৫ অক্টোবর ২০২৬ • Source-derived handover • ${contract.routes.length}টি route • ${contract.dtos.length}টি DTO class**

Frontend engineer-কে **এই একটি ফাইল** দিলেই website এবং admin dashboard-এর API mapping, flow, upload, DTO, access ও response mapping পড়তে পারবেন। এটি বর্তমান local backend source-এর contract; deployed server একই version চালাচ্ছে কি না rollout team যাচাই করবে। কোনো credentials এই ফাইলে নেই।

## পড়ার ক্রম

1. [Website ও dashboard page map](#screens)
2. [সব API কোন কাজ করে](#routes)
3. [Login, payment, chat ও implementation guide](#flows)
4. [Profile sync ও 24-hour media Story](#publishing)
5. [Routine, image library, daily content ও trial](#lifestyle)
6. [প্রতিটি API-এর exact input/response mapping](#exact)
7. [সব DTO field ও validation](#dto)

Base URL উদাহরণ: local \`http://localhost:8080/api/v1\`; project-এর দেওয়া deployed URL \`https://natalieapi.duckdns.org/api/v1\` (এই documentation task-এ live availability পরীক্ষা হয়নি)। Swagger \`/api/docs\`, deployment-এ enabled থাকতে হবে। Frontend-এর public ENV-তে শুধু API base ও প্রযোজ্য publishable payment key; server secrets নয়।

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
| WhatsApp | /whatsapp/connect/:companionId | Returned link খুলে user START পাঠাবে |
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

Admin overview data keys: \`totalUsers, totalSubscriptionPlans, activeSubscriptions, activeSubscribers, totalMessages, totalConversations, totalRevenue\`। Legacy \`totalSubscriptions\` = plan count, \`totalConversions\` = message count। এগুলো conversion-rate chart নয়। Revenue currency conversion করে না; mixed-currency financial chart অনুমান করবেন না।

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
`;
let md=head;
md+=`\n## Response data কোথা থেকে পড়বেন\n\nসব response-এ একই list shape ধরে frontend hook লিখবেন না। নিচে HTTP JSON response-কে \`result\` বলা হয়েছে।\n\n| API | UI data path | Pagination/নোট |\n|---|---|---|\n| GET /companions, /subscription, /user, /newsletter | result.data = array | result.meta.page/limit/total |\n| GET /credits/packages, /gifts | result.data = array | Collection-এর actual fields অনুসরণ করুন |\n| GET /chat/:companionId/messages | result.data.messages | result.data.total/page/limit |\n| POST /chat/:companionId/messages | result.data.response, .message_type, .media | Saved row আলাদা result.data.message |\n| POST /lifestyle/companions/:companionId/photo | result.data.response, result.data.aiPayload.media.url | এটি saved ChatMessage; সাধারণ chat POST-এর মতো .media সরাসরি নয় |\n| GET /lifestyle/inbox | result.data = delivery array | item.kind অনুযায়ী item.content.text বা item.content.photo.url |\n| GET /lifestyle/allowances | result.data.policy, .usage, .periodStart, .periodEnd | Trial/included quota credits থেকে আলাদা |\n| GET /lifestyle/preference | result.data object অথবা null | null = preference এখনও save হয়নি |\n| GET /media-stories/summary | result.data = array | companionId, count, latestPublishedAt, expiresAt |\n| GET /media-stories/companions/:companionId | result.data.stories | .companion, .serverTime, .hasActiveStory; signed mediaPath |\n| GET /dashboard/overview | result.data = metrics object | Time-series graph data নয় |\n| GET /relationships, /notifications, /credits/ledger | result.data = array | PageDto; সবগুলোতে total/meta নেই |\n| GET .../lifestyle/photos, /daily-content, /deliveries | result.data = array | page query, fixed 50; total count নেই |\n\n**Trial UI caveat:** current Telegram Mini App status code totalCredits<=0 দেখে credits_required দেয়; নতুন zero-credit trial allowance সেখানে পৃথকভাবে বিবেচিত হয় না। Trial launch-এর আগে backend Mini App state integration ঠিক করতে হবে। Website-এ /lifestyle/allowances-এর policy/usage ব্যবহার করুন; zero wallet মানেই trial reply বন্ধ নয়।\n\n**Request retry:** chat-এর optional requestId এবং library-এর required requestId একই action retry-তে reuse করুন। Payment, gift, broadcast বা অন্য mutation-এ এই protection আছে ধরে automatic retry চালাবেন না।\n`;
const cell=s=>s.replaceAll('|','\\|').replace(/\s+/g,' ');
for(const [id,label,set] of groups){
 md+=`\n### ${label}\n\n| Method | Path | কাজ | Controller access |\n|---|---|---|---|\n`;
 for(const r of contract.routes.filter(r=>set.has(r.controller)))md+=`| ${r.method} | \`${r.path}\` | ${purpose[r.controller][r.handler]} | ${cell(r.guards.join('; ')||'JWT guard নেই; বিশেষ validation/নিচের নোট দেখুন')} |\n`;
}
let flow=read('docs/frontend-handoff/frontend-integration-bn.md');
flow=flow.slice(flow.indexOf('## ২. API connection'));
flow=flow.replace('বর্তমান chat service request-এর `type` দেখে text-এর জন্য `message` cost এবং voice-এর জন্য `voice` cost charge করে। AI image output হলেই আলাদা `photo` cost charge হয় না; `photo` cost উপরের gallery-view endpoint-এ ব্যবহৃত হয়। Pricing UI-তে এই পার্থক্য রাখুন।','`AI_RESPONSE_BILLING_ENABLED=false` হলে legacy type-based charge থাকে। Flag=true হলে actual reply type অনুযায়ী image/voice/text ও incoming transcription units charge হয়; নতুন AI contract দরকার। নিচের lifestyle অংশের billing নিয়ম অনুসরণ করুন।');
flow=flow.replace('Website admin profile image update Telegram bot-এর BotFather picture/name নিজে বদলায় না। Bot branding আলাদা configuration।','Website profile image/name update configured Telegram profile-sync queue-তে যায়; about/description-এর publishing API আছে। Feature flag/token mapping ও sync status যাচাই করুন। Bot username edit এই API-তে নেই।');
flow=flow.replaceAll('message/photo/voice/low_credit_threshold','message/photo/voice/transcription/low_credit_threshold');
flow=flow.replace('`message`, `photo`, `voice`, `low_credit_threshold`','`message`, `photo`, `voice`, `transcription`, `low_credit_threshold`');
flow=flow.replace('{"message":"Hi, how are you today?","type":"text"}','{"message":"Hi, how are you today?","type":"text","requestId":"11111111-1111-4111-8111-111111111111"}');
flow=flow.replace('## নতুন publishing feature', '## Publishing integration');
md+='\n<a id="flows"></a>\n# Implementation flow guide\n\n'+flow;
let publishing=read('docs/frontend-handoff/companion-publishing-bn.md');
publishing=publishing.replace('এই workspace-এর database-এ নতুন migration apply করা হয়েছে।','Target deployment-এ publishing ও lifestyle migrations আছে কি না deployment team যাচাই করবে; এই README live migration claim করে না।');
publishing=publishing.replace('এই workspace-এর `.env`-এ settings এবং নতুন random signing secret রাখা হয়েছে।','Deployment environment-এ নিচের settings এবং signing secret backend engineer দেবেন।');
md+='\n<a id="publishing"></a>\n'+publishing;
let lifestyle=read('docs/README-lifestyle-handoff-bn.md');
lifestyle=lifestyle.replace('পড়ুন [AI contract](./ai-lifestyle-contract.md)।','AI contract appendix নিচে দেওয়া আছে।');
md+='\n<a id="lifestyle"></a>\n'+lifestyle;
md+='\n# External AI contract appendix\n\n'+read('docs/ai-lifestyle-contract.md');
md+='\n<a id="exact"></a>\n# Exact API request ও response mapping\n\nপ্রতিটি route-এর input decorator, DTO এবং controller response mapping নিচে। Body DTO-এর সব field পরের appendix-এ। Controller source **response example নয়**; service result variable ও nullability নির্দিষ্ট flow অনুযায়ী দেখুন। Global JSON envelope আগের section-এর মতো। GET raw HTML/media এই envelope নয়।\n';
for(const r of contract.routes){
 md+=`\n## ${r.method} ${r.path}\n\n**কাজ:** ${purpose[r.controller][r.handler]}\n\nSource: \`${r.file}:${r.line}\`\n\nAccess: \`${r.guards.join('; ')||'Controller JWT guard নেই; service/provider validation প্রযোজ্য'}\`\n\nRequest parameters ও DTO:\n\n\`\`\`typescript\n${r.parameters.join('\n')||'// No explicit parameters'}\n\`\`\`\n\nUpload/status/validation metadata:\n\n\`\`\`typescript\n${r.decorators.join('\n')}\n\`\`\`\n\nController response mapping:\n\n\`\`\`typescript\n${r.handlerSource}\n\`\`\`\n`;
}
md+='\n<a id="dto"></a>\n# সব DTO field, nested object ও validation\n\n`IsOptional` optional; `PartialType(Base)` base fields optional করে। Nested object `Type`/`ValidateNested` দেখে form বানান। `ApiProperty` example production default নয়। `messageLimit` legacy field; creditAllowance/policy আলাদা। Body-এর extra field ValidationPipe whitelist-এ বাদ যেতে পারে—unsupported admin permission field পাঠাবেন না।\n';
for(const d of contract.dtos)md+=`\n## ${d.name}\n\nSource: \`${d.file}\`\n\n\`\`\`typescript\n${d.source}\n\`\`\`\n`;
md+='\n# Response enum values\n\nএগুলো database/response enum; সব value সব request DTO-তে allowed নয়। যেমন ChatMessageType-এ photo থাকলেও SendMessageDto.type কেবল text/voice নেয়।\n\n```prisma\n'+read('prisma/schema/enum.prisma')+'\n```\n';
md+='\n# Documentation refresh\n\nBackend route/DTO পরিবর্তন হলে repository root থেকে:\n\n```powershell\nnode scripts/export-frontend-contract.cjs\nnode scripts/build-full-frontend-readme.cjs\n```\n\nGenerator প্রতিটি endpoint-এর purpose mapping ও code-fence balance যাচাই করে। নতুন endpoint হলে generator-এর purpose map-ও হালনাগাদ করুন। Service-এর behavior বদলালে flow guide-ও review করতে হবে; শুধু route scan business logic যাচাই করে না।\n';
// This artifact is standalone. Remove local supporting-document dependencies.
md=md.replace(/\[([^\]]+)\]\((?:\.\/|\.\.\/)?(?:frontend-integration-bn\.md|companion-publishing-bn\.md|frontend-handoff\/api-reference-bn\.md)\)/g,'$1 (এই README-তেই সংশ্লিষ্ট section আছে)');
const out='docs/frontend-handoff/README-FRONTEND-FULL-BN.md';
const fences=md.split('\n').filter(line=>line.startsWith(String.fromCharCode(96).repeat(3))).length;
if(fences%2!==0)throw new Error(`Unbalanced code fences: ${fences}`);
for(const r of contract.routes)if(!md.includes(`## ${r.method} ${r.path}\n`))throw new Error(`Missing route detail ${r.path}`);
fs.writeFileSync(path.join(root,out),md.replace(/\r/g,'').trim()+'\n');
const assigned=contract.routes.filter(r=>groups.some(([, ,set])=>set.has(r.controller)));
if(assigned.length!==contract.routes.length)throw new Error('Route classification incomplete');
console.log(JSON.stringify({file:out,routes:contract.routes.length,dtos:contract.dtos.length,bytes:Buffer.byteLength(md)}));
