import {
  ManuscriptType,
  MediaAssetType,
  segmentSchema,
  textSchema,
} from "@videofy/types";
import { z } from "zod";

export const prepareManuscript = (
  manuscript: ManuscriptType
): ManuscriptType => {
  const media: Array<MediaAssetType> = [];
  manuscript.segments.forEach((s: z.infer<typeof segmentSchema>) => {
    s.text = s.texts
      .map((t: z.infer<typeof textSchema>) => t.text)
      .join("\n\n");
    s.mainMedia = s.images?.[0];
    s.images?.forEach((i: MediaAssetType) => {
      media.push(i);
    });
  });

  manuscript.media = media;

  return manuscript;
};
