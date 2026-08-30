import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { fileUpload } from 'src/app/helper/fileUploder';
import paginationHelper, { IOptions } from 'src/app/helper/pagenation';
import { IFilterParams } from 'src/app/helper/pick';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCompanionDto } from './dto/create-companion.dto';
import { UpdateCompanionDto } from './dto/update-companion.dto';

export interface CompanionFiles {
  profileImage?: Express.Multer.File[];
  coverImage?: Express.Multer.File[];
  galleryImages?: Express.Multer.File[];
}

@Injectable()
export class CompanionsService {
  constructor(private readonly prisma: PrismaService) {}

  async createCompanion(payload: CreateCompanionDto, files: CompanionFiles) {
    const images = await this.uploadImages(files);
    const { profileImage, coverImage, galleryImages, ...data } = payload;

    return this.prisma.companions.create({
      data: {
        ...data,
        profileImage: images.profileImage,
        coverImage: images.coverImage,
        galleryImages: images.galleryImages ?? [],
      },
    });
  }

  async getAllCompanions(params: IFilterParams, options: IOptions) {
    const { page, limit, skip, sortOrder } = paginationHelper(options);
    const allowedSortFields = [
      'name',
      'age',
      'profession',
      'location',
      'status',
    ];
    const sortBy = allowedSortFields.includes(String(options.sortBy))
      ? String(options.sortBy)
      : 'name';

    const where = {
      AND: [
        params.searchTerm
          ? {
              OR: ['name', 'profession', 'location', 'bio'].map((field) => ({
                [field]: {
                  contains: String(params.searchTerm),
                  mode: 'insensitive' as const,
                },
              })),
            }
          : {},
        params.profession ? { profession: String(params.profession) } : {},
        params.location ? { location: String(params.location) } : {},
        params.status !== undefined
          ? { status: String(params.status) === 'true' }
          : {},
        params.interest ? { interests: { has: String(params.interest) } } : {},
        params.personalityTrait
          ? { personalityTraits: { has: String(params.personalityTrait) } }
          : {},
      ],
    };

    const [data, total] = await Promise.all([
      this.prisma.companions.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder === 'asc' ? 'asc' : 'desc' },
      }),
      this.prisma.companions.count({ where }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  async getCompanionById(id: string) {
    const companion = await this.prisma.companions.findUnique({
      where: { id },
    });
    if (!companion) {
      throw new HttpException('Companion not found', HttpStatus.NOT_FOUND);
    }
    return companion;
  }

  async updateCompanion(
    id: string,
    payload: UpdateCompanionDto,
    files: CompanionFiles,
  ) {
    const companion = await this.getCompanionById(id);
    const images = await this.uploadImages(files);
    const { profileImage, coverImage, galleryImages, ...data } = payload;

    return this.prisma.companions.update({
      where: { id },
      data: {
        ...data,
        profileImage: images.profileImage ?? companion.profileImage,
        coverImage: images.coverImage ?? companion.coverImage,
        galleryImages: images.galleryImages ?? companion.galleryImages,
      },
    });
  }

  async deleteCompanion(id: string) {
    await this.getCompanionById(id);
    return this.prisma.companions.delete({ where: { id } });
  }

  private async uploadImages(files: CompanionFiles) {
    const profileFile = files.profileImage?.[0];
    const coverFile = files.coverImage?.[0];
    const galleryFiles = files.galleryImages;

    const [profile, cover, gallery] = await Promise.all([
      profileFile ? fileUpload.uploadToCloudinary(profileFile) : undefined,
      coverFile ? fileUpload.uploadToCloudinary(coverFile) : undefined,
      galleryFiles
        ? Promise.all(
            galleryFiles.map((file) => fileUpload.uploadToCloudinary(file)),
          )
        : undefined,
    ]);

    return {
      profileImage: profile?.url,
      coverImage: cover?.url,
      galleryImages: gallery?.map((image) => image.url),
    };
  }
}
