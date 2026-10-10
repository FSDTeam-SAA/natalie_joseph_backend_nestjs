# Meet Elysia — সম্পূর্ণ API ও request field reference

তারিখ: ১০ অক্টোবর ২০২৬। Controller ও DTO থেকে সরাসরি তৈরি; live API test নয়। মূল নির্দেশনা পড়ুন: [বাংলা integration guide](./frontend-integration-bn.md)।

মোট **95টি route**, **52টি DTO class**। কোনো real token/password/env value অন্তর্ভুক্ত নেই।

## সব endpoint এক নজরে

| Method | সম্পূর্ণ path | Controller-এ access | Handler |
|---|---|---|---|
| POST | `/api/v1/auth/register` | JWT guard নেই; নিচের service/webhook নিয়ম দেখুন | register |
| POST | `/api/v1/auth/login` | JWT guard নেই; নিচের service/webhook নিয়ম দেখুন | login |
| GET | `/api/v1/auth/refresh` | JWT guard নেই; নিচের service/webhook নিয়ম দেখুন | refreshToken |
| POST | `/api/v1/auth/forgot-password` | JWT guard নেই; নিচের service/webhook নিয়ম দেখুন | forgotPassword |
| POST | `/api/v1/auth/verify-otp` | JWT guard নেই; নিচের service/webhook নিয়ম দেখুন | verifyOtp |
| POST | `/api/v1/auth/reset-password` | JWT guard নেই; নিচের service/webhook নিয়ম দেখুন | resetPassword |
| POST | `/api/v1/auth/change-password` | UseGuards(AuthGuard('admin', 'user')) | changePassword |
| POST | `/api/v1/auth/logout` | UseGuards(AuthGuard('admin', 'user')) | logout |
| GET | `/api/v1/chat/conversations` | UseGuards(AuthGuard('user')) | getConversations |
| GET | `/api/v1/chat/:companionId/messages` | UseGuards(AuthGuard('user')) | getMessages |
| GET | `/api/v1/chat/usage` | UseGuards(AuthGuard('user')) | getUsage |
| POST | `/api/v1/chat/:companionId/messages` | UseGuards(AuthGuard('user')) | sendMessage |
| POST | `/api/v1/companions` | UseGuards(AuthGuard('admin')) | createCompanion |
| GET | `/api/v1/companions` | JWT guard নেই; নিচের service/webhook নিয়ম দেখুন | getAllCompanions |
| GET | `/api/v1/companions/:id` | JWT guard নেই; নিচের service/webhook নিয়ম দেখুন | getCompanionById |
| PUT | `/api/v1/companions/:id` | UseGuards(AuthGuard('admin')) | updateCompanion |
| PUT | `/api/v1/companions/:id/profile-image` | UseGuards(AuthGuard('admin')) | updateProfileImage |
| PUT | `/api/v1/companions/:id/cover-image` | UseGuards(AuthGuard('admin')) | updateCoverImage |
| POST | `/api/v1/companions/:id/gallery` | UseGuards(AuthGuard('admin')) | addGalleryImages |
| PUT | `/api/v1/companions/:id/gallery` | UseGuards(AuthGuard('admin')) | updateGalleryImages |
| DELETE | `/api/v1/companions/:id` | UseGuards(AuthGuard('admin')) | deleteCompanion |
| PUT | `/api/v1/companions/:id/voice` | UseGuards(AuthGuard('admin')) | updateVoice |
| POST | `/api/v1/credits/packages` | UseGuards(AuthGuard('admin')) | createPackage |
| GET | `/api/v1/credits/packages` | JWT guard নেই; নিচের service/webhook নিয়ম দেখুন | getPackages |
| PATCH | `/api/v1/credits/packages/:id` | UseGuards(AuthGuard('admin')) | updatePackage |
| DELETE | `/api/v1/credits/packages/:id` | UseGuards(AuthGuard('admin')) | deactivatePackage |
| POST | `/api/v1/credits/purchase` | UseGuards(AuthGuard('user')) | purchase |
| GET | `/api/v1/credits/wallet` | UseGuards(AuthGuard('user')) | getWallet |
| GET | `/api/v1/dashboard/overview` | UseGuards(AuthGuard('admin')) | dashboardOverview |
| GET | `/api/v1/relationships` | UseGuards(AuthGuard('user', 'admin')) | relationships |
| PATCH | `/api/v1/relationships/:companionId` | UseGuards(AuthGuard('user', 'admin')) | relationship |
| GET | `/api/v1/companions/:companionId/stories` | UseGuards(AuthGuard('user', 'admin')) | stories |
| POST | `/api/v1/companions/:companionId/photos/view` | UseGuards(AuthGuard('user', 'admin')) | photo |
| GET | `/api/v1/photos/history` | UseGuards(AuthGuard('user', 'admin')) | photos |
| GET | `/api/v1/credits/ledger` | UseGuards(AuthGuard('user', 'admin')) | ledger |
| GET | `/api/v1/credits/costs` | UseGuards(AuthGuard('user', 'admin')) | costs |
| GET | `/api/v1/notifications` | UseGuards(AuthGuard('user', 'admin')) | notifications |
| PATCH | `/api/v1/notifications/:id/read` | UseGuards(AuthGuard('user', 'admin')) | read |
| PUT | `/api/v1/admin/credit-costs/:action` | UseGuards(AuthGuard('admin')) | cost |
| PUT | `/api/v1/admin/companions/:companionId/stories` | UseGuards(AuthGuard('admin')) | story |
| GET | `/api/v1/admin/companions/:companionId/stories` | UseGuards(AuthGuard('admin')) | stories |
| GET | `/api/v1/admin/conversations` | UseGuards(AuthGuard('admin')) | conversations |
| GET | `/api/v1/admin/conversations/:id` | UseGuards(AuthGuard('admin')) | conversation |
| PATCH | `/api/v1/admin/conversations/:id/mode` | UseGuards(AuthGuard('admin')) | mode |
| POST | `/api/v1/admin/conversations/:id/replies` | UseGuards(AuthGuard('admin')) | reply |
| GET | `/api/v1/admin/users/:id/details` | UseGuards(AuthGuard('admin')) | user |
| GET | `/api/v1/admin/users/:id/ledger` | UseGuards(AuthGuard('admin')) | ledger |
| POST | `/api/v1/admin/notifications` | UseGuards(AuthGuard('admin')) | notification |
| POST | `/api/v1/gifts` | UseGuards(AuthGuard('admin')) | createGift |
| GET | `/api/v1/gifts` | JWT guard নেই; নিচের service/webhook নিয়ম দেখুন | getGifts |
| PATCH | `/api/v1/gifts/:id` | UseGuards(AuthGuard('admin')) | updateGift |
| DELETE | `/api/v1/gifts/:id` | UseGuards(AuthGuard('admin')) | deactivateGift |
| POST | `/api/v1/gifts/:giftId/send` | UseGuards(AuthGuard('user')) | sendGift |
| POST | `/api/v1/newsletter` | JWT guard নেই; নিচের service/webhook নিয়ম দেখুন | sendMail |
| POST | `/api/v1/newsletter/broadcast` | UseGuards(AuthGuard('admin')) | broadcastNewsletter |
| GET | `/api/v1/newsletter` | JWT guard নেই; নিচের service/webhook নিয়ম দেখুন | getAllNewsletter |
| GET | `/api/v1/newsletter/:id` | JWT guard নেই; নিচের service/webhook নিয়ম দেখুন | getNewsletterById |
| GET | `/api/v1/payment/subscription/status` | UseGuards(AuthGuard('user', 'admin')) | status |
| POST | `/api/v1/payment/subscription/sync` | UseGuards(AuthGuard('user', 'admin')) | sync |
| POST | `/api/v1/payment/billing-portal` | UseGuards(AuthGuard('user', 'admin')) | portal |
| POST | `/api/v1/payment/subscription/cancel` | UseGuards(AuthGuard('user', 'admin')) | cancel |
| POST | `/api/v1/payment/subscription/:subscriptionId/upgrade` | UseGuards(AuthGuard('user', 'admin')) | upgrade |
| POST | `/api/v1/payment/subscription/:subscriptionId` | UseGuards(AuthGuard('admin', 'user')) | paySubscriber |
| POST | `/api/v1/payment/credits` | UseGuards(AuthGuard('user')) | buyCredits |
| POST | `/api/v1/subscription` | UseGuards(AuthGuard('admin')) | createSubscription |
| GET | `/api/v1/subscription` | JWT guard নেই; নিচের service/webhook নিয়ম দেখুন | getAllSubscription |
| GET | `/api/v1/subscription/:id` | JWT guard নেই; নিচের service/webhook নিয়ম দেখুন | getSubscriptionById |
| PUT | `/api/v1/subscription/:id` | UseGuards(AuthGuard('admin')) | updateSubscription |
| DELETE | `/api/v1/subscription/:id` | UseGuards(AuthGuard('admin')) | deleteSubscription |
| GET | `/api/v1/telegram/status/:companionId` | UseGuards(AuthGuard('user')) | status |
| POST | `/api/v1/telegram/connect/:companionId` | UseGuards(AuthGuard('user')) | connect |
| GET | `/api/v1/telegram/app` | JWT guard নেই; নিচের service/webhook নিয়ম দেখুন | page |
| GET | `/api/v1/telegram/app/settings/:companionId` | JWT guard নেই; নিচের service/webhook নিয়ম দেখুন | settings |
| POST | `/api/v1/telegram/app/login/:companionId` | JWT guard নেই; নিচের service/webhook নিয়ম দেখুন | login |
| POST | `/api/v1/telegram/app/status/:companionId` | JWT guard নেই; নিচের service/webhook নিয়ম দেখুন | status |
| POST | `/api/v1/webhooks/telegram/:companionId` | JWT guard নেই; নিচের service/webhook নিয়ম দেখুন | receiveForCompanion |
| POST | `/api/v1/webhooks/telegram` | JWT guard নেই; নিচের service/webhook নিয়ম দেখুন | receive |
| POST | `/api/v1/user` | JWT guard নেই; নিচের service/webhook নিয়ম দেখুন | createUser |
| GET | `/api/v1/user` | UseGuards(AuthGuard('admin')) | getAllUser |
| GET | `/api/v1/user/my-profile` | UseGuards(AuthGuard('user', 'admin')) | myProfile |
| PUT | `/api/v1/user/my-profile` | UseGuards(AuthGuard('user', 'admin')) | UpdateMyProfile |
| GET | `/api/v1/user/:id` | UseGuards(AuthGuard('admin')) | getUserById |
| PUT | `/api/v1/user/:id` | UseGuards(AuthGuard('admin')) | updateUser |
| DELETE | `/api/v1/user/:id` | UseGuards(AuthGuard('admin')) | deleteUser |
| POST | `/api/v1/webhook` | JWT guard নেই; নিচের service/webhook নিয়ম দেখুন | handleWebhook |
| POST | `/api/v1/whatsapp/connect/:companionId` | UseGuards(AuthGuard('user')) | connect |
| GET | `/api/v1/webhooks/whatsapp` | JWT guard নেই; নিচের service/webhook নিয়ম দেখুন | verifyWebhook |
| POST | `/api/v1/webhooks/whatsapp` | JWT guard নেই; নিচের service/webhook নিয়ম দেখুন | receiveWebhook |
| POST | `/api/v1/whatsapp/test` | UseGuards(AuthGuard('admin', 'user')) | test |
| GET | `/` | JWT guard নেই; নিচের service/webhook নিয়ম দেখুন | getHello |
| GET | `/api/v1/health/live` | JWT guard নেই; নিচের service/webhook নিয়ম দেখুন | live |
| GET | `/api/v1/health/ready` | JWT guard নেই; নিচের service/webhook নিয়ম দেখুন | ready |
| GET | `/privacy-policy` | JWT guard নেই; নিচের service/webhook নিয়ম দেখুন | privacyPolicy |
| GET | `/terms` | JWT guard নেই; নিচের service/webhook নিয়ম দেখুন | terms |
| GET | `/data-deletion` | JWT guard নেই; নিচের service/webhook নিয়ম দেখুন | dataDeletion |

