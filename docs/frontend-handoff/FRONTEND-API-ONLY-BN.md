# Website ও Dashboard — Frontend API তালিকা

Swagger-এ এই API-গুলো দেখা যাবে। Internal webhook, Telegram Mini App implementation, health ও server HTML routes চালু আছে, কিন্তু frontend engineer-কে implement করতে হয় না বলে hidden। Telegram connect এবং signed media endpoint frontend-এর দরকার, তাই রাখা হয়েছে।

মোট 103টি frontend-visible route। Full request/response: [পূর্ণ README](README-FRONTEND-FULL-BN.md)।

| Method | API | Access | Handler |
|---|---|---|---|
| POST | /api/v1/auth/register | Public অথবা service-level validation | register |
| POST | /api/v1/auth/login | Public অথবা service-level validation | login |
| GET | /api/v1/auth/refresh | Public অথবা service-level validation | refreshToken |
| POST | /api/v1/auth/forgot-password | Public অথবা service-level validation | forgotPassword |
| POST | /api/v1/auth/verify-otp | Public অথবা service-level validation | verifyOtp |
| POST | /api/v1/auth/reset-password | Public অথবা service-level validation | resetPassword |
| POST | /api/v1/auth/change-password | UseGuards(AuthGuard('admin', 'user')) | changePassword |
| POST | /api/v1/auth/logout | UseGuards(AuthGuard('admin', 'user')) | logout |
| GET | /api/v1/chat/conversations | UseGuards(AuthGuard('user')) | getConversations |
| GET | /api/v1/chat/:companionId/messages | UseGuards(AuthGuard('user')) | getMessages |
| GET | /api/v1/chat/usage | UseGuards(AuthGuard('user')) | getUsage |
| POST | /api/v1/chat/:companionId/messages | UseGuards(AuthGuard('user')) | sendMessage |
| POST | /api/v1/companions | UseGuards(AuthGuard('admin')) | createCompanion |
| GET | /api/v1/companions | Public অথবা service-level validation | getAllCompanions |
| GET | /api/v1/companions/:id | Public অথবা service-level validation | getCompanionById |
| PUT | /api/v1/companions/:id | UseGuards(AuthGuard('admin')) | updateCompanion |
| PUT | /api/v1/companions/:id/profile-image | UseGuards(AuthGuard('admin')) | updateProfileImage |
| PUT | /api/v1/companions/:id/cover-image | UseGuards(AuthGuard('admin')) | updateCoverImage |
| POST | /api/v1/companions/:id/gallery | UseGuards(AuthGuard('admin')) | addGalleryImages |
| DELETE | /api/v1/companions/:id/gallery | UseGuards(AuthGuard('admin')) | removedOneGallaryImage |
| PUT | /api/v1/companions/:id/gallery | UseGuards(AuthGuard('admin')) | updateGalleryImages |
| DELETE | /api/v1/companions/:id | UseGuards(AuthGuard('admin')) | deleteCompanion |
| PUT | /api/v1/companions/:id/voice | UseGuards(AuthGuard('admin')) | updateVoice |
| POST | /api/v1/credits/packages | UseGuards(AuthGuard('admin')) | createPackage |
| GET | /api/v1/credits/packages | Public অথবা service-level validation | getPackages |
| PATCH | /api/v1/credits/packages/:id | UseGuards(AuthGuard('admin')) | updatePackage |
| DELETE | /api/v1/credits/packages/:id | UseGuards(AuthGuard('admin')) | deactivatePackage |
| GET | /api/v1/credits/wallet | UseGuards(AuthGuard('user')) | getWallet |
| GET | /api/v1/dashboard/overview | UseGuards(AuthGuard('admin')) | dashboardOverview |
| GET | /api/v1/relationships | UseGuards(AuthGuard('user', 'admin')) | relationships |
| PATCH | /api/v1/relationships/:companionId | UseGuards(AuthGuard('user', 'admin')) | relationship |
| GET | /api/v1/companions/:companionId/stories | UseGuards(AuthGuard('user', 'admin')) | stories |
| POST | /api/v1/companions/:companionId/photos/view | UseGuards(AuthGuard('user', 'admin')) | photo |
| GET | /api/v1/photos/history | UseGuards(AuthGuard('user', 'admin')) | photos |
| GET | /api/v1/credits/ledger | UseGuards(AuthGuard('user', 'admin')) | ledger |
| GET | /api/v1/credits/costs | UseGuards(AuthGuard('user', 'admin')) | costs |
| GET | /api/v1/notifications | UseGuards(AuthGuard('user', 'admin')) | notifications |
| PATCH | /api/v1/notifications/:id/read | UseGuards(AuthGuard('user', 'admin')) | read |
| PUT | /api/v1/admin/credit-costs/:action | UseGuards(AuthGuard('admin')) | cost |
| PUT | /api/v1/admin/companions/:companionId/stories | UseGuards(AuthGuard('admin')) | story |
| GET | /api/v1/admin/companions/:companionId/stories | UseGuards(AuthGuard('admin')) | stories |
| GET | /api/v1/admin/conversations | UseGuards(AuthGuard('admin')) | conversations |
| GET | /api/v1/admin/conversations/:id | UseGuards(AuthGuard('admin')) | conversation |
| PATCH | /api/v1/admin/conversations/:id/mode | UseGuards(AuthGuard('admin')) | mode |
| POST | /api/v1/admin/conversations/:id/replies | UseGuards(AuthGuard('admin')) | reply |
| GET | /api/v1/admin/users/:id/details | UseGuards(AuthGuard('admin')) | user |
| GET | /api/v1/admin/users/:id/ledger | UseGuards(AuthGuard('admin')) | ledger |
| POST | /api/v1/admin/notifications | UseGuards(AuthGuard('admin')) | notification |
| POST | /api/v1/gifts | UseGuards(AuthGuard('admin')) | createGift |
| GET | /api/v1/gifts | Public অথবা service-level validation | getGifts |
| PATCH | /api/v1/gifts/:id | UseGuards(AuthGuard('admin')) | updateGift |
| DELETE | /api/v1/gifts/:id | UseGuards(AuthGuard('admin')) | deactivateGift |
| POST | /api/v1/gifts/:giftId/send | UseGuards(AuthGuard('user')) | sendGift |
| GET | /api/v1/admin/companions/:companionId/lifestyle/routine | UseGuards(AuthGuard('admin')) | routine |
| PUT | /api/v1/admin/companions/:companionId/lifestyle/routine | UseGuards(AuthGuard('admin')) | saveRoutine |
| GET | /api/v1/admin/companions/:companionId/lifestyle/context | UseGuards(AuthGuard('admin')) | context |
| GET | /api/v1/admin/companions/:companionId/lifestyle/photos | UseGuards(AuthGuard('admin')) | photos |
| POST | /api/v1/admin/companions/:companionId/lifestyle/photos | UseGuards(AuthGuard('admin')) | upload |
| PATCH | /api/v1/admin/companions/:companionId/lifestyle/photos/:photoId | UseGuards(AuthGuard('admin')) | approve |
| GET | /api/v1/admin/companions/:companionId/lifestyle/daily-content | UseGuards(AuthGuard('admin')) | daily |
| PUT | /api/v1/admin/companions/:companionId/lifestyle/daily-content | UseGuards(AuthGuard('admin')) | save |
| POST | /api/v1/admin/companions/:companionId/lifestyle/daily-content/:contentId/unpublish | UseGuards(AuthGuard('admin')) | unpublish |
| GET | /api/v1/admin/companions/:companionId/lifestyle/deliveries | UseGuards(AuthGuard('admin')) | deliveries |
| GET | /api/v1/lifestyle/preference | UseGuards(AuthGuard('user')) | preference |
| PUT | /api/v1/lifestyle/preference | UseGuards(AuthGuard('user')) | save |
| GET | /api/v1/lifestyle/allowances | UseGuards(AuthGuard('user')) | allowances |
| POST | /api/v1/lifestyle/companions/:companionId/photo | UseGuards(AuthGuard('user')) | photo |
| GET | /api/v1/lifestyle/inbox | UseGuards(AuthGuard('user')) | inbox |
| POST | /api/v1/newsletter | Public অথবা service-level validation | sendMail |
| POST | /api/v1/newsletter/broadcast | UseGuards(AuthGuard('admin')) | broadcastNewsletter |
| GET | /api/v1/newsletter | Public অথবা service-level validation | getAllNewsletter |
| GET | /api/v1/newsletter/:id | Public অথবা service-level validation | getNewsletterById |
| GET | /api/v1/payment/subscription/status | UseGuards(AuthGuard('user', 'admin')) | status |
| POST | /api/v1/payment/subscription/sync | UseGuards(AuthGuard('user', 'admin')) | sync |
| POST | /api/v1/payment/billing-portal | UseGuards(AuthGuard('user', 'admin')) | portal |
| POST | /api/v1/payment/subscription/cancel | UseGuards(AuthGuard('user', 'admin')) | cancel |
| POST | /api/v1/payment/subscription/:subscriptionId/upgrade | UseGuards(AuthGuard('user', 'admin')) | upgrade |
| POST | /api/v1/payment/subscription/:subscriptionId | UseGuards(AuthGuard('admin', 'user')) | paySubscriber |
| POST | /api/v1/payment/credits | UseGuards(AuthGuard('user')) | buyCredits |
| GET | /api/v1/admin/companions/:companionId/telegram-profile | UseGuards(AuthGuard('admin')) | status |
| PUT | /api/v1/admin/companions/:companionId/telegram-profile | UseGuards(AuthGuard('admin')) | profile |
| POST | /api/v1/admin/companions/:companionId/telegram-profile/retry | UseGuards(AuthGuard('admin')) | retry |
| GET | /api/v1/admin/companions/:companionId/media-stories | UseGuards(AuthGuard('admin')) | list |
| POST | /api/v1/admin/companions/:companionId/media-stories | UseGuards(AuthGuard('admin')) | publish |
| DELETE | /api/v1/admin/companions/:companionId/media-stories/:storyId | UseGuards(AuthGuard('admin')) | remove |
| GET | /api/v1/media-stories/summary | UseGuards(AuthGuard('user', 'admin')) | summary |
| GET | /api/v1/media-stories/companions/:companionId | UseGuards(AuthGuard('user', 'admin')) | feed |
| GET | /api/v1/media-stories/:storyId/media | Public অথবা service-level validation | media |
| POST | /api/v1/subscription | UseGuards(AuthGuard('admin')) | createSubscription |
| GET | /api/v1/subscription | Public অথবা service-level validation | getAllSubscription |
| GET | /api/v1/subscription/:id | Public অথবা service-level validation | getSubscriptionById |
| PUT | /api/v1/subscription/:id | UseGuards(AuthGuard('admin')) | updateSubscription |
| DELETE | /api/v1/subscription/:id | UseGuards(AuthGuard('admin')) | deleteSubscription |
| GET | /api/v1/telegram/status/:companionId | UseGuards(AuthGuard('user')) | status |
| POST | /api/v1/telegram/connect/:companionId | UseGuards(AuthGuard('user')) | connect |
| POST | /api/v1/user | Public অথবা service-level validation | createUser |
| GET | /api/v1/user | UseGuards(AuthGuard('admin')) | getAllUser |
| GET | /api/v1/user//overview | UseGuards(AuthGuard('admin')) | getAllUserOverview |
| GET | /api/v1/user/my-profile | UseGuards(AuthGuard('user', 'admin')) | myProfile |
| PUT | /api/v1/user/my-profile | UseGuards(AuthGuard('user', 'admin')) | UpdateMyProfile |
| GET | /api/v1/user/:id | UseGuards(AuthGuard('admin')) | getUserById |
| PUT | /api/v1/user/:id | UseGuards(AuthGuard('admin')) | updateUser |
| DELETE | /api/v1/user/:id | UseGuards(AuthGuard('admin')) | deleteUser |
