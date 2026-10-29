# API cleanup — ২৯ অক্টোবর ২০২৬

এই ধাপে source যাচাই করে duplicate ও operational-test API সরানো হয়েছে। এটি সম্পূর্ণ client/Figma scope approval নয়: কথোপকথনে উল্লেখ করা নতুন tracking তালিকা ও Figma review এই workspace-এ পাওয়া যায়নি।

## সরানো হয়েছে

| পুরোনো API | কারণ | Frontend পরিবর্তন |
|---|---|---|
| POST `/api/v1/credits/purchase` | POST `/payment/credits`-এর একই service, packageId ও response; duplicate checkout entry point | POST `/api/v1/payment/credits` ব্যবহার করতে হবে |
| POST `/api/v1/whatsapp/test` | Production user feature নয়; arbitrary outbound test endpoint | কোনো replacement public API নেই; বাস্তব connect/webhook flow বহাল |

Unused purchase DTO, CreditController-এর payment dependency, test controller এবং test-template helper সরানো হয়েছে। Database tables, migrations, historical payments এবং credit ledger পরিবর্তন করা হয়নি।

## রাখা হয়েছে

- Authentication, profile, companions, subscription, wallet, payment ও payment webhook: website access এবং checkout-এর জন্য।
- Telegram login/connect, webhook, stories ও media: bot এবং Mini App-এর জন্য।
- Routine, library, daily content ও allowances: client-এর daily-life consistency, predetermined photo এবং trial requirements-এর জন্য।
- Dashboard, content management, profile sync, delivery logs: admin management এবং troubleshooting-এর জন্য।
- Health/legal/media endpoints: UI page না থাকলেও deployment, account policies ও image/video rendering-এর প্রয়োজন হয়।
- Gifts, newsletter, relationships, human takeover এবং WhatsApp production integration: বর্তমান implemented features; এগুলো বাদ দেওয়ার scope evidence এখনো নেই। Tracking তালিকার সঙ্গে মিলিয়ে সিদ্ধান্ত বাকি।

Text life-event stories, 24-hour media stories এবং subscription daily delivery আলাদা feature; একই ধরনের নাম বলে একটিকে duplicate ধরে সরানো হয়নি।

## Rollout

বর্তমান frontend-এর কোনো consumer পুরোনো `/credits/purchase` ব্যবহার করলে backend deploy-এর আগে `/payment/credits`-এ বদলাতে হবে। সরানো endpoints নতুন deploy-এ আর পাওয়া যাবে না। External consumers বা production traffic এই local inspection-এ পরীক্ষা হয়নি।

বর্তমান source inventory: **120 routes, 61 DTO classes**। পূর্ণ frontend mapping: [Frontend README](frontend-handoff/README-FRONTEND-FULL-BN.md)। বাকি API feature removal-এর জন্য client-approved scope/আগের tracking তালিকা দরকার।