## প্রতিটি endpoint-এর input ও response mapping

JWT guard নেই মানেই external webhook বা Mini App unrestricted নয়। Signature/initData validation service-এ হয়। @Req() query-এর প্রকৃত allowlist handler-এর pick(...) এ দেওয়া আছে। Nest default status POST=201, অন্যগুলো=200, যদি @HttpCode বা raw response override না করে।

### POST /api/v1/auth/register

Source: `src/app/module/auth/auth.controller.ts:39` • Handler: `AuthController.register`

Access: `Controller JWT guard নেই`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Body() createAuthDto: CreateAuthDto
```

Upload/query/status metadata:

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

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    const result = await this.authService.register(createAuthDto);

    return {
      message: 'User registered successfully',
      data: result,
    };
  }
```

### POST /api/v1/auth/login

Source: `src/app/module/auth/auth.controller.ts:62` • Handler: `AuthController.login`

Access: `Controller JWT guard নেই`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Body() loginAuthDto: LoginAuthDto
@Res({ passthrough: true }) res: Response
```

Upload/query/status metadata:

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

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    const result = await this.authService.login(loginAuthDto, res);

    return {
      message: 'Login successfully',
      data: result,
    };
  }
```

### GET /api/v1/auth/refresh

Source: `src/app/module/auth/auth.controller.ts:88` • Handler: `AuthController.refreshToken`

Access: `Controller JWT guard নেই`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Req() req: Request
```

Upload/query/status metadata:

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

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    const result = await this.authService.refreshToken(req);

    return {
      message: 'Token refreshed successfully',
      data: result,
    };
  }
```

### POST /api/v1/auth/forgot-password

Source: `src/app/module/auth/auth.controller.ts:112` • Handler: `AuthController.forgotPassword`

Access: `Controller JWT guard নেই`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Body() forgotPasswordAuthDto: ForgotPasswordAuthDto
```

Upload/query/status metadata:

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

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

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

### POST /api/v1/auth/verify-otp

Source: `src/app/module/auth/auth.controller.ts:137` • Handler: `AuthController.verifyOtp`

Access: `Controller JWT guard নেই`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Body() verifyOtpAuthDto: VerifyOtpAuthDto
```

Upload/query/status metadata:

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

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

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

### POST /api/v1/auth/reset-password

Source: `src/app/module/auth/auth.controller.ts:163` • Handler: `AuthController.resetPassword`

Access: `Controller JWT guard নেই`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Body() resetPasswordAuthDto: ResetPasswordAuthDto
```

Upload/query/status metadata:

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

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

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

### POST /api/v1/auth/change-password

Source: `src/app/module/auth/auth.controller.ts:190` • Handler: `AuthController.changePassword`

Access: `UseGuards(AuthGuard('admin', 'user'))`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Body() changePasswordAuthDto: ChangePasswordAuthDto
```

Upload/query/status metadata:

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

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    const result = await this.authService.changePassword(
      changePasswordAuthDto.email,
      changePasswordAuthDto.oldPassword,
      changePasswordAuthDto.newPassword,
    );

    return {
      message: 'Password changed successfully',
      data: result,
    };
  }
```

### POST /api/v1/auth/logout

Source: `src/app/module/auth/auth.controller.ts:219` • Handler: `AuthController.logout`

Access: `UseGuards(AuthGuard('admin', 'user'))`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Req() req: Request
@Res({ passthrough: true }) res: Response
```

Upload/query/status metadata:

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

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    const result = await this.authService.logout(req, res);

    return {
      message: 'Logout successfully',
      data: result,
    };
  }
```

### GET /api/v1/chat/conversations

Source: `src/app/module/chat/chat.controller.ts:28` • Handler: `ChatController.getConversations`

Access: `UseGuards(AuthGuard('user'))`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Req() request: Request
```

Upload/query/status metadata:

```typescript
@Get('conversations')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('user'))
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    if (!request.user) throw new UnauthorizedException();
    return { data: await this.chatService.getConversations(request.user.id) };
  }
```

### GET /api/v1/chat/:companionId/messages

Source: `src/app/module/chat/chat.controller.ts:36` • Handler: `ChatController.getMessages`

Access: `UseGuards(AuthGuard('user'))`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Req() request: Request
@Param('companionId') companionId: string
@Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number
```

Upload/query/status metadata:

```typescript
@Get(':companionId/messages')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('user'))
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

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

### GET /api/v1/chat/usage

Source: `src/app/module/chat/chat.controller.ts:55` • Handler: `ChatController.getUsage`

Access: `UseGuards(AuthGuard('user'))`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Req() request: Request
```

Upload/query/status metadata:

```typescript
@Get('usage')
@ApiOperation({ summary: 'Get subscription usage and credit balance' })
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('user'))
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    if (!request.user) throw new UnauthorizedException();
    const data = await this.chatService.getUsage(request.user.id);
    return { message: 'Chat usage fetched successfully', data };
  }
```

### POST /api/v1/chat/:companionId/messages

Source: `src/app/module/chat/chat.controller.ts:65` • Handler: `ChatController.sendMessage`

Access: `UseGuards(AuthGuard('user'))`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Req() request: Request
@Param('companionId') companionId: string
@Body() payload: SendMessageDto
```

Upload/query/status metadata:

