import MapComponent, { Marker } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import type { CSSProperties } from "react";

interface Props {
  location?: {
    lat: number;
    lon: number;
  };
  zoom: number;
  onEdit?: () => void;
  styles?: CSSProperties;
  onClick?: () => void;
  interactive?: boolean;
}

const DEFAULT_MAP_STYLE_URL =
  process.env.NEXT_PUBLIC_MAP_STYLE_URL || "https://demotiles.maplibre.org/style.json";

const MapComp = ({
  location,
  zoom,
  onEdit,
  styles,
  onClick = () => {},
  interactive = true,
}: Props) => {
  if (!location?.lat || !location?.lon) {
    return "Please specify map coordinates.";
  }

  return (
    <>
      <link rel="preconnect" href="https://demotiles.maplibre.org" crossOrigin="" />
      <link rel="preload" href={DEFAULT_MAP_STYLE_URL} as="fetch" crossOrigin="" />

      <MapComponent
        interactive={interactive}
        onClick={onClick}
        longitude={location.lon}
        latitude={location.lat}
        zoom={zoom}
        attributionControl={false}
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "0.5rem",
          aspectRatio: "16/9",
          cursor: "pointer",
          ...styles,
        }}
        mapStyle={DEFAULT_MAP_STYLE_URL}
      >
        <Marker longitude={location.lon} latitude={location.lat} color="#dd0000" />
        {!!onEdit && (
          <button
            type="button"
            className="top-2 right-2 z-10 absolute bg-white hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 shadow-md p-2 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-black dark:focus:ring-gray-800 focus:ring-offset-2 text-black dark:text-gray-200"
            onClick={() => onEdit()}
            aria-label="Activate map"
          >
            Edit map
          </button>
        )}
      </MapComponent>
    </>
  );
};

export default MapComp;
