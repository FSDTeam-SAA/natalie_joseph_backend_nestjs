import { CompanionsService } from './companions.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { TelegramProfileService } from '../publishing/telegram-profile.service';
import { fileUpload } from '../../helper/fileUploder';

describe('Gallery and photo-library consistency', () => {
  afterEach(() => jest.restoreAllMocks());
  function setup() {
    const tx = {
      $queryRaw: jest.fn(),
      companions: {
        update: jest.fn().mockResolvedValue({ id: 'c' }),
        findUnique: jest
          .fn()
          .mockResolvedValue({ galleryImages: ['https://cdn.test/a.jpg'] }),
      },
      libraryPhoto: { createMany: jest.fn(), updateMany: jest.fn() },
    };
    const prisma = { ...tx, $transaction: jest.fn(async (fn) => fn(tx)) };
    const service = new CompanionsService(
      prisma as unknown as PrismaService,
      {} as TelegramProfileService,
    );
    jest
      .spyOn(service, 'getCompanionById')
      .mockResolvedValue({ id: 'c' } as never);
    const upload = jest
      .spyOn(fileUpload, 'uploadToCloudinary')
      .mockResolvedValue({
        url: 'https://cdn.test/a.jpg',
        public_id: 'asset',
      } as never);
    const cleanup = jest
      .spyOn(fileUpload, 'deleteFromCloudinary')
      .mockResolvedValue(undefined as never);
    const file = {
      mimetype: 'image/jpeg',
      buffer: Buffer.from([255, 216, 255]),
    } as Express.Multer.File;
    return { service, tx, upload, cleanup, file };
  }
  it('atomically adds gallery uploads to the pending library using detected MIME', async () => {
    const { service, tx, file } = setup();
    await service.updateImages('c', 'galleryImages', [file], true);
    expect(tx.libraryPhoto.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          companionId: 'c',
          approved: false,
          tags: [],
          mimeType: 'image/jpeg',
          publicId: 'asset',
        }),
      ],
    });
  });
  it('cleans the uploaded asset when database persistence fails', async () => {
    const { service, tx, file, cleanup } = setup();
    tx.libraryPhoto.createMany.mockRejectedValue(
      new Error('database unavailable'),
    );
    await expect(
      service.updateImages('c', 'galleryImages', [file]),
    ).rejects.toThrow('database unavailable');
    expect(cleanup).toHaveBeenCalledWith('asset');
  });
  it('cleans successful uploads if another upload in the same batch fails', async () => {
    const { service, file, upload, cleanup, tx } = setup();
    upload
      .mockResolvedValueOnce({
        url: 'https://cdn.test/a.jpg',
        public_id: 'first',
      } as never)
      .mockRejectedValueOnce(new Error('upload failed'));
    await expect(
      service.updateImages('c', 'galleryImages', [file, file]),
    ).rejects.toThrow('upload failed');
    expect(cleanup).toHaveBeenCalledWith('first');
    expect(tx.companions.update).not.toHaveBeenCalled();
  });
  it('rejects a fake image before upload', async () => {
    const { service, file, upload } = setup();
    await expect(
      service.updateImages('c', 'galleryImages', [
        { ...file, buffer: Buffer.from('not an image') },
      ]),
    ).rejects.toThrow();
    expect(upload).not.toHaveBeenCalled();
  });
  it('revokes matching library approval when an admin removes a gallery image', async () => {
    const { service, tx, cleanup } = setup();
    await service.removedOneGallaryImage('c', 'https://cdn.test/a.jpg');
    expect(tx.libraryPhoto.updateMany).toHaveBeenCalledWith({
      where: { companionId: 'c', url: 'https://cdn.test/a.jpg' },
      data: { approved: false },
    });
    expect(cleanup).not.toHaveBeenCalled();
  });
});