```typescript
@Post(':companionId/messages')
@HttpCode(HttpStatus.CREATED)
@ApiOperation({ summary: 'Send a message to a companion' })
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('user'))
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    if (!request.user) throw new UnauthorizedException();
    const data = await this.chatService.sendMessage(
      request.user.id,
      companionId,
      payload.message,
      request.headers.authorization!,
      payload.type,
    );
    return { message: 'Message sent successfully', data };
  }
```

### POST /api/v1/companions

Source: `src/app/module/companions/companions.controller.ts:38` • Handler: `CompanionsController.createCompanion`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Body() payload: CreateCompanionDto
```

Upload/query/status metadata:

```typescript
@Post()
@ApiOperation({ summary: 'Create a companion' })
@ApiBearerAuth('access-token')
@ApiConsumes('application/json')
@ApiBody({ type: CreateCompanionDto })
@UseGuards(AuthGuard('admin'))
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    const data = await this.companionsService.createCompanion(payload);
    return { message: 'Companion created successfully', data };
  }
```

### GET /api/v1/companions

Source: `src/app/module/companions/companions.controller.ts:49` • Handler: `CompanionsController.getAllCompanions`

Access: `Controller JWT guard নেই`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Req() request: Request
```

Upload/query/status metadata:

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

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

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

### GET /api/v1/companions/:id

Source: `src/app/module/companions/companions.controller.ts:92` • Handler: `CompanionsController.getCompanionById`

Access: `Controller JWT guard নেই`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Param('id') id: string
```

Upload/query/status metadata:

```typescript
@Get(':id')
@HttpCode(HttpStatus.OK)
@ApiOperation({ summary: 'Get a companion by ID' })
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    const data = await this.companionsService.getCompanionById(id);
    return { message: 'Companion fetched successfully', data };
  }
```

### PUT /api/v1/companions/:id

Source: `src/app/module/companions/companions.controller.ts:100` • Handler: `CompanionsController.updateCompanion`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Param('id') id: string
@Body() payload: UpdateCompanionDto
```

Upload/query/status metadata:

```typescript
@Put(':id')
@ApiOperation({ summary: 'Update a companion' })
@ApiBearerAuth('access-token')
@ApiConsumes('application/json')
@ApiBody({ type: UpdateCompanionDto })
@UseGuards(AuthGuard('admin'))
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    const data = await this.companionsService.updateCompanion(id, payload);
    return { message: 'Companion updated successfully', data };
  }
```

### PUT /api/v1/companions/:id/profile-image

Source: `src/app/module/companions/companions.controller.ts:114` • Handler: `CompanionsController.updateProfileImage`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Param('id') id: string
@UploadedFiles() files: { profileImage?: Express.Multer.File[] } = {}
```

Upload/query/status metadata:

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

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

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

### PUT /api/v1/companions/:id/cover-image

Source: `src/app/module/companions/companions.controller.ts:145` • Handler: `CompanionsController.updateCoverImage`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Param('id') id: string
@UploadedFiles() files: { coverImage?: Express.Multer.File[] } = {}
```

Upload/query/status metadata:

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

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

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

### POST /api/v1/companions/:id/gallery

Source: `src/app/module/companions/companions.controller.ts:176` • Handler: `CompanionsController.addGalleryImages`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Param('id') id: string
@UploadedFiles() files: { galleryImages?: Express.Multer.File[] } = {}
```

Upload/query/status metadata:

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

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

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

### PUT /api/v1/companions/:id/gallery

Source: `src/app/module/companions/companions.controller.ts:213` • Handler: `CompanionsController.updateGalleryImages`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Param('id') id: string
@UploadedFiles() files: { galleryImages?: Express.Multer.File[] } = {}
```

Upload/query/status metadata:

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

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

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

### DELETE /api/v1/companions/:id

Source: `src/app/module/companions/companions.controller.ts:250` • Handler: `CompanionsController.deleteCompanion`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Param('id') id: string
```

Upload/query/status metadata:

```typescript
@Delete(':id')
@ApiOperation({ summary: 'Delete a companion' })
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('admin'))
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    const data = await this.companionsService.deleteCompanion(id);
    return { message: 'Companion deleted successfully', data };
  }
```

### PUT /api/v1/companions/:id/voice

Source: `src/app/module/companions/companions.controller.ts:258` • Handler: `CompanionsController.updateVoice`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Param('id') id: string
@Body() payload: UpdateVoiceDto
```

Upload/query/status metadata:

```typescript
@Put(':id/voice')
@ApiOperation({ summary: 'Update companion voice ID' })
@ApiBearerAuth('access-token')
@ApiBody({ type: UpdateVoiceDto })
@UseGuards(AuthGuard('admin'))
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    const data = await this.companionsService.updateVoiceSettings(
      id,
      payload.voiceId,
    );

    return { message: 'Voice ID updated successfully', data };
  }
```

### POST /api/v1/credits/packages

Source: `src/app/module/credit/credit.controller.ts:32` • Handler: `CreditController.createPackage`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Body() payload: CreateCreditPackageDto
```

Upload/query/status metadata:

```typescript
@Post('packages')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('admin'))
@ApiOperation({ summary: 'Create a credit package (admin)' })
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    const data = await this.creditService.createPackage(payload);
    return { message: 'Credit package created successfully', data };
  }
```

### GET /api/v1/credits/packages

Source: `src/app/module/credit/credit.controller.ts:41` • Handler: `CreditController.getPackages`

Access: `Controller JWT guard নেই`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
// কোনো parameter নেই
```

Upload/query/status metadata:

```typescript
@Get('packages')
@ApiOperation({ summary: 'Get active credit packages' })
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    const data = await this.creditService.getActivePackages();
    return { message: 'Credit packages fetched successfully', data };
  }
```

### PATCH /api/v1/credits/packages/:id

Source: `src/app/module/credit/credit.controller.ts:48` • Handler: `CreditController.updatePackage`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Param('id') id: string
@Body() payload: UpdateCreditPackageDto
```

Upload/query/status metadata:

```typescript
@Patch('packages/:id')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('admin'))
@ApiOperation({ summary: 'Update a credit package (admin)' })
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    const data = await this.creditService.updatePackage(id, payload);
    return { message: 'Credit package updated successfully', data };
  }
```

### DELETE /api/v1/credits/packages/:id

Source: `src/app/module/credit/credit.controller.ts:60` • Handler: `CreditController.deactivatePackage`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Param('id') id: string
```

Upload/query/status metadata:

```typescript
@Delete('packages/:id')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('admin'))
@ApiOperation({ summary: 'Deactivate a credit package (admin)' })
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    const data = await this.creditService.deactivatePackage(id);
    return { message: 'Credit package deactivated successfully', data };
  }
```

### POST /api/v1/credits/purchase

Source: `src/app/module/credit/credit.controller.ts:69` • Handler: `CreditController.purchase`

Access: `UseGuards(AuthGuard('user'))`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Req() request: Request
@Body() payload: PurchaseCreditPackageDto
```

Upload/query/status metadata:

```typescript
@Post('purchase')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('user'))
@ApiOperation({ summary: 'Purchase a credit package' })
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    if (!request.user) throw new UnauthorizedException();
    const data = await this.paymentService.buyCredits(
      request.user.id,
      payload.packageId,
    );
    return { message: 'Credit payment initiated successfully', data };
  }
```

### GET /api/v1/credits/wallet

Source: `src/app/module/credit/credit.controller.ts:85` • Handler: `CreditController.getWallet`

Access: `UseGuards(AuthGuard('user'))`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Req() request: Request
```

Upload/query/status metadata:

```typescript
@Get('wallet')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('user'))
@ApiOperation({ summary: 'Get wallet balance and recent transactions' })
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    if (!request.user) throw new UnauthorizedException();
    const data = await this.creditService.getWallet(request.user.id);
    return { message: 'Wallet fetched successfully', data };
  }
```

### GET /api/v1/dashboard/overview

Source: `src/app/module/dashboard/dashboard.controller.ts:17` • Handler: `DashboardController.dashboardOverview`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
// কোনো parameter নেই
```

Upload/query/status metadata:

```typescript
@Get('overview')
@ApiOperation({ summary: 'Get dashboard overview' })
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('admin'))
@HttpCode(HttpStatus.OK)
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    const data = await this.dashboardService.dashboardOverview();

    return {
      message: 'Dashboard overview fetched successfully',
      data,
    };
  }
```

### GET /api/v1/relationships

Source: `src/app/module/engagement/engagement.controller.ts:39` • Handler: `EngagementController.relationships`

Access: `UseGuards(AuthGuard('user', 'admin'))`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Req() req: Request
@Query() query: PageDto
```

Upload/query/status metadata:

```typescript
@Get('relationships')
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    return { data: await this.service.relationships(req.user!.id, query) };
  }
```

### PATCH /api/v1/relationships/:companionId

Source: `src/app/module/engagement/engagement.controller.ts:45` • Handler: `EngagementController.relationship`

