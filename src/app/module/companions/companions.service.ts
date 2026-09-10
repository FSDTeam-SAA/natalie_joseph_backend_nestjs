import { companionProfileSelect } from './companion-profile';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { Prisma } from '../../../../prisma/generated/prisma/client';
import { fileUpload } from 'src/app/helper/fileUploder';
import paginationHelper, { IOptions } from 'src/app/helper/pagenation';
import { IFilterParams } from 'src/app/helper/pick';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CreateCompanionDto,
  CompanionPersonalityDto,
  CompanionCommunicationStyleDto,
  CompanionBackgroundDto,
  CompanionVisualProfileDto,
  CompanionVoiceDto,
} from './dto/create-companion.dto';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { UpdateCompanionDto } from './dto/update-companion.dto';

@Injectable()
export class CompanionsService {
  constructor(private readonly prisma: PrismaService) {}

  async createCompanion(payload: CreateCompanionDto) {
    const {
      personality,
      communicationStyle,
      background,
      visualProfile,
      voice,
      ...data
    } = payload;
    return this.prisma.companions.create({
      data: {
        ...data,
        galleryImages: data.galleryImages ?? [],
        personality: personality ? { create: personality } : undefined,
        communicationStyle: communicationStyle
          ? { create: communicationStyle }
          : undefined,
        background: background ? { create: background } : undefined,
        visualProfile: visualProfile ? { create: visualProfile } : undefined,
        voice: voice
          ? {
              create: {
                ...voice,
                settings: voice.settings
                  ? { create: voice.settings }
                  : undefined,
              },
            }
          : undefined,
      },
      select: companionProfileSelect,
    });
  }

