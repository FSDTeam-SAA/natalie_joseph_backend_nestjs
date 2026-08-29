import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { AuthGuard } from 'src/app/middlewares/auth.guard';
import { AuthService } from './auth.service';

import {
  ChangePasswordAuthDto,
  CreateAuthDto,
  ForgotPasswordAuthDto,
  LoginAuthDto,
  ResetPasswordAuthDto,
  VerifyOtpAuthDto,
} from './dto/create-auth.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Register
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
  async register(@Body() createAuthDto: CreateAuthDto) {
    const result = await this.authService.register(createAuthDto);

    return {
      message: 'User registered successfully',
      data: result,
    };
  }

  // Login
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
  async login(
    @Body() loginAuthDto: LoginAuthDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(loginAuthDto, res);

    return {
      message: 'Login successfully',
      data: result,
    };
  }

  // Refresh Token
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
  async refreshToken(@Req() req: Request) {
    const result = await this.authService.refreshToken(req);

    return {
      message: 'Token refreshed successfully',
      data: result,
    };
  }

  // Forgot Password
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
  async forgotPassword(@Body() forgotPasswordAuthDto: ForgotPasswordAuthDto) {
    const result = await this.authService.forgotPassword(
      forgotPasswordAuthDto.email,
    );

    return {
      message: 'OTP sent successfully',
      data: result,
    };
  }

  // Verify OTP
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
  async verifyOtp(@Body() verifyOtpAuthDto: VerifyOtpAuthDto) {
    const result = await this.authService.verifyOtp(
      verifyOtpAuthDto.email,
      verifyOtpAuthDto.otp,
    );

    return {
      message: 'OTP verified successfully',
      data: result,
    };
  }

  // Reset Password
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
  async resetPassword(@Body() resetPasswordAuthDto: ResetPasswordAuthDto) {
    const result = await this.authService.resetPassword(
      resetPasswordAuthDto.email,
      resetPasswordAuthDto.password,
    );

    return {
      message: 'Password reset successfully',
      data: result,
    };
  }

  // Change Password
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
  async changePassword(@Body() changePasswordAuthDto: ChangePasswordAuthDto) {
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

  // Logout
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
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.logout(req, res);

    return {
      message: 'Logout successfully',
      data: result,
    };
  }
}
