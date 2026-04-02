import { NextRequest, NextResponse } from "next/server";
import { appConfigSchema, manuscriptSchema } from "@videofy/types";
import { z } from "zod";
import { cmsGenerationPath, listProjectIds, readJson, writeJson } from "@/lib/projectFiles";

const projectIdSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/);

const generationTabSchema = z.object({
  articleUrl: z.string().min(1),
  manuscript: manuscriptSchema,
  projectId: projectIdSchema.optional(),
  backendGenerationId: z.string().min(1).optional(),
});

type GenerationTab = z.infer<typeof generationTabSchema>;
type GenerationConfig = z.infer<typeof appConfigSchema>;

type GenerationRecord = {
  id: string;
  projectId: string;
  data: GenerationTab[];
  config?: GenerationConfig;
  brandId?: string;
  project?: {
    id: string;
    name: string;
  };
  createdDate: string;
  updatedAt: string;
};

const postBodySchema = z.object({
  projectId: projectIdSchema.optional(),
  data: z.array(generationTabSchema).min(1),
  config: appConfigSchema.optional(),
  brandId: projectIdSchema.optional(),
  project: z
    .object({
      id: z.string().min(1),
      name: z.string().min(1),
    })
    .optional(),
});

const putBodySchema = z.object({
  id: z.string().min(1),
  data: z.array(generationTabSchema),
});

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Unexpected error";
}

function normalizeId(rawId: string): string {
  let decodedId = "";
  try {
    decodedId = decodeURIComponent(rawId);
  } catch {
    throw new Error("Invalid generation id");
  }

  if (!projectIdSchema.safeParse(decodedId).success) {
    throw new Error("Invalid generation id");
  }

  return decodedId;
}

export async function POST(req: NextRequest) {
  try {
    const body = postBodySchema.parse(await req.json());
    const firstTab = body.data[0];
    const fallbackProjectId = firstTab?.projectId || firstTab?.articleUrl;
    const projectId = body.projectId || fallbackProjectId;

    if (!projectId || typeof projectId !== "string") {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const generation: GenerationRecord = {
      id: projectId,
      projectId,
      data: body.data,
      config: body.config,
      brandId: body.brandId,
      project: body.project || { id: projectId, name: projectId },
      createdDate: now,
      updatedAt: now,
    };

    await writeJson(cmsGenerationPath(projectId), generation);
    return NextResponse.json({ id: generation.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: toErrorMessage(error) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  try {
    const projectId = normalizeId(id);
    const generation = await readJson<GenerationRecord | null>(
      cmsGenerationPath(projectId),
      null
    );

    if (!generation) {
      return NextResponse.json({ error: "Generation not found" }, { status: 404 });
    }

    return NextResponse.json(generation);
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid generation id") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: toErrorMessage(error) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = putBodySchema.parse(await req.json());
    const projectId = normalizeId(body.id);

    const existing = await readJson<GenerationRecord | null>(
      cmsGenerationPath(projectId),
      null
    );

    if (!existing) {
      const knownProjects = await listProjectIds();
      if (!knownProjects.includes(projectId)) {
        return NextResponse.json({ error: "Generation not found" }, { status: 404 });
      }
    }

    const next: GenerationRecord = {
      id: projectId,
      projectId,
      config: existing?.config,
      brandId: existing?.brandId,
      project: existing?.project || { id: projectId, name: projectId },
      data: body.data,
      createdDate: existing?.createdDate || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await writeJson(cmsGenerationPath(projectId), next);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid generation id") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: toErrorMessage(error) }, { status: 500 });
  }
}