Access: `UseGuards(AuthGuard('user', 'admin'))`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Req() req: Request
@Param('companionId') id: string
@Body() body: RelationshipDto
```

Upload/query/status metadata:

```typescript
@Patch('relationships/:companionId')
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    return {
      data: await this.service.updateRelationship(req.user!.id, id, body),
    };
  }
```

### GET /api/v1/companions/:companionId/stories

Source: `src/app/module/engagement/engagement.controller.ts:54` • Handler: `EngagementController.stories`

Access: `UseGuards(AuthGuard('user', 'admin'))`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Param('companionId') id: string
@Query() query: PageDto
```

Upload/query/status metadata:

```typescript
@Get('companions/:companionId/stories')
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    return { data: await this.service.stories(id, query) };
  }
```

### POST /api/v1/companions/:companionId/photos/view

Source: `src/app/module/engagement/engagement.controller.ts:60` • Handler: `EngagementController.photo`

Access: `UseGuards(AuthGuard('user', 'admin'))`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Req() req: Request
@Param('companionId') id: string
@Body() body: PhotoDto
```

Upload/query/status metadata:

```typescript
@Post('companions/:companionId/photos/view')
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    return {
      data: await this.service.viewPhoto(req.user!.id, id, body.photoUrl),
    };
  }
```

### GET /api/v1/photos/history

Source: `src/app/module/engagement/engagement.controller.ts:69` • Handler: `EngagementController.photos`

Access: `UseGuards(AuthGuard('user', 'admin'))`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Req() req: Request
@Query() query: PageDto
```

Upload/query/status metadata:

```typescript
@Get('photos/history')
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    return { data: await this.service.photoHistory(req.user!.id, query) };
  }
```

### GET /api/v1/credits/ledger

Source: `src/app/module/engagement/engagement.controller.ts:75` • Handler: `EngagementController.ledger`

Access: `UseGuards(AuthGuard('user', 'admin'))`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Req() req: Request
@Query() query: PageDto
```

Upload/query/status metadata:

```typescript
@Get('credits/ledger')
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    return { data: await this.service.ledger(req.user!.id, query) };
  }
```

### GET /api/v1/credits/costs

Source: `src/app/module/engagement/engagement.controller.ts:81` • Handler: `EngagementController.costs`

Access: `UseGuards(AuthGuard('user', 'admin'))`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
// কোনো parameter নেই
```

Upload/query/status metadata:

```typescript
@Get('credits/costs')
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    return { data: await this.credits.getCosts() };
  }
```

### GET /api/v1/notifications

Source: `src/app/module/engagement/engagement.controller.ts:84` • Handler: `EngagementController.notifications`

Access: `UseGuards(AuthGuard('user', 'admin'))`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Req() req: Request
@Query() query: PageDto
```

Upload/query/status metadata:

```typescript
@Get('notifications')
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    return { data: await this.service.notifications(req.user!.id, query) };
  }
```

### PATCH /api/v1/notifications/:id/read

Source: `src/app/module/engagement/engagement.controller.ts:90` • Handler: `EngagementController.read`

Access: `UseGuards(AuthGuard('user', 'admin'))`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Req() req: Request
@Param('id') id: string
```

Upload/query/status metadata:

```typescript
@Patch('notifications/:id/read')
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    return { data: await this.service.readNotification(req.user!.id, id) };
  }
```

### PUT /api/v1/admin/credit-costs/:action

Source: `src/app/module/engagement/engagement.controller.ts:107` • Handler: `EngagementAdminController.cost`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Param('action') action: string
@Body() body: CostDto
```

Upload/query/status metadata:

```typescript
@Put('credit-costs/:action')
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    return { data: await this.service.setCost(action, body.credits) };
  }
```

### PUT /api/v1/admin/companions/:companionId/stories

Source: `src/app/module/engagement/engagement.controller.ts:113` • Handler: `EngagementAdminController.story`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Param('companionId') id: string
@Body() body: StoryDto
```

Upload/query/status metadata:

```typescript
@Put('companions/:companionId/stories')
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    return { data: await this.service.saveStory(id, body) };
  }
```

### GET /api/v1/admin/companions/:companionId/stories

Source: `src/app/module/engagement/engagement.controller.ts:119` • Handler: `EngagementAdminController.stories`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Param('companionId') id: string
@Query() query: PageDto
```

Upload/query/status metadata:

```typescript
@Get('companions/:companionId/stories')
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    return { data: await this.service.stories(id, query, true) };
  }
```

### GET /api/v1/admin/conversations

Source: `src/app/module/engagement/engagement.controller.ts:125` • Handler: `EngagementAdminController.conversations`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Query() query: PageDto
```

Upload/query/status metadata:

```typescript
@Get('conversations')
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    return { data: await this.service.conversations(query) };
  }
```

### GET /api/v1/admin/conversations/:id

Source: `src/app/module/engagement/engagement.controller.ts:128` • Handler: `EngagementAdminController.conversation`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Param('id') id: string
@Query() query: PageDto
```

Upload/query/status metadata:

```typescript
@Get('conversations/:id')
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    return { data: await this.service.conversation(id, query) };
  }
```

### PATCH /api/v1/admin/conversations/:id/mode

Source: `src/app/module/engagement/engagement.controller.ts:134` • Handler: `EngagementAdminController.mode`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Req() req: Request
@Param('id') id: string
@Body() body: ModeDto
```

Upload/query/status metadata:

```typescript
@Patch('conversations/:id/mode')
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    return { data: await this.service.setMode(id, req.user!.id, body.mode) };
  }
```

### POST /api/v1/admin/conversations/:id/replies

Source: `src/app/module/engagement/engagement.controller.ts:141` • Handler: `EngagementAdminController.reply`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Req() req: Request
@Param('id') id: string
@Body() body: HumanReplyDto
```

Upload/query/status metadata:

```typescript
@Post('conversations/:id/replies')
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    return { data: await this.service.humanReply(id, req.user!.id, body) };
  }
```

### GET /api/v1/admin/users/:id/details

Source: `src/app/module/engagement/engagement.controller.ts:148` • Handler: `EngagementAdminController.user`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Param('id') id: string
```

Upload/query/status metadata:

```typescript
@Get('users/:id/details')
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    return { data: await this.service.userDetails(id) };
  }
```

### GET /api/v1/admin/users/:id/ledger

Source: `src/app/module/engagement/engagement.controller.ts:151` • Handler: `EngagementAdminController.ledger`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Param('id') id: string
@Query() query: PageDto
```

Upload/query/status metadata:

```typescript
@Get('users/:id/ledger')
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    return { data: await this.service.ledger(id, query) };
  }
```

### POST /api/v1/admin/notifications

Source: `src/app/module/engagement/engagement.controller.ts:157` • Handler: `EngagementAdminController.notification`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Body() body: NotificationDto
```

Upload/query/status metadata:

```typescript
@Post('notifications')
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    return {
      data: await this.prisma.notification.create({
        data: { ...body, type: 'admin' },
      }),
    };
  }
```

### POST /api/v1/gifts

Source: `src/app/module/gift/gift.controller.ts:37` • Handler: `GiftController.createGift`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Body() payload: CreateGiftDto
@UploadedFile() file?: Express.Multer.File
```

Upload/query/status metadata:

```typescript
@Post()
@ApiOperation({ summary: 'Create a gift (admin)' })
@ApiConsumes('multipart/form-data')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('admin'))
@UseInterceptors(FileInterceptor('image', fileUpload.uploadConfig))
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    const data = await this.giftService.createGift(payload, file);
    return { message: 'Gift created successfully', data };
  }
```

### GET /api/v1/gifts

Source: `src/app/module/gift/gift.controller.ts:51` • Handler: `GiftController.getGifts`

Access: `Controller JWT guard নেই`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Req() req: Request
```

Upload/query/status metadata:

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

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

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

### PATCH /api/v1/gifts/:id

Source: `src/app/module/gift/gift.controller.ts:71` • Handler: `GiftController.updateGift`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Param('id') id: string
@Body() payload: UpdateGiftDto
```

Upload/query/status metadata:

```typescript
@Patch(':id')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('admin'))
@ApiOperation({ summary: 'Update a gift (admin)' })
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    const data = await this.giftService.updateGift(id, payload);
    return { message: 'Gift updated successfully', data };
  }
```

### DELETE /api/v1/gifts/:id

Source: `src/app/module/gift/gift.controller.ts:80` • Handler: `GiftController.deactivateGift`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Param('id') id: string
```

Upload/query/status metadata:

```typescript
@Delete(':id')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('admin'))
@ApiOperation({ summary: 'Deactivate a gift (admin)' })
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    const data = await this.giftService.deactivateGift(id);
    return { message: 'Gift deactivated successfully', data };
  }
```

### POST /api/v1/gifts/:giftId/send