  async getAllCompanions(params: IFilterParams, options: IOptions) {
    for (const value of [options.page, options.limit]) {
      if (
        value !== undefined &&
        (!Number.isSafeInteger(Number(value)) || Number(value) < 1)
      ) {
        throw new HttpException(
          'page and limit must be positive integers',
          HttpStatus.BAD_REQUEST,
        );
      }
    }
    const { page, limit, skip, sortBy, sortOrder } = paginationHelper(options);
    const allowedSorts = [
      'name',
      'version',
      'title',
      'age',
      'status',
      'createdAt',
      'updatedAt',
    ];
    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      !allowedSorts.includes(sortBy) ||
      !['asc', 'desc'].includes(sortOrder)
    ) {
      throw new HttpException(
        'Invalid pagination or sorting options',
        HttpStatus.BAD_REQUEST,
      );
    }
    for (const [key, value] of Object.entries(params)) {
      if (
        typeof value !== 'string' &&
        !(key === 'status' && typeof value === 'boolean')
      ) {
        throw new HttpException(
          'Filters must be single values',
          HttpStatus.BAD_REQUEST,
        );
      }
    }
    const whereConditions: Prisma.CompanionsWhereInput = {};
    const contains = (value: string) => ({
      contains: value,
      mode: 'insensitive' as const,
    });
    if (params.searchTerm) {
      const search = contains(params.searchTerm);
      whereConditions.OR = [
        { name: search },
        { title: search },
        { backstory: search },
        {
          background: {
            is: { OR: [{ occupation: search }, { location: search }] },
          },
        },
        {
          personality: { is: { OR: [{ about: search }, { essence: search }] } },
        },
        { communicationStyle: { is: { topicsSheEnjoys: search } } },
      ];
    }
    for (const field of ['name', 'title', 'backstory'] as const) {
      if (params[field]) whereConditions[field] = contains(params[field]);
    }
    if (params.status !== undefined) {
      if (![true, false, 'true', 'false'].includes(params.status)) {
        throw new HttpException(
          'status must be true or false',
          HttpStatus.BAD_REQUEST,
        );
      }
      whereConditions.status =
        params.status === true || params.status === 'true';
    }
    if (params.interest) whereConditions.interests = { has: params.interest };
    if (params.personalityTrait)
      whereConditions.personality = {
        is: { traits: { has: params.personalityTrait } },
      };
    if (params.location || params.occupation || params.profession) {
      whereConditions.background = {
        is: {
          ...(params.location ? { location: contains(params.location) } : {}),
          ...(params.occupation || params.profession
            ? { occupation: contains(params.occupation || params.profession) }
            : {}),
        },
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.companions.findMany({
        where: whereConditions,
        select: companionProfileSelect,
        skip,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder,
        },
      }),
      this.prisma.companions.count({ where: whereConditions }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  async getCompanionById(id: string) {
    const companion = await this.prisma.companions.findUnique({
      where: { id },
      select: companionProfileSelect,
    });
    if (!companion) {
      throw new HttpException('Companion not found', HttpStatus.NOT_FOUND);
    }
    return companion;
  }

  async updateCompanion(id: string, payload: UpdateCompanionDto) {
    const existing = await this.getCompanionById(id);
    const {
      personality: personalityPatch,
      communicationStyle: communicationPatch,
      background: backgroundPatch,
      visualProfile: visualPatch,
      voice: voicePatch,
      ...data
    } = payload;
    const personality = this.mergeNested(
      CompanionPersonalityDto,
      existing.personality,
      personalityPatch,
    );
    const communicationStyle = this.mergeNested(
      CompanionCommunicationStyleDto,
      existing.communicationStyle,
      communicationPatch,
    );
    const background = this.mergeNested(
      CompanionBackgroundDto,
      existing.background,
      backgroundPatch,
    );
    const visualProfile = this.mergeNested(
      CompanionVisualProfileDto,
      existing.visualProfile,
      visualPatch,
    );
    const voice = this.mergeNested(
      CompanionVoiceDto,
      existing.voice,
      voicePatch
        ? {
            ...voicePatch,
            settings: voicePatch.settings
              ? {
                  ...existing.voice?.settings,
                  ...this.definedFields(voicePatch.settings),
                }
              : (existing.voice?.settings ?? undefined),
          }
        : undefined,
    );

    return this.prisma.companions.update({
      where: { id },
      data: {
        ...data,
        personality: personality
          ? { upsert: { create: personality, update: personality } }
          : undefined,
        communicationStyle: communicationStyle
          ? {
              upsert: {
                create: communicationStyle,
                update: communicationStyle,
              },
            }
          : undefined,
        background: background
          ? { upsert: { create: background, update: background } }
          : undefined,
        visualProfile: visualProfile
          ? { upsert: { create: visualProfile, update: visualProfile } }
          : undefined,
        voice: voice
          ? {
              upsert: {
                create: {
                  ...voice,
                  settings: voice.settings
                    ? { create: voice.settings }
                    : undefined,
                },
                update: {
                  ...voice,
                  settings: voice.settings
                    ? {
                        upsert: {
                          create: voice.settings,
                          update: voice.settings,
                        },
                      }
                    : undefined,
                },
              },
            }
          : undefined,
      },
      select: companionProfileSelect,
    });
  }

  async deleteCompanion(id: string) {
    await this.getCompanionById(id);
    return this.prisma.companions.delete({ where: { id } });
  }

  private definedFields(value: object) {
    return Object.fromEntries(
      Object.entries(value).filter(([, item]) => item !== undefined),
    );
  }

  private mergeNested<T extends object>(
    type: new () => T,
    existing: object | null,
    patch: object | undefined | null,
  ): T | undefined {
    if (!patch) return undefined;
    const value = plainToInstance(type, {
      ...existing,
      ...this.definedFields(patch),
    });
    const errors = validateSync(value, { whitelist: true });
    if (errors.length) {
      throw new HttpException(
        { message: 'Incomplete or invalid companion details', errors },
        HttpStatus.BAD_REQUEST,
      );
    }
    return value;
  }

  async updateImages(
    id: string,
    field: 'profileImage' | 'coverImage' | 'galleryImages',
    files: Express.Multer.File[],
    append = false,
  ) {
    await this.getCompanionById(id);
    const maxCount = field === 'galleryImages' ? 10 : 1;
    if (!files.length || files.length > maxCount) {
      throw new HttpException(
        'Provide 1 to ' + maxCount + ' files for ' + field,
        HttpStatus.BAD_REQUEST,
      );
    }
    if (files.some((file) => !file.mimetype.startsWith('image/'))) {
      throw new HttpException(
        'Only image files are allowed',
        HttpStatus.BAD_REQUEST,
      );
    }
    const images = await Promise.all(
      files.map((file) => fileUpload.uploadToCloudinary(file)),
    );
    const urls = images.map((image) => image.url);
    return this.prisma.companions.update({
      where: { id },
      data:
        field === 'galleryImages'
          ? { galleryImages: append ? { push: urls } : { set: urls } }
          : { [field]: urls[0] },
      select: companionProfileSelect,
    });
  }
}
