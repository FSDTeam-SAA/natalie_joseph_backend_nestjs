# Meet Elysia — Profile sync ও ২৪ ঘণ্টার Story

## এখন যা আছে

Admin থেকে companion-এর নাম বা profile photo পরিবর্তন করলে website save হওয়ার পরে Telegram update queue হবে। About ও Description নতুন publishing API দিয়ে পরিবর্তন করা যায়। Bot username পরিবর্তন এই feature-এর অংশ নয়। ছবি Cloudinary-তে এই backend দিয়ে upload করতে হবে; worker সেটিকে JPEG করে Telegram-এ পাঠায়। Client-এর OTP লাগে না।

Photo/video Story প্রকাশের সময় থেকে ঠিক ২৪ ঘণ্টা website API ও Telegram Mini App-এ দেখা যাবে। এটি Telegram-এর native Story bar নয়। Story দেখার জন্য approved adult account এবং Telegram থেকে দেখলে account connection প্রয়োজন; Story দেখায় subscription credit কাটা হয় না। Chat-এর আগের subscription/credit নিয়ম অপরিবর্তিত।

## প্রথমবার পরীক্ষা

Telegram chat-এর Menu-তে **Stories**, **Login**, **Start** যোগ করা হয়েছে। User Menu → Stories → View Stories চাপবে; command লিখতে হবে না। Bot বা account বদলালে project folder থেকে `node scripts/telegram.cjs menu` চালিয়ে পাঁচটি bot-এর menu configure ও verify করুন। শুধু একটি bot-এর জন্য `node scripts/telegram.cjs menu ELENA`। এটি webhook পরিবর্তন বা user-কে message পাঠায় না। Existing custom commands রাখা হয়; private-chat command menu ব্যবহার করে। আগে থেকে নির্দিষ্ট chat/language-এর আলাদা override থাকলে সেটি Telegram-এ অগ্রাধিকার পেতে পারে। Menu পুরোনো দেখালে chat বন্ধ করে আবার খুলুন।

1. Backend restart করুন। এই workspace-এর database-এ নতুন migration apply করা হয়েছে।
2. Browser-এ `http://localhost:8080/api/v1/publishing/admin` খুলুন। Existing **admin** account দিয়ে login করুন।
3. Elena বা অন্য companion নির্বাচন করুন। Display name, About, Description লিখে **Save profile & queue sync** চাপুন।
4. **Upload profile photo** দিয়ে ছবি দিন। Status প্রথমে `pending`, পরে `processing`, সফল হলে `synced` হবে। Worker প্রতি ১৫ সেকেন্ডে queue পরীক্ষা করে। পাঁচটি bot থাকলে completion-এ আরও সময় লাগতে পারে।
5. Telegram-এ profile খুলে নাম, ছবি ও পরিচিতি যাচাই করুন। Cache থাকলে profile আবার খুলুন। Failure হলে status-এর কারণ দেখুন, configuration ঠিক করে **Retry Telegram sync** চাপুন। Automatic সর্বোচ্চ তিনবার চেষ্টা হয়।
6. **Publish a story** থেকে JPEG/PNG/WebP বা MP4 এবং caption দিন। Default limit ১০ MB; MP4-এর browser playback codec-compatible হতে হবে (H.264/AAC ব্যবহার করুন)।
7. Connected Telegram account দিয়ে companion-কে `/stories` পাঠান। **View … Stories** চাপলে Telegram-এর ভিতরে viewer খুলবে। `/start`-এর welcome message-এও button আছে। Unconnected user-কে আগে login করতে হবে।
8. Next/Previous, video playback, caption এবং Refresh পরীক্ষা করুন। Admin থেকে **Remove story** করলে পরের request-এ সেটি unavailable হবে। মেয়াদ শেষ হলে নতুন feed/media request-এও unavailable হবে। ইতিমধ্যে download করা ছবি/video ফিরিয়ে মুছে দেওয়া যায় না।

Publish করলে সব user-কে unsolicited message পাঠানো হয় না। Story viewer খোলা অবস্থায় expiry পরীক্ষা করে; signed media link পাঁচ মিনিটের, প্রয়োজন হলে Refresh বা viewer পুনরায় খুলুন।

## ENV ও deployment

এই workspace-এর `.env`-এ settings এবং নতুন random signing secret রাখা হয়েছে। Secret অন্য কারও সঙ্গে share করবেন না। VPS-এর সব instance-এ একই persistent secret রাখতে হবে।

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
