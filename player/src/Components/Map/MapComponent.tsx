import { Map, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState, type FC } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { z } from "zod";
import type { mapSchema } from "@videofy/types";
import { playerSchema } from "@videofy/types";

type PlayerConfig = z.infer<typeof playerSchema>;

const DEFAULT_MAP_STYLE_URL = "https://demotiles.maplibre.org/style.json";

interface Props {
  asset: z.infer<typeof mapSchema>;
  config: PlayerConfig;
}

export const MapComponent: FC<Props> = ({ asset, config }) => {
  const {
    lat: latitude,
    lon: longitude,
    zoomStart = 8,
    zoomEnd = 13,
    stillTime = 2,
    rotation = 4,
  } = asset.location;

  const mapContainer = useRef(null);
  const [renderHandle] = useState(() => delayRender("Loading map..."));
  const [mapInstance, setMapInstance] = useState<Map | null>(null);
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();
  const isPortrait = height > width;
  const markerStyleConfig =
    config.styles?.all?.map?.marker ||
    (isPortrait
      ? config.styles?.portrait?.map?.marker
      : config.styles?.landscape?.map?.marker);

  useEffect(() => {
    const markerOptions = {
      color: markerStyleConfig?.color || "#dd0000",
      scale: markerStyleConfig?.scale || 2.5,
    };

    const createdMap = new Map({
      container: mapContainer.current!,
      style: DEFAULT_MAP_STYLE_URL,
      center: [longitude, latitude],
      zoom: zoomStart,
    });

    createdMap.on("load", () => {
      new Marker(markerOptions).setLngLat([longitude, latitude]).addTo(createdMap);
      continueRender(renderHandle);
      setMapInstance(createdMap);
    });

    return () => createdMap.remove();
  }, [latitude, longitude, markerStyleConfig, renderHandle, zoomStart]);

  useEffect(() => {
    if (!mapInstance) {
      return;
    }

    const movementHandle = delayRender("Moving camera...");
    const stillFrames = stillTime * fps;

    const zoom =
      stillFrames > durationInFrames
        ? zoomStart
        : interpolate(frame, [0, durationInFrames - stillFrames], [zoomStart, zoomEnd], {
            extrapolateRight: "clamp",
          });

    const bearing = interpolate(
      frame,
      [durationInFrames - stillFrames, durationInFrames],
      [0, rotation],
      {
        extrapolateRight: "clamp",
      }
    );

    mapInstance.easeTo({
      center: [longitude, latitude],
      zoom,
      duration: 1000 / fps,
      bearing: bearing > 0 ? bearing : 0,
    });

    mapInstance.once("idle", () => continueRender(movementHandle));
  }, [
    durationInFrames,
    fps,
    frame,
    latitude,
    longitude,
    mapInstance,
    rotation,
    stillTime,
    zoomEnd,
    zoomStart,
  ]);

  return (
    <>
      <link rel="preconnect" href="https://demotiles.maplibre.org" crossOrigin="" />
      <link rel="preload" href={DEFAULT_MAP_STYLE_URL} as="fetch" crossOrigin="" />
      <AbsoluteFill
        ref={mapContainer}
        style={{ width: "100%", height: "100%", zIndex: 0 }}
      />
    </>
  );
};
