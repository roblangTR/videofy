import { NextResponse } from "next/server";
import { playerSchema, processedManuscriptSchema } from "@videofy/types";
import { z } from "zod";
import { renderProjectVideo } from "@/lib/remotionRender";

export const runtime = "nodejs";

const bodySchema = z.object({
  projectId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/),
  orientation: z.enum(["vertical", "horizontal"]).default("vertical"),
  manuscripts: z.array(processedManuscriptSchema).min(1),
  playerConfig: playerSchema,
  voice: z.boolean().default(true),
  backgroundMusic: z.boolean().default(true),
  disabledLogo: z.boolean().default(false),
});

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Unexpected error";
}

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());

    await renderProjectVideo({
      projectId: body.projectId,
      orientation: body.orientation,
      manuscripts: body.manuscripts,
      playerConfig: body.playerConfig,
      voice: body.voice,
      backgroundMusic: body.backgroundMusic,
      disabledLogo: body.disabledLogo,
    });

    const fileBase = process.env.MINIMAL_FILE_BASE_URL || "http://127.0.0.1:8001";
    return NextResponse.json({
      downloadUrl: `${fileBase}/projects/${body.projectId}/files/output/render-${body.orientation}.mp4`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: toErrorMessage(error) }, { status: 500 });
  }
}
