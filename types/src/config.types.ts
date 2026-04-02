import { z } from "zod";
import { cameraMovementsEnum } from "./constants.types";

const backgroundSchema = z.object({
  max_volume: z.number().positive(),
  min_volume: z.number().positive(),
  music_map: z.string().optional(),
  music: z
    .record(z.string(), z.union([z.string(), z.array(z.string())]))
    .optional(),
});

const graphicsSchema = z.object({
  item_types: z.array(
    z.union([
      z.literal("text"),
      z.literal("image"),
      z.literal("video"),
      z.literal("map"),
    ])
  ),
});

const manuscriptConfigSchema = z.object({
  split_article_into_chapters: z.boolean(),
  intro: z.string().optional(),
  outro: z.string().optional(),
  script_prompt: z.string(),
  placement_prompt: z.string(),
  describe_images_prompt: z.string(),
});

const personSchema = z.object({
  voice: z.string(),
  stability: z.number(),
  similarity_boost: z.number(),
  style: z.number(),
  use_speaker_boost: z.boolean(),
});

const audioSchema = z.object({
  tts: z.union([z.literal("elevenlabs"), z.literal("google")]),
  background: backgroundSchema,
  sync_silence: z.number(),
  segment_pause: z.number(),
  segment_pause_silence: z.number(),
});

const peopleSchema = z.object({
  default: personSchema,
  intro: personSchema.optional(),
  outro: personSchema.optional(),
});

const styleSchema = z.object({
  captions: z
    .object({
      container: z.string().optional(),
      text: z.string().optional(),
      placements: z
        .object({
          top: z.string().optional(),
          middle: z.string().optional(),
          bottom: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  photoCredits: z
    .object({
      container: z.string().optional(),
      text: z.string().optional(),
    })
    .optional(),
  progress: z
    .object({
      active: z.string(),
      inactive: z.string(),
    })
    .optional(),
  map: z
    .object({
      marker: z.object({
        color: z.string(),
        scale: z.number(),
      }),
    })
    .optional(),
});

const stylesSchema = z.object({
  all: styleSchema.optional(),
  portrait: styleSchema.optional(),
  landscape: styleSchema.optional(),
});

export const colorsSchema = z.object({
  text: z.object({
    text: z.string(),
    background: z.string(),
  }),
  progress: z.object({
    active: z.object({
      background: z.string(),
      text: z.string(),
    }),
    inactive: z.object({
      background: z.string(),
      text: z.string(),
    }),
  }),
  map: z.object({
    marker: z.string(),
  }),
  fotoCredits: z.object({
    text: z.string(),
    icon: z.string(),
  }),
});

export const customCutsSchema = z.object({
  portrait: z.string(),
  landscape: z.string(),
  duration: z.number(),
  offset: z.number(),
});

export const reporterVideoSchema = z.object({
  // Renamed from videoSchema
  // This is for reporter videos
  portrait: z.string(),
  landscape: z.string(),
  duration: z.number(),
  selected: z.boolean().optional(),
});

const reporterVideosSchema = z.object({
  intro: z.record(z.string(), reporterVideoSchema).optional(),
  outro: z.record(z.string(), reporterVideoSchema).optional(),
});

const fontsSchema = z.record(z.string(), z.string());

export const playerSchema = z.object({
  assetBaseUrl: z.string().optional(),
  logo: z.string(),
  logoStyle: z.string().optional(),
  defaultCameraMovements: z.array(cameraMovementsEnum).optional(),
  fonts: fontsSchema.optional(),
  styles: stylesSchema.optional(),
  colors: colorsSchema.optional(),
  backgroundMusicVolume: z.number().optional(),
  backgroundMusic: z.string().optional(),
  moodMusic: z
    .record(z.string(), z.union([z.string(), z.array(z.string())]))
    .optional(),
  intro: customCutsSchema.optional(),
  wipe: customCutsSchema.optional(),
  outro: customCutsSchema.optional(),
  reporterVideos: reporterVideosSchema.optional(),
});

const streamSchema = z.object({
  enabled: z.boolean(),
  provider: z.string(),
  providerTitle: z.string(),
  titlePrefix: z.string(),
  verticalCategory: z.number(),
  horizontalCategory: z.number(),
});

const exportDefaultsSchema = z.object({
  exportType: z.string().optional(),
  logo: z.boolean().optional(),
  audio: z.boolean().optional(),
  voice: z.boolean().optional(),
  music: z.boolean().optional(),
});

const configSchema = z.object({
  name: z.string(),
  description: z.string(),
  id: z.string(),
  people: peopleSchema,
  manuscript: manuscriptConfigSchema,
  graphics: graphicsSchema,
  audio: audioSchema,
  player: playerSchema.optional(),
  stream: streamSchema.optional(),
  exportDefaults: exportDefaultsSchema.optional(),
  path: z.string().optional(),
  default_assets_base_url: z.string(),
});

export const appConfigSchema = configSchema.extend({
  player: playerSchema.optional(),
  stream: streamSchema.optional(),
  path: z.string().optional(),
});

export type Config = z.infer<typeof appConfigSchema>;