Source: `src/app/module/gift/gift.controller.ts:89` • Handler: `GiftController.sendGift`

Access: `UseGuards(AuthGuard('user'))`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Req() request: Request
@Param('giftId') giftId: string
@Body() payload: SendGiftDto
```

Upload/query/status metadata:

```typescript
@Post(':giftId/send')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('user'))
@ApiOperation({ summary: 'Send a gift to a companion using credits' })
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

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

### POST /api/v1/newsletter

Source: `src/app/module/newsletter/newsletter.controller.ts:30` • Handler: `NewsletterController.sendMail`

Access: `Controller JWT guard নেই`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Body() createNewsletterDto: CreateNewsletterDto
```

Upload/query/status metadata:

```typescript
@Post()
@ApiOperation({ summary: 'Subscribe to newsletter' })
@HttpCode(HttpStatus.CREATED)
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    const data = await this.newsletterService.sendMail(createNewsletterDto);
    return {
      message: 'Newsletter subscription saved successfully',
      data,
    };
  }
```

### POST /api/v1/newsletter/broadcast

Source: `src/app/module/newsletter/newsletter.controller.ts:41` • Handler: `NewsletterController.broadcastNewsletter`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Body() dto: BroadcastNewsletterDto
```

Upload/query/status metadata:

```typescript
@Post('broadcast')
@ApiOperation({ summary: 'Broadcast an email to all newsletter subscribers' })
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('admin'))
@HttpCode(HttpStatus.OK)
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    const data = await this.newsletterService.broadcastNewsletter(dto);

    return {
      message: 'Newsletter broadcast sent successfully',
      data,
    };
  }
```

### GET /api/v1/newsletter

Source: `src/app/module/newsletter/newsletter.controller.ts:55` • Handler: `NewsletterController.getAllNewsletter`

Access: `Controller JWT guard নেই`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Req() req: Request
```

Upload/query/status metadata:

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

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

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

### GET /api/v1/newsletter/:id

Source: `src/app/module/newsletter/newsletter.controller.ts:109` • Handler: `NewsletterController.getNewsletterById`

Access: `Controller JWT guard নেই`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Param('id') id: string
```

Upload/query/status metadata:

```typescript
@Get(':id')
@ApiOperation({ summary: 'Get newsletter by id' })
@HttpCode(HttpStatus.OK)
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    const result = await this.newsletterService.getNewsletterById(id);

    return {
      message: 'Get newsletter by id successfully',
      data: result,
    };
  }
```

### GET /api/v1/payment/subscription/status

Source: `src/app/module/payment/payment.controller.ts:28` • Handler: `PaymentController.status`

Access: `UseGuards(AuthGuard('user', 'admin'))`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Req() request: Request
```

Upload/query/status metadata:

```typescript
@Get('subscription/status')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('user', 'admin'))
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    return this.billing.status(request.user!.id);
  }
```

### POST /api/v1/payment/subscription/sync

Source: `src/app/module/payment/payment.controller.ts:35` • Handler: `PaymentController.sync`

Access: `UseGuards(AuthGuard('user', 'admin'))`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Req() request: Request
```

Upload/query/status metadata:

```typescript
@Post('subscription/sync')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('user', 'admin'))
@ApiOperation({
    summary:
      'Verify Stripe payment and synchronize subscription access without charging again',
  })
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    return { data: await this.billing.sync(request.user!.id) };
  }
```

### POST /api/v1/payment/billing-portal

Source: `src/app/module/payment/payment.controller.ts:46` • Handler: `PaymentController.portal`

Access: `UseGuards(AuthGuard('user', 'admin'))`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Req() request: Request
```

Upload/query/status metadata:

```typescript
@Post('billing-portal')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('user', 'admin'))
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    return this.billing.portal(request.user!.id);
  }
```

### POST /api/v1/payment/subscription/cancel

Source: `src/app/module/payment/payment.controller.ts:53` • Handler: `PaymentController.cancel`

Access: `UseGuards(AuthGuard('user', 'admin'))`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Req() request: Request
```

Upload/query/status metadata:

```typescript
@Post('subscription/cancel')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('user', 'admin'))
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    return this.billing.cancel(request.user!.id);
  }
```

### POST /api/v1/payment/subscription/:subscriptionId/upgrade

Source: `src/app/module/payment/payment.controller.ts:60` • Handler: `PaymentController.upgrade`

Access: `UseGuards(AuthGuard('user', 'admin'))`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Req() request: Request
@Param('subscriptionId') id: string
```

Upload/query/status metadata:

```typescript
@Post('subscription/:subscriptionId/upgrade')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('user', 'admin'))
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    return this.billing.upgrade(request.user!.id, id);
  }
```

### POST /api/v1/payment/subscription/:subscriptionId

Source: `src/app/module/payment/payment.controller.ts:67` • Handler: `PaymentController.paySubscriber`

Access: `UseGuards(AuthGuard('admin', 'user'))`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Req() request: Request
@Param('subscriptionId') subscriptionId: string
```

Upload/query/status metadata:

```typescript
@Post('subscription/:subscriptionId')
@HttpCode(HttpStatus.CREATED)
@ApiOperation({ summary: 'Initiate a subscription payment' })
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('admin', 'user'))
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

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

### POST /api/v1/payment/credits

Source: `src/app/module/payment/payment.controller.ts:91` • Handler: `PaymentController.buyCredits`

Access: `UseGuards(AuthGuard('user'))`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Req() request: Request
@Body() payload: BuyCreditsDto
```

Upload/query/status metadata:

```typescript
@Post('credits')
@HttpCode(HttpStatus.CREATED)
@ApiOperation({ summary: 'Buy a credit package by package ID' })
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('user'))
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

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

### POST /api/v1/subscription

Source: `src/app/module/subscription/subscription.controller.ts:26` • Handler: `SubscriptionController.createSubscription`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Body() createSubscriptionDto: CreateSubscriptionDto
```

Upload/query/status metadata:

```typescript
@Post()
@ApiOperation({ summary: 'Create subscription' })
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('admin'))
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

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

### GET /api/v1/subscription

Source: `src/app/module/subscription/subscription.controller.ts:42` • Handler: `SubscriptionController.getAllSubscription`

Access: `Controller JWT guard নেই`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Req() req: Request
```

Upload/query/status metadata:

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

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

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

### GET /api/v1/subscription/:id

Source: `src/app/module/subscription/subscription.controller.ts:110` • Handler: `SubscriptionController.getSubscriptionById`

Access: `Controller JWT guard নেই`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Param('id') id: string
```

Upload/query/status metadata:

```typescript
@Get(':id')
@ApiOperation({ summary: 'Get subscription by id' })
@HttpCode(HttpStatus.OK)
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    const result = await this.subscriptionService.getSubscriptionById(id);
    return {
      message: 'Subscription fetched successfully',
      data: result,
    };
  }
```

### PUT /api/v1/subscription/:id

Source: `src/app/module/subscription/subscription.controller.ts:121` • Handler: `SubscriptionController.updateSubscription`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Param('id') id: string
@Body() updateSubscriptionDto: UpdateSubscriptionDto
```

Upload/query/status metadata:

```typescript
@Put(':id')
@ApiOperation({ summary: 'Update subscription' })
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('admin'))
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

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

### DELETE /api/v1/subscription/:id

Source: `src/app/module/subscription/subscription.controller.ts:139` • Handler: `SubscriptionController.deleteSubscription`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Param('id') id: string
```

Upload/query/status metadata:

```typescript
@Delete(':id')
@ApiOperation({ summary: 'Delete subscription' })
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('admin'))
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    const result = await this.subscriptionService.deleteSubscription(id);
    return {
      message: 'Subscription deleted successfully',
      data: result,
    };
  }
```

### GET /api/v1/telegram/status/:companionId

Source: `src/app/module/telegram/telegram-connect.controller.ts:28` • Handler: `TelegramConnectController.status`

Access: `UseGuards(AuthGuard('user'))`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Req() request: Request
@Param('companionId', ParseUUIDPipe) companionId: string
```

Upload/query/status metadata:

```typescript
@Get('status/:companionId')
@ApiOperation({
    summary: 'Get Telegram linking/subscription status and return-to-bot URL',
    description:
      'Use after payment confirmation. Credit balance is available from the credit wallet API. This endpoint does not grant credits or activate subscriptions.',
  })
@ApiParam({ name: 'companionId', format: 'uuid' })
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    return { data: await this.ai.status(request.user!.id, companionId) };
  }
```

### POST /api/v1/telegram/connect/:companionId

Source: `src/app/module/telegram/telegram-connect.controller.ts:42` • Handler: `TelegramConnectController.connect`

Access: `UseGuards(AuthGuard('user'))`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Req() request: Request
@Param('companionId', ParseUUIDPipe) companionId: string
```

Upload/query/status metadata:

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

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    return { data: await this.ai.connect(request.user!.id, companionId) };
  }
