import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import * as jwt from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Request, Response } from 'express';
import config from 'src/app/config';
import sendMailer from 'src/app/helper/sendMailer';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateAuthDto, LoginAuthDto } from './dto/create-auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: jwt.JwtService,
  ) {}

  async register(createAuthDto: CreateAuthDto) {
    const user = await this.prisma.user.findUnique({
      where: {
        email: createAuthDto.email,
      },
    });
    if (user) {
      throw new HttpException('User already exists', HttpStatus.BAD_REQUEST);
    }
    const hashedPassword = await bcrypt.hash(createAuthDto.password, 10);
    const result = await this.prisma.user.create({
      data: {
        name: createAuthDto.name,
        email: createAuthDto.email,
        password: hashedPassword,
        phoneNumber: createAuthDto.phoneNumber,
      },
    });

    if (!result) {
      throw new HttpException('User not created', HttpStatus.BAD_REQUEST);
    }
    return result;
  }

  async login(loginAuthDto: LoginAuthDto, res: Response) {
    const user = await this.prisma.user.findUnique({
      where: {
        email: loginAuthDto.email,
      },
    });
    if (!user) {
      throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
    }
    const isPasswordValid = await bcrypt.compare(
      loginAuthDto.password,
      user.password,
    );
    if (!isPasswordValid) {
      throw new HttpException('Invalid password', HttpStatus.BAD_REQUEST);
    }

    const accessToken = this.jwtService.sign(
      { id: user.id, role: user.role, email: user.email },
      {
        secret: config.jwt.accessTokenSecret,
        expiresIn: config.jwt.accessTokenExpires as any,
      } as jwt.JwtSignOptions,
    );

    const refreshToken = this.jwtService.sign(
      { id: user.id, role: user.role, email: user.email },
      {
        secret: config.jwt.refreshTokenSecret,
        expiresIn: config.jwt.refreshTokenExpires as any,
      } as jwt.JwtSignOptions,
    );

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
    });

    return { accessToken, user };
  }

  async refreshToken(req: Request) {
    const token = req.cookies?.refreshToken;
    if (!token) {
      throw new HttpException('Token not found', HttpStatus.BAD_REQUEST);
    }
    const decodedToken = this.jwtService.verify(token, {
      secret: config.jwt.refreshTokenSecret,
    });
    const user = await this.prisma.user.findUnique({
      where: {
        id: decodedToken.id,
      },
    });
    if (!user) {
      throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
    }
    const accessToken = this.jwtService.sign(
      { id: user.id, role: user.role, email: user.email },
      {
        secret: config.jwt.accessTokenSecret,
        expiresIn: config.jwt.accessTokenExpires as any,
      } as jwt.JwtSignOptions,
    );
    return { accessToken, user };
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        email,
      },
    });
    if (!user) {
      throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
    }
    const generateOtpNumber = Math.floor(
      100000 + Math.random() * 900000,
    ).toString(); // Random 6 digit otp
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // OTP valid for 10 minutes
    await this.prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        otp: generateOtpNumber,
        otpExpiry,
      },
    });
    const html = `
    <div style="font-family: Arial; text-align: center;">
      <h2 style="color:#4f46e5;">Password Reset OTP</h2>
      <p>Your OTP code is:</p>
      <h1 style="letter-spacing:4px;">${generateOtpNumber}</h1>
      <p>This code will expire in 1 hour.</p>
    </div>
  `;
    await sendMailer(user.email, 'Password Reset OTP', html);
    return { message: 'OTP sent to your email' };
  }

  async verifyOtp(email: string, otp: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        email,
      },
    });
    if (!user) {
      throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
    }
    if (!user.otp || user.otp !== otp) {
      throw new HttpException('Invalid OTP', HttpStatus.BAD_REQUEST);
    }
    if (!user.otpExpiry || user.otpExpiry < new Date()) {
      throw new HttpException('OTP expired', HttpStatus.BAD_REQUEST);
    }
    await this.prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        otp: null,
        otpExpiry: null,
        verifiedForgot: true,
      },
    });
    return { message: 'OTP verified successfully' };
  }

  async resetPassword(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        email,
      },
    });
    if (!user) {
      throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
    }
    if (!user.verifiedForgot) {
      throw new HttpException(
        'Please verify OTP first',
        HttpStatus.BAD_REQUEST,
      );
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    await this.prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        password: hashedPassword,
        verifiedForgot: false,
      },
    });
    return { message: 'Password reset successfully' };
  }

  async changePassword(
    email: string,
    oldPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: {
        email,
      },
    });
    if (!user) {
      throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
    }
    const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isPasswordValid) {
      throw new HttpException('Invalid password', HttpStatus.BAD_REQUEST);
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        password: hashedPassword,
      },
    });
    return { message: 'Password changed successfully' };
  }

  async logout(req: Request, res: Response) {
    const token = req.cookies?.refreshToken;
    if (!token) {
      throw new HttpException('Token not found', HttpStatus.BAD_REQUEST);
    }
    const decodedToken = this.jwtService.verify(token, {
      secret: config.jwt.refreshTokenSecret,
    });
    const user = await this.prisma.user.findUnique({
      where: {
        id: decodedToken.id,
      },
    });
    if (!user) {
      throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
    }
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    return { message: 'Logout successfully' };
  }
}
