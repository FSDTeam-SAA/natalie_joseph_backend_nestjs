import { Test } from '@nestjs/testing';
import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../../../prisma/prisma.module';
import { PrismaService } from '../../../prisma/prisma.service';
import { ChatModule } from './chat.module';
import { ChatService } from './chat.service';
import {
  LifestyleAdminController,
  LifestyleController,
} from '../lifestyle/lifestyle.controller';

@Global()
@Module({ imports: [JwtModule.register({})], exports: [JwtModule] })
class TestAuthModule {}

describe('Photo route dependency wiring', () => {
  it('constructs chat and both lifestyle controllers without a circular dependency or a database connection', async () => {
    const module = await Test.createTestingModule({
      imports: [PrismaModule, TestAuthModule, ChatModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();
    expect(module.get(ChatService)).toBeDefined();
    expect(module.get(LifestyleController)).toBeDefined();
    expect(module.get(LifestyleAdminController)).toBeDefined();
    await module.close();
  });
});