```

### GET /api/v1/telegram/app

Source: `src/app/module/telegram/telegram-mini-app.controller.ts:41` • Handler: `TelegramMiniAppController.page`

Access: `Controller JWT guard নেই`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Res() response: Response
```

Upload/query/status metadata:

```typescript
@Get()
@SetMetadata('rawResponse', true)
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

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

### GET /api/v1/telegram/app/settings/:companionId

Source: `src/app/module/telegram/telegram-mini-app.controller.ts:56` • Handler: `TelegramMiniAppController.settings`

Access: `Controller JWT guard নেই`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Param('companionId', ParseUUIDPipe) companionId: string
```

Upload/query/status metadata:

```typescript
@Get('settings/:companionId')
@Header('Cache-Control', 'no-store')
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    return { data: await this.app.settings(companionId) };
  }
```

### POST /api/v1/telegram/app/login/:companionId

Source: `src/app/module/telegram/telegram-mini-app.controller.ts:62` • Handler: `TelegramMiniAppController.login`

Access: `Controller JWT guard নেই`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Param('companionId', ParseUUIDPipe) id: string
@Body() body: TelegramLoginDto
```

Upload/query/status metadata:

```typescript
@Post('login/:companionId')
@HttpCode(200)
@Header('Cache-Control', 'no-store')
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

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

### POST /api/v1/telegram/app/status/:companionId

Source: `src/app/module/telegram/telegram-mini-app.controller.ts:80` • Handler: `TelegramMiniAppController.status`

Access: `Controller JWT guard নেই`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Param('companionId', ParseUUIDPipe) id: string
@Body() body: TelegramSessionDto
```

Upload/query/status metadata:

```typescript
@Post('status/:companionId')
@HttpCode(200)
@Header('Cache-Control', 'no-store')
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    return { data: await this.app.status(id, body.initData) };
  }
```

### POST /api/v1/webhooks/telegram/:companionId

Source: `src/app/module/telegram/telegram-webhook.controller.ts:22` • Handler: `TelegramWebhookController.receiveForCompanion`

Access: `Controller JWT guard নেই`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Param('companionId', ParseUUIDPipe) companionId: string
@Body() body: unknown
@Headers('x-telegram-bot-api-secret-token') secret?: string
```

Upload/query/status metadata:

```typescript
@Post(':companionId')
@HttpCode(200)
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    const key = this.telegram.botKey(companionId);
    this.telegram.verifySecret(secret, key);
    await this.queue.receive(body, key);
    return { ok: true };
  }
```

### POST /api/v1/webhooks/telegram

Source: `src/app/module/telegram/telegram-webhook.controller.ts:35` • Handler: `TelegramWebhookController.receive`

Access: `Controller JWT guard নেই`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Body() body: unknown
@Headers('x-telegram-bot-api-secret-token') secret?: string
```

Upload/query/status metadata:

```typescript
@Post()
@HttpCode(200)
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    this.telegram.verifySecret(secret);
    await this.queue.receive(body);
    return { ok: true };
  }
```

### POST /api/v1/user

Source: `src/app/module/user/user.controller.ts:38` • Handler: `UserController.createUser`

Access: `Controller JWT guard নেই`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Body() createUserDto: CreateUserDto
```

Upload/query/status metadata:

```typescript
@Post()
@ApiOperation({
    summary: 'create user',
  })
@HttpCode(HttpStatus.CREATED)
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    const result = await this.userService.createUser(createUserDto);

    return {
      message: 'create user successfully',
      data: result,
    };
  }
```

### GET /api/v1/user

Source: `src/app/module/user/user.controller.ts:52` • Handler: `UserController.getAllUser`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Req() req: Request
```

Upload/query/status metadata:

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

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    const filters = pick(req.query, ['searchTerm', 'role', 'email', 'name']);
    const options = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);
    const result = await this.userService.getAllUser(filters, options);

    return {
      message: 'get all user successfully',
      meta: result.meta,
      data: result.data,
    };
  }
```

### GET /api/v1/user/my-profile

Source: `src/app/module/user/user.controller.ts:119` • Handler: `UserController.myProfile`

Access: `UseGuards(AuthGuard('user', 'admin'))`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Req() req: Request
```

Upload/query/status metadata:

```typescript
@Get('my-profile')
@ApiOperation({
    summary: 'get my profile',
  })
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('user', 'admin'))
@HttpCode(HttpStatus.OK)
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

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

### PUT /api/v1/user/my-profile

Source: `src/app/module/user/user.controller.ts:136` • Handler: `UserController.UpdateMyProfile`

Access: `UseGuards(AuthGuard('user', 'admin'))`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Req() req: Request
@Body() updateUserDto: UpdateUserDto
@UploadedFile() file?: Express.Multer.File
```

Upload/query/status metadata:

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

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

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

### GET /api/v1/user/:id

Source: `src/app/module/user/user.controller.ts:164` • Handler: `UserController.getUserById`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Param('id') id: string
```

Upload/query/status metadata:

```typescript
@Get(':id')
@ApiOperation({
    summary: 'get user by id',
  })
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('admin'))
@HttpCode(HttpStatus.OK)
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    const result = await this.userService.getUserById(id);

    return {
      message: 'get user by id successfully',
      data: result,
    };
  }
```

### PUT /api/v1/user/:id

Source: `src/app/module/user/user.controller.ts:180` • Handler: `UserController.updateUser`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Param('id') id: string
@Body() updateUserDto: UpdateUserDto
@UploadedFile() file?: Express.Multer.File
```

Upload/query/status metadata:

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

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    const result = await this.userService.updateUser(id, updateUserDto, file);

    return {
      message: 'update user successfully',
      data: result,
    };
  }
```

### DELETE /api/v1/user/:id

Source: `src/app/module/user/user.controller.ts:201` • Handler: `UserController.deleteUser`

Access: `UseGuards(AuthGuard('admin'))`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Param('id') id: string
```

Upload/query/status metadata:

```typescript
@Delete(':id')
@ApiOperation({
    summary: 'delete user',
  })
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('admin'))
@HttpCode(HttpStatus.OK)
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    const result = await this.userService.deleteUser(id);

    return {
      message: 'delete user successfully',
      data: result,
    };
  }
```

### POST /api/v1/webhook

Source: `src/app/module/webhook/webhook.controller.ts:12` • Handler: `WebhookController.handleWebhook`

Access: `Controller JWT guard নেই`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Req() req: RawBodyRequest<Request>
@Headers('stripe-signature') signature?: string
```

Upload/query/status metadata:

```typescript
@Post()
@HttpCode(200)
@ApiOperation({ summary: 'Stripe webhook handler' })
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    return this.webhookService.handleWebhook(req.rawBody, signature);
  }
```

### POST /api/v1/whatsapp/connect/:companionId

Source: `src/app/module/whatsapp/whatsapp-connect.controller.ts:21` • Handler: `WhatsAppConnectController.connect`

Access: `UseGuards(AuthGuard('user'))`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Req() request: Request
@Param('companionId', ParseUUIDPipe) companionId: string
```

Upload/query/status metadata:

```typescript
@Post('connect/:companionId')
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    return { data: await this.ai.connect(request.user!.id, companionId) };
  }
```

### GET /api/v1/webhooks/whatsapp

Source: `src/app/module/whatsapp/whatsapp-webhook.controller.ts:30` • Handler: `WhatsAppWebhookController.verifyWebhook`

Access: `Controller JWT guard নেই`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Query('hub.mode') mode: string
@Query('hub.verify_token') token: string
@Query('hub.challenge') challenge: string
```

Upload/query/status metadata:

```typescript
@Get()
@Header('Content-Type', 'text/plain')
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    const expectedToken = this.configService.get<string>(
      'WHATSAPP_VERIFY_TOKEN',
    );
    if (
      mode !== 'subscribe' ||
      !expectedToken ||
      token !== expectedToken ||
      typeof challenge !== 'string' ||
      !challenge
    ) {
      throw new ForbiddenException('Invalid webhook verification');
    }

    return challenge;
  }
```

### POST /api/v1/webhooks/whatsapp

Source: `src/app/module/whatsapp/whatsapp-webhook.controller.ts:53` • Handler: `WhatsAppWebhookController.receiveWebhook`

Access: `Controller JWT guard নেই`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Body() body: Parameters<WhatsAppInboundService['receive']>[0]
@Req() req: RawBodyRequest<Request>
@Headers('x-hub-signature-256') signature?: string
```

Upload/query/status metadata:

```typescript
@Post()
@HttpCode(200)
@Header('Content-Type', 'text/plain')
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    this.inbound.verifySignature(req.rawBody, signature);
    this.logger.log('Verified WhatsApp webhook received');
    await this.inbound.receive(body);
    return 'EVENT_RECEIVED';
  }
