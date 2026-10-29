# API cleanup — ২৯ অক্টোবর ২০২৬

User-এর Telegram-only messaging নির্দেশ অনুযায়ী WhatsApp integration সরানো হয়েছে। Website ও admin-এর shared backend রাখা হয়েছে। নতুন tracking তালিকা/Figma audit সরাসরি পাওয়া যায়নি; তাই এই নথি সেগুলোর পূর্ণ audit দাবি করে না।

## সরানো হয়েছে

| পুরোনো API | কারণ | Frontend পরিবর্তন |
|---|---|---|
| POST `/api/v1/credits/purchase` | POST `/payment/credits`-এর একই service, packageId ও response; duplicate checkout entry point | POST `/api/v1/payment/credits` ব্যবহার করতে হবে |
| POST `/api/v1/whatsapp/test` | Production user feature নয়; arbitrary outbound test endpoint | কোনো replacement public API নেই; WhatsApp messaging বাদ |

Unused purchase DTO, CreditController-এর payment dependency, test controller এবং test-template helper সরানো হয়েছে। Database tables, migrations, historical payments এবং credit ledger পরিবর্তন করা হয়নি।

WhatsApp connect API এবং GET/POST webhook, module/services, companion-এর WhatsApp DTO fields ও public profile fields সরানো হয়েছে। Local `.env` থেকে WhatsApp-specific settings সরানো হয়েছে; secrets output করা হয়নি।

পুরোনো WhatsApp database tables/columns রেখে দেওয়া হয়েছে যাতে historical data না হারায়। `ChatMessage.whatsappMessageKey` নামের legacy column Telegram, website ও library request-এর idempotency-তেও ব্যবহৃত হয়—এটি মুছলে duplicate billing prevention ভাঙবে, তাই রাখা হয়েছে।

## রাখা হয়েছে

- Authentication, profile, companions, subscription, wallet, payment ও payment webhook: website access এবং checkout-এর জন্য।
- Telegram login/connect, webhook, stories ও media: bot এবং Mini App-এর জন্য।
- Routine, library, daily content ও allowances: client-এর daily-life consistency, predetermined photo এবং trial requirements-এর জন্য।
- Dashboard, content management, profile sync, delivery logs: admin management এবং troubleshooting-এর জন্য।
- Health/legal/media endpoints: UI page না থাকলেও deployment, account policies ও image/video rendering-এর প্রয়োজন হয়।
- Gifts, newsletter, relationships, human takeover : বর্তমান implemented features; এগুলো বাদ দেওয়ার scope evidence এখনো নেই। Tracking তালিকার সঙ্গে মিলিয়ে সিদ্ধান্ত বাকি।

Text life-event stories, 24-hour media stories এবং subscription daily delivery আলাদা feature; একই ধরনের নাম বলে একটিকে duplicate ধরে সরানো হয়নি।

## Rollout

বর্তমান frontend-এর কোনো consumer পুরোনো `/credits/purchase` ব্যবহার করলে backend deploy-এর আগে `/payment/credits`-এ বদলাতে হবে। সরানো endpoints নতুন deploy-এ আর পাওয়া যাবে না। External consumers বা production traffic এই local inspection-এ পরীক্ষা হয়নি।

বর্তমান source inventory: **118 routes, 61 DTO classes**। পূর্ণ frontend mapping: [Frontend README](frontend-handoff/README-FRONTEND-FULL-BN.md)। Gifts, newsletter এবং human takeover আলাদা website/admin features; Telegram-only channel নির্দেশ থেকে এগুলো বাতিল ধরে নেওয়া হয়নি।
