import type { Prisma } from '../../../../prisma/generated/prisma/client';

// Shared public profile shape; excludes relation IDs and database timestamps.
export const companionProfileSelect = {
  name: true,
  version: true,
  title: true,
  age: true,
  backstory: true,
  voiceDescription: true,
  profileImage: true,
  coverImage: true,
  galleryImages: true,
  status: true,
  interests: true,
  personality: {
    select: {
      traits: true,
      about: true,
      essence: true,
      sharedTraits: true,
    },
  },
  communicationStyle: {
    select: {
      styleTraits: true,
      topicsSheEnjoys: true,
      whatYouExperience: true,
    },
  },
  background: {
    select: {
      location: true,
      occupation: true,
      lifestyle: true,
    },
  },
  visualProfile: {
    select: {
      aestheticKeywords: true,
      note: true,
      referenceImages: true,
      physicalIdentity: true,
      generationInstructions: true,
    },
  },
  voice: {
    select: {
      provider: true,
      voiceId: true,
      settings: {
        select: {
          stability: true,
          similarityBoost: true,
          style: true,
          useSpeakerBoost: true,
          speed: true,
        },
      },
    },
  },
} as const satisfies Prisma.CompanionsSelect;

export type CompanionProfile = Prisma.CompanionsGetPayload<{
  select: typeof companionProfileSelect;
}>;
