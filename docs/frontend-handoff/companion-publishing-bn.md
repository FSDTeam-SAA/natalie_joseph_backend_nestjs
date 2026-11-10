# Telegram profile sync and 24-hour media Stories

English handoff. These publishing features are separate from approved library delivery and scheduled daily subscription content.

## Behavior

Saving a companion name/profile photo updates the website first and queues Telegram synchronization when enabled/configured. Publishing APIs also manage About and Description. Bot username editing is not supported. Upload the profile photo through the backend/Cloudinary flow; the worker converts it to JPEG for Telegram. No client OTP is needed.

Media Stories remain available for 24 hours after publication through website APIs and the Telegram Mini App viewer. This is not Telegram's native Story bar. An approved adult account is required, with account linking for Telegram. Viewing does not consume chat/subscription credits.

## Initial acceptance flow

1. Review/apply required migrations for the target environment, then restart the intended backend instance.
2. If the optional publishing console is enabled, open `http://localhost:8080/api/v1/publishing/admin` and log in with an existing admin account.
3. Select a companion, edit display name/About/Description and choose **Save profile & queue sync**.
4. Upload a profile image. Status moves through pending/processing to synced or failed. The worker checks approximately every 15 seconds; multiple bots may take longer. Check Telegram and refresh cached profiles. Correct configuration before retrying. Automatic attempts are bounded at three.
5. Publish JPEG/PNG/WebP or MP4 media with an optional caption. Default upload limit is 10 MB; H.264/AAC is appropriate for browser MP4 playback.
6. A connected Telegram user can use Menu > Stories or `/stories` and choose the viewer. Next/previous, captions, video playback and refresh need device testing.
7. Removing/expiring a Story makes subsequent feed/media requests unavailable. Already downloaded content cannot be recalled. Signed media links last five minutes; refresh/reopen the viewer when necessary.

Publishing does not broadcast unsolicited messages to every user. Menu setup commands are deliberate administrative actions: `node scripts/telegram.cjs menu` configures five bots, or append `ELENA` for one bot. This menu command does not change webhooks or send user messages; existing more-specific Telegram menu overrides may take precedence.

## Configuration

```dotenv
TELEGRAM_PROFILE_SYNC_ENABLED=true
COMPANION_MEDIA_STORIES_ENABLED=true
PUBLISHING_ADMIN_CONSOLE_ENABLED=true
STORY_MAX_UPLOAD_MB=10
STORY_MEDIA_SIGNING_SECRET=<strong-persistent-random-secret>
TELEGRAM_PUBLIC_BASE_URL=https://your-backend-domain.example
```

Keep signing secrets persistent and consistent across replicas. Existing bot-token/companion-ID mappings and Cloudinary credentials are required. A changing tunnel URL requires deliberate public-base/webhook updates and restart; use stable HTTPS origins in production. Registration/payment website URL settings remain separate.

## API map

Prefix routes with `/api/v1`; normal payloads are in `data`. Admin mutations require an admin Bearer token.

| Method | Path | Use |
|---|---|---|
| GET | `/admin/companions/:companionId/telegram-profile` | Desired fields, status and safe lastError |
| PUT | `/admin/companions/:companionId/telegram-profile` | displayName (64), about (120), description (512 characters) |
| POST | `/admin/companions/:companionId/telegram-profile/retry` | Requeue eligible profile sync |
| PUT | `/companions/:id/profile-image` | Multipart profileImage; website save plus configured sync |
| GET / POST | `/admin/companions/:companionId/media-stories` | Recent metadata or multipart media plus caption (2048 characters) |
| DELETE | `/admin/companions/:companionId/media-stories/:storyId` | Remove a Story and clear stored media bytes |
| GET | `/media-stories/summary` | Authenticated active counts and expiry for avatar rings |
| GET | `/media-stories/companions/:companionId` | Authenticated active feed with signed mediaPath |
| GET | `/media-stories/:storyId/media?ticket=...` | Signed media bytes, including video Range support |
| GET | `/telegram/stories?companionId=...` | Mini App viewer shell |
| POST | `/telegram/stories/:companionId/feed` | Signed initData/account-validated feed |

A mediaPath already begins with `/api/v1`; prepend only the backend origin. Use serverTime/expiresAt for countdown and refresh at expiry. Public companion data may expose display fields; private queue status remains in admin APIs. A failed Telegram sync does not roll back saved website fields.

## Operations and limits

Use the reviewed deployment workflow: install dependencies, generate Prisma, review/apply pending migrations, build, then start under the deployment process manager. The optional test console can be disabled after dashboard integration while keeping role-protected APIs available.

Uploads are memory-buffered and Story bytes use the database. Higher-volume media requires an appropriate object-storage/streaming design. Expired bytes are cleaned periodically (approximately every ten minutes), with metadata retained. Basic signatures are checked; malware scanning/transcoding are not included.

Automated tests cover expiry, access, signed links, leases/retries, ranges and browser script parsing. Live profile mutation and real-account Story publishing were not performed as part of those tests. Exact website/Figma integration and device acceptance remain separate work.
