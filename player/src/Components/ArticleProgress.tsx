import type { FC } from "react";
import { useVideoConfig } from "remotion";
import { playerSchema } from "@videofy/types";
import type { z } from "zod";
import { cssStringToReactStyle } from "../utils/cssStringToReactStyle";

type PlayerConfig = z.infer<typeof playerSchema>;

interface Props {
  current: number;
  length: number;
  config: PlayerConfig;
}

const ArticleProgress: FC<Props> = ({ current, length, config }) => {
  const { width, height } = useVideoConfig();
  const isPortrait = height > width;

  if (length <= 1) {
    return null;
  }

  const defaultStyle: React.CSSProperties = {
    position: "absolute",
    left: "65px",
    top: isPortrait ? "460px" : "276px",

    display: "flex",
    width: "90px",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    gap: "6px",
    zIndex: 0,
  };

  return (
    <div style={defaultStyle}>
      {Array.from({ length }, (_, index) => {
        const key = `indicator-${current}-${index}`;
        const defaultStyle: React.CSSProperties = {
          backgroundColor:
            current === index
              ? config.colors?.progress.active.background
              : config.colors?.progress.inactive.background,
          color:
            current === index
              ? config.colors?.progress.active.text
              : config.colors?.progress.inactive.text,
          borderRadius: "8px",

          display: "flex",
          height: "90px",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          alignSelf: "stretch",

          textAlign: "center",
          textShadow: "1px 1px 4px rgba(0, 0, 0, 0.40)",
          fontSize: "68px",
          fontWeight: 600,
        };

        const configValue =
          config.styles?.all?.progress ||
          (isPortrait
            ? config.styles?.portrait?.progress
            : config.styles?.landscape?.progress);
        const progressStyle =
          current === index
            ? cssStringToReactStyle(configValue?.active)
            : cssStringToReactStyle(configValue?.inactive);
        const style: React.CSSProperties = {
          ...defaultStyle,
          ...progressStyle,
        };
        return (
          <span key={key} style={style}>
            {index + 1}
          </span>
        );
      })}
    </div>
  );
};
export default ArticleProgress;