```

### POST /api/v1/whatsapp/test

Source: `src/app/module/whatsapp/whatsapp.controller.ts:66` • Handler: `WhatsAppController.test`

Access: `UseGuards(AuthGuard('admin', 'user'))`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Body() dto: WhatsAppTestDto
```

Upload/query/status metadata:

```typescript
@Post('test')
@HttpCode(200)
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    // Only the admin test route falls back to the single .env sender.
    let phoneNumberId =
      this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID') ?? '';
    if (dto.companionId) {
      const companion = await this.prisma.companions.findFirst({
        where: { id: dto.companionId, status: true, whatsappEnabled: true },
      });
      if (!companion?.whatsappPhoneNumberId) {
        throw new NotFoundException('Active WhatsApp companion not found');
      }
      phoneNumberId = companion.whatsappPhoneNumberId;
    }
    const data =
      dto.type === 'text'
        ? await this.whatsapp.sendText(
            phoneNumberId,
            dto.to,
            dto.message ?? 'Hello from Meet Elysia backend',
          )
        : await this.whatsapp.sendTestTemplate(phoneNumberId, dto.to);
    return { message: 'WhatsApp message accepted by Meta', data };
  }
```

### GET /

Source: `src/app.controller.ts:9` • Handler: `AppController.getHello`

Access: `Controller JWT guard নেই`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
@Res() res: Response
```

Upload/query/status metadata:

```typescript
@Get()
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    return res.type('html').send(this.appService.getHello());
  }
```

### GET /api/v1/health/live

Source: `src/health.controller.ts:12` • Handler: `HealthController.live`

Access: `Controller JWT guard নেই`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
// কোনো parameter নেই
```

Upload/query/status metadata:

```typescript
@Get('live')
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    return { status: 'ok' };
  }
```

### GET /api/v1/health/ready

Source: `src/health.controller.ts:15` • Handler: `HealthController.ready`

Access: `Controller JWT guard নেই`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
// কোনো parameter নেই
```

Upload/query/status metadata:

```typescript
@Get('ready')
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

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

### GET /privacy-policy

Source: `src/legal-pages.controller.ts:38` • Handler: `LegalPagesController.privacyPolicy`

Access: `Controller JWT guard নেই`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
// কোনো parameter নেই
```

Upload/query/status metadata:

```typescript
@Get('privacy-policy')
@Header('Content-Type', 'text/html; charset=utf-8')
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    return page(
      'Privacy Policy',
      `
      <p>This policy describes information processed by Meet Elysia through its website, accounts, AI companion features and WhatsApp integration.</p>
      <h2>Information we process</h2>
      <ul>
        <li>Account information such as your email, name, password hash, optional phone number and profile image.</li>
        <li>Messages you send, generated responses, conversation identifiers, selected companions and interaction history.</li>
        <li>For WhatsApp, your sender number, message identifiers, message content and account-linking information received through Meta.</li>
        <li>Subscription status, payment records, payment-provider identifiers, credits and purchases.</li>
        <li>Operational information used to investigate errors, secure accounts and process message delivery.</li>
      </ul>
      <h2>How information is used</h2>
      <p>We use this information to authenticate accounts, link WhatsApp conversations to users and companions, generate and deliver replies, manage subscriptions and credits, provide support and troubleshoot the service. Authorized administrators can access conversations for support and human takeover.</p>
      <h2>Service providers</h2>
      <p>Operating the service involves providers for hosting and database storage, AI processing, email, media storage and payments. Relevant message content and conversation context are sent to the configured AI service when AI replies are enabled. Meta processes WhatsApp messages; Stripe handles payment processing; uploaded profile media may be stored through Cloudinary. These providers process information under their own applicable terms and privacy policies.</p>
      <h2>Storage and retention</h2>
      <p>Account, conversation and transaction information is stored to operate the service. Retention varies by record type and provider; there is no single automatic deletion period for all records. Contact us to request deletion or ask about a particular record. Some records may need to be retained for applicable obligations, dispute resolution or security, and provider backups may follow separate retention schedules.</p>
      <h2>Your choices and requests</h2>
      <p>You may stop messaging the service and contact ${contactLink} to request access, correction or deletion of your information. Follow our <a href="/data-deletion">data deletion instructions</a> to identify the account or WhatsApp data involved. Deleting a chat in WhatsApp does not itself delete records held by Meet Elysia.</p>
      <h2>Security and updates</h2>
      <p>Account passwords are stored as hashes. No online system can guarantee absolute security; do not send passwords, payment card details or other unnecessary sensitive information in companion chats. Updates to this policy will be reflected on this page.</p>
    `,
    );
  }
```

### GET /terms

Source: `src/legal-pages.controller.ts:67` • Handler: `LegalPagesController.terms`

Access: `Controller JWT guard নেই`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
// কোনো parameter নেই
```

Upload/query/status metadata:

```typescript
@Get('terms')
@Header('Content-Type', 'text/html; charset=utf-8')
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    return page(
      'Terms of Service',
      `
      <p>These terms describe use of Meet Elysia's account, companion chat and WhatsApp features. By using the service, you agree to these terms.</p>
      <h2>Accounts and responsible use</h2>
      <p>Provide accurate account information, use only accounts and phone numbers you are authorized to use, and keep your credentials secure. Do not use the service for unlawful activity, harassment, fraud, unauthorized access or interference with other users or systems.</p>
      <h2>Companion conversations</h2>
      <p>Companions are AI-powered characters. Generated responses may be inaccurate or inappropriate and should not be relied on as professional advice or emergency assistance. Authorized administrators may participate through human takeover. Availability and response times can vary.</p>
      <h2>Subscriptions and credits</h2>
      <p>Some features require a subscription or credits. Review the price, renewal terms and purchase details shown at checkout before paying. Contact ${contactLink} for billing, cancellation or refund questions; applicable consumer rights remain unaffected.</p>
      <h2>Your content and privacy</h2>
      <p>Only submit content you have permission to share. You allow the service and its providers to process that content as needed to deliver the requested features. See our <a href="/privacy-policy">Privacy Policy</a> for data handling and our <a href="/data-deletion">Data Deletion</a> page for removal requests.</p>
      <h2>Third-party services and access</h2>
      <p>WhatsApp, payment services and other integrated providers have their own terms. Features may change or become unavailable. Access may be restricted to address abuse, security issues or violations of these terms.</p>
      <h2>Contact and changes</h2>
      <p>Questions or requests to close an account can be sent to ${contactLink}. Revised terms will be posted here with an updated date.</p>
    `,
    );
  }
```

### GET /data-deletion

Source: `src/legal-pages.controller.ts:90` • Handler: `LegalPagesController.dataDeletion`

Access: `Controller JWT guard নেই`

Request parameters (নাম, DTO ও pipe অপরিবর্তিত):

```typescript
// কোনো parameter নেই
```

Upload/query/status metadata:

```typescript
@Get('data-deletion')
@Header('Content-Type', 'text/html; charset=utf-8')
```

Controller response mapping ও service call (সাধারণ JSON response-এর বাইরে success envelope যোগ হয়):

```typescript
{
    return page(
      'Data Deletion Instructions',
      `
      <p>You can request deletion of your Meet Elysia account or data associated with its WhatsApp integration by email.</p>
      <h2>Submit a request</h2>
      <ol>
        <li>Email ${contactLink} with the subject <strong>Meet Elysia Data Deletion Request</strong>.</li>
        <li>Send from your registered email where possible. Include the account email and, for WhatsApp data, your phone number with country code.</li>
        <li>Specify whether you want the entire account deleted or only particular data, such as WhatsApp linking information or conversation history.</li>
      </ol>
      <p>Do not include passwords, one-time codes, access tokens or payment card details.</p>
      <h2>What happens next</h2>
      <p>The support team handles requests manually and may ask for information needed to verify account ownership before processing deletion. Ask in the same email for confirmation of completion and the status of any retained records.</p>
      <h2>Scope and limitations</h2>
      <p>A request can cover your profile, stored conversations and WhatsApp account links. Records subject to applicable retention obligations or needed for disputes or security may require separate handling. Copies held in provider backups may follow their retention schedules.</p>
      <p>Deleting Meet Elysia data does not delete your Facebook or WhatsApp account or copies held by Meta or message recipients. Deleting a WhatsApp chat alone does not submit a deletion request to Meet Elysia. If you have an active subscription, include a cancellation request so support can address billing separately.</p>
      <p>Read our <a href="/privacy-policy">Privacy Policy</a> for an overview of the information processed by the service.</p>
    `,
    );
  }
```

## Request DTO: সব field ও validation

IsOptional থাকলে optional; PartialType(BaseDto) base-এর field optional করে; nested class-ও নিচে আছে। TypeScript ? একাই runtime validation নয়—decorator-ও অনুসরণ করুন। Update DTO-তে inheritance/OmitType থাকলে বাদ দেওয়া field পাঠাবেন না। ApiProperty example production default নয়।

