import { readdir, readFile } from "node:fs/promises";
import type { Config } from "@videofy/types";
import { buildDefaultConfig } from "@/lib/defaultConfig";
import {
  GenerationManifest,
  configOverridePath,
  configRoot,
  readJson,
} from "@/lib/projectFiles";

function deepMerge(base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    const current = out[k];
    if (
      current &&
      typeof current === "object" &&
      !Array.isArray(current) &&
      v &&
      typeof v === "object" &&
      !Array.isArray(v)
    ) {
      out[k] = deepMerge(current as Record<string, unknown>, v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

async function readObject(filePath: string): Promise<Record<string, unknown>> {
  try {
    const raw = await readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

async function readBrandObject(brandId: string): Promise<Record<string, unknown>> {
  const brandsDir = configRoot();
  const directPath = `${brandsDir}/${brandId}.json`;
  const direct = await readObject(directPath);
  if (Object.keys(direct).length > 0) {
    return direct;
  }

  try {
    const entries = await readdir(brandsDir, { withFileTypes: true });
    const jsonFiles = entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));
    if (jsonFiles.length === 0) {
      return {};
    }
    const fallback =
      jsonFiles.find((fileName) => fileName.toLowerCase() === "default.json") || jsonFiles[0];
    return await readObject(`${brandsDir}/${fallback}`);
  } catch {
    return {};
  }
}

export async function resolveConfigForProject(
  projectId: string,
  manifest: GenerationManifest
): Promise<Config> {
  const brand = await readBrandObject(manifest.brandId);
  const override = await readJson<Record<string, unknown>>(configOverridePath(projectId), {});

  const merged = brand;

  const config = buildDefaultConfig(projectId);
  const prompts = (merged.prompts || {}) as Record<string, unknown>;
  const brandPeople = (brand.people || {}) as Record<string, unknown>;
  const people = brandPeople;
  const defaultPerson = ((people.default || {}) as Record<string, unknown>);
  const options = (merged.options || {}) as Record<string, unknown>;

  config.manuscript.script_prompt =
    (prompts.scriptPrompt as string) || config.manuscript.script_prompt;
  config.manuscript.placement_prompt =
    (prompts.placementPrompt as string) || config.manuscript.placement_prompt;
  config.manuscript.describe_images_prompt =
    (prompts.describeImagesPrompt as string) || config.manuscript.describe_images_prompt;

  if (brandPeople && typeof brandPeople === "object") {
    config.people = deepMerge(
      (config.people || {}) as Record<string, unknown>,
      brandPeople as Record<string, unknown>
    ) as Config["people"];
  }

  if (typeof defaultPerson.voice === "string" && defaultPerson.voice) {
    config.people.default.voice = defaultPerson.voice;
  }

  if (typeof defaultPerson.stability === "number") {
    config.people.default.stability = defaultPerson.stability;
  }
  if (typeof defaultPerson.similarity_boost === "number") {
    config.people.default.similarity_boost = defaultPerson.similarity_boost;
  }
  if (typeof defaultPerson.style === "number") {
    config.people.default.style = defaultPerson.style;
  }
  if (typeof defaultPerson.use_speaker_boost === "boolean") {
    config.people.default.use_speaker_boost = defaultPerson.use_speaker_boost;
  }

  if (typeof options.segmentPauseSeconds === "number") {
    config.audio.segment_pause = options.segmentPauseSeconds;
  }

  if (merged.player && typeof merged.player === "object") {
    config.player = deepMerge(
      (config.player || {}) as Record<string, unknown>,
      merged.player as Record<string, unknown>
    ) as Config["player"];
  }

  config.player = {
    ...(config.player || {}),
    logo: config.player?.logo || "/assets/logo.svg",
    assetBaseUrl:
      process.env.NEXT_PUBLIC_CMS_BASE_URL || "http://127.0.0.1:3000",
  };

  if (merged.exportDefaults && typeof merged.exportDefaults === "object") {
    config.exportDefaults = deepMerge(
      (config.exportDefaults || {}) as Record<string, unknown>,
      merged.exportDefaults as Record<string, unknown>
    ) as Config["exportDefaults"];
  }

  const fileBase = process.env.MINIMAL_FILE_BASE_URL || "http://127.0.0.1:8001";
  config.default_assets_base_url = `${fileBase}/projects/${projectId}/files/input`;

  if (override && Object.keys(override).length > 0) {
    return deepMerge(config as unknown as Record<string, unknown>, override) as unknown as Config;
  }

  return config;
}
