import { LifestyleService } from './lifestyle.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreditService } from '../credit/credit.service';
import { Prisma } from '../../../../prisma/generated/prisma/client';
import type { AiReply } from '../../helper/ai/aiapi';

describe('Approved photo library boundaries', () => {
  const service = new LifestyleService(
    {} as PrismaService,
    {} as CreditService,
  );
  const reply = (
    url = 'https://res.cloudinary.com/demo/image.jpg',
  ): AiReply => ({
    message_id: 'message',
    conversation_id: 'conversation',
    companion_id: 'companion',
    created_at: new Date().toISOString(),
    message_type: 'image',
    response: '',
    media: {
      id: '0ebca95e-37a4-43c4-ac07-2e2a5ee25c9e',
      url,
      kind: 'image',
      mime_type: 'image/jpeg',
      byte_size: 100,
    },
  });
  it('restricts lookup to the companion, approved and unseen photos, requiring every requested tag', async () => {
    const tx = { $queryRaw: jest.fn().mockResolvedValue([]) };
    expect(
      await service.matchPhoto(
        tx as unknown as Prisma.TransactionClient,
        'user',
        'companion',
        ['gym', 'red'],
      ),
    ).toBeNull();
    const [sql, ...values] = tx.$queryRaw.mock.calls[0];
    expect(sql.join('')).toContain('p.approved=true');
    expect(sql.join('')).toContain('p.tags @>');
    expect(sql.join('')).toContain('NOT EXISTS');
    expect(values).toEqual(['companion', ['gym', 'red'], 'user', 'companion']);
  });
  it('retains a durable generated image as pending, never approved', async () => {
    const tx = { libraryPhoto: { upsert: jest.fn() } };
    await service.retainGeneratedPhoto(
      tx as unknown as Prisma.TransactionClient,
      'companion',
      reply(),
      ['gym'],
    );
    expect(tx.libraryPhoto.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          approved: false,
          companionId: 'companion',
          tags: ['gym'],
        }),
        update: {},
      }),
    );
  });
  it.each([
    'https://ai.test/api/v1/media/private',
    'https://cdn.test/a.jpg?signature=expires',
    'http://cdn.test/a.jpg',
  ])('does not share private or temporary media: %s', async (url) => {
    const tx = { libraryPhoto: { upsert: jest.fn() } };
    await service.retainGeneratedPhoto(
      tx as unknown as Prisma.TransactionClient,
      'companion',
      reply(url),
      [],
    );
    expect(tx.libraryPhoto.upsert).not.toHaveBeenCalled();
  });
  it('imports only missing gallery URLs as pending, scoped to the companion', async () => {
    const tx = {
      $queryRaw: jest.fn(),
      companions: {
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({
            galleryImages: [
              'https://cdn.test/old.jpg',
              'https://cdn.test/new.png',
            ],
          }),
      },
      libraryPhoto: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ url: 'https://cdn.test/old.jpg' }]),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = {
      companions: { findFirst: jest.fn().mockResolvedValue({ id: 'c' }) },
      $transaction: jest.fn(async (fn) => fn(tx)),
    };
    const library = new LifestyleService(
      prisma as unknown as PrismaService,
      {} as CreditService,
    );
    expect(await library.importGallery('c')).toEqual({ imported: 1 });
    expect(tx.libraryPhoto.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          url: 'https://cdn.test/new.png',
          approved: false,
          mimeType: 'image/png',
        }),
      ],
    });
  });
  it('does not delete a daily-content photo or another companion photo', async () => {
    const prisma = {
      libraryPhoto: {
        deleteMany: jest
          .fn()
          .mockRejectedValue(
            new Prisma.PrismaClientKnownRequestError('Referenced photo', {
              code: 'P2003',
              clientVersion: 'test',
            }),
          ),
      },
    };
    const library = new LifestyleService(
      prisma as unknown as PrismaService,
      {} as CreditService,
    );
    await expect(library.removePhoto('c', 'p')).rejects.toThrow(
      'daily content',
    );
    expect(prisma.libraryPhoto.deleteMany).toHaveBeenCalledWith({
      where: { id: 'p', companionId: 'c' },
    });
  });
});