### CreateAuthDto

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

### LoginAuthDto

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

### ForgotPasswordAuthDto

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

### VerifyOtpAuthDto

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

### ResetPasswordAuthDto

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

### ChangePasswordAuthDto

Source: `src/app/module/auth/dto/create-auth.dto.ts`

```typescript
export class ChangePasswordAuthDto {
  @ApiProperty({
    example: 'john@example.com',
  })
  @IsEmail({}, { message: 'Please provide a valid email' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;

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

### UpdateAuthDto

Source: `src/app/module/auth/dto/update-auth.dto.ts`

```typescript
export class UpdateAuthDto extends PartialType(CreateAuthDto) {}
```

### SendMessageDto

Source: `src/app/module/chat/dto/send-message.dto.ts`

```typescript
export class SendMessageDto {
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

### CompanionPersonalityDto

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

### CompanionCommunicationStyleDto

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

### CompanionBackgroundDto

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

### CompanionVisualProfileDto

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

### CompanionVoiceSettingsDto

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

### CompanionVoiceDto

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

### CreateCompanionDto

Source: `src/app/module/companions/dto/create-companion.dto.ts`

```typescript
export class CreateCompanionDto {
  @ApiPropertyOptional({ example: '+15551234567', nullable: true })
  @IsOptional()
  @Matches(/^\+[1-9]\d{6,14}$/)
  whatsappPhoneNumber?: string | null;

  @ApiPropertyOptional({ example: '123456789012345', nullable: true })
  @IsOptional()
  @Matches(/^\d+$/)
  whatsappPhoneNumberId?: string | null;

  @ApiPropertyOptional({ example: 'Elena - AI Companion', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  whatsappDisplayName?: string | null;

  @ApiPropertyOptional({ default: false })
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(toBoolean)
  @IsBoolean()
  whatsappEnabled?: boolean;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(4096)
  whatsappWelcomeMessage?: string | null;

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

### UpdateCompanionPersonalityDto

Source: `src/app/module/companions/dto/update-companion.dto.ts`

```typescript
export class UpdateCompanionPersonalityDto extends PartialType(
  CompanionPersonalityDto,
  { skipNullProperties: false },
) {}
```

### UpdateCompanionCommunicationStyleDto

Source: `src/app/module/companions/dto/update-companion.dto.ts`

```typescript
export class UpdateCompanionCommunicationStyleDto extends PartialType(
  CompanionCommunicationStyleDto,
  { skipNullProperties: false },
) {}
```

### UpdateCompanionBackgroundDto

Source: `src/app/module/companions/dto/update-companion.dto.ts`

```typescript
export class UpdateCompanionBackgroundDto extends PartialType(
  CompanionBackgroundDto,
  { skipNullProperties: false },
) {}
```

### UpdateCompanionVisualProfileDto

Source: `src/app/module/companions/dto/update-companion.dto.ts`

```typescript
export class UpdateCompanionVisualProfileDto extends PartialType(
  CompanionVisualProfileDto,
  { skipNullProperties: false },
) {}
```

### UpdateCompanionVoiceSettingsDto

Source: `src/app/module/companions/dto/update-companion.dto.ts`

```typescript
export class UpdateCompanionVoiceSettingsDto extends PartialType(
  CompanionVoiceSettingsDto,
  { skipNullProperties: false },
) {}
```

### UpdateCompanionVoiceDto

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

### UpdateCompanionDto

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

### UpdateVoiceDto

Source: `src/app/module/companions/dto/update-companion.dto.ts`

```typescript
export class UpdateVoiceDto {
  @ApiProperty({ example: 'your-provider-voice-id' })
  @IsString()
  @IsNotEmpty()
  voiceId: string;
}
```

### CreateCreditPackageDto

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

### UpdateCreditPackageDto

Source: `src/app/module/credit/dto/credit.dto.ts`

```typescript
export class UpdateCreditPackageDto extends PartialType(
  CreateCreditPackageDto,
) {}
```

### PurchaseCreditPackageDto

Source: `src/app/module/credit/dto/credit.dto.ts`

```typescript
export class PurchaseCreditPackageDto {
  @ApiProperty({ example: 'credit-package-id' })
  @IsString()
  @IsNotEmpty()
  packageId!: string;
}
```

### CreateDashboardDto

Source: `src/app/module/dashboard/dto/create-dashboard.dto.ts`

```typescript
export class CreateDashboardDto {}
```

### UpdateDashboardDto

Source: `src/app/module/dashboard/dto/update-dashboard.dto.ts`

```typescript
export class UpdateDashboardDto extends PartialType(CreateDashboardDto) {}
```

### PageDto

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

### RelationshipDto

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

### CostDto

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

### ModeDto

Source: `src/app/module/engagement/engagement.dto.ts`

```typescript
export class ModeDto {
  @ApiProperty({ enum: ['ai', 'human'] })
  @IsIn(['ai', 'human'])
  mode!: 'ai' | 'human';
}
```

### HumanReplyDto

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

### StoryDto

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

### PhotoDto

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

### NotificationDto

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

### CreateGiftDto

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

### UpdateGiftDto

Source: `src/app/module/gift/dto/gift.dto.ts`

```typescript
export class UpdateGiftDto extends PartialType(CreateGiftDto) {}
```

### SendGiftDto

Source: `src/app/module/gift/dto/gift.dto.ts`

```typescript
export class SendGiftDto {
  @ApiProperty({ example: 'companion-id' })
  @IsString()
  @IsNotEmpty()
  companionId!: string;
}
```

### BroadcastNewsletterDto

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

### CreateNewsletterDto

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

### UpdateNewsletterDto

Source: `src/app/module/newsletter/dto/update-newsletter.dto.ts`

```typescript
export class UpdateNewsletterDto extends PartialType(CreateNewsletterDto) {}
```

### BuyCreditsDto

Source: `src/app/module/payment/dto/buy-credits.dto.ts`

```typescript
export class BuyCreditsDto {
  @ApiProperty({ example: 'credit-package-id' })
  @IsString()
  @IsNotEmpty()
  packageId!: string;
}
```

### CreatePaymentDto

Source: `src/app/module/payment/dto/create-payment.dto.ts`

```typescript
export class CreatePaymentDto {}
```

### UpdatePaymentDto

Source: `src/app/module/payment/dto/update-payment.dto.ts`

```typescript
export class UpdatePaymentDto extends PartialType(CreatePaymentDto) {}
```

### CreateSubscriptionDto

Source: `src/app/module/subscription/dto/create-subscription.dto.ts`

```typescript
export class CreateSubscriptionDto {
  @ApiProperty({
    example: 'Premium Plan',
    description: 'Subscription plan name',
  })
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  name: string;

  @ApiProperty({
    example: '29.99',
    description: 'Subscription plan price',
  })
  @IsString()
  @IsNotEmpty({ message: 'Price is required' })
  price: string;

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
  features: string[];

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

### UpdateSubscriptionDto

Source: `src/app/module/subscription/dto/update-subscription.dto.ts`

```typescript
export class UpdateSubscriptionDto extends PartialType(CreateSubscriptionDto) {}
```

### TelegramSessionDto

Source: `src/app/module/telegram/telegram-mini-app.controller.ts`

```typescript
class TelegramSessionDto {
  @IsString() @MinLength(1) @MaxLength(8192) initData!: string;
}
```

### TelegramLoginDto

Source: `src/app/module/telegram/telegram-mini-app.controller.ts`

```typescript
class TelegramLoginDto extends TelegramSessionDto {
  @IsOptional() @IsBoolean() confirmTransfer?: boolean;
  @IsEmail() @MaxLength(254) email!: string;
  @IsString() @MinLength(1) @MaxLength(256) password!: string;
}
```

### CreateUserDto

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

### UpdateUserDto

Source: `src/app/module/user/dto/update-user.dto.ts`

```typescript
export class UpdateUserDto extends PartialType(CreateUserDto) {}
```

### WhatsAppTestDto

Source: `src/app/module/whatsapp/whatsapp.controller.ts`

```typescript
export class WhatsAppTestDto {
  @ApiPropertyOptional({
    description:
      'Use this companion sender. Omit to use the Meta test sender from .env.',
  })
  @IsOptional()
  @IsUUID()
  companionId?: string;

  @ApiProperty({ example: '8801712345678' })
  @Matches(/^[1-9]\d{6,14}$/)
  to!: string;

  @ApiPropertyOptional({ enum: ['template', 'text'], default: 'template' })
  @IsOptional()
  @IsIn(['template', 'text'])
  type?: 'template' | 'text';

  @ApiPropertyOptional({ example: 'Hello from Meet Elysia backend' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  message?: string;
}
```

