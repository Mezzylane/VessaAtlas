import { CampusMapContainer } from "@/components/map/CampusMapContainer";
import { loadCampusMapData } from "@/lib/campusMapData";

export default function HomePage() {
  const { svg: mapSvg, width: mapWidth, height: mapHeight, buildingLabels } = loadCampusMapData();

  return (
    <div className="max-w-295 mx-auto px-5 pt-5 pb-12 w-full">
      <header
        className="flex items-end justify-between gap-4 flex-wrap mb-4 pb-3.5"
        style={{ borderBottom: "1px solid var(--line-faint)" }}
      >
        <div>
          <div
            className="uppercase leading-none text-balance"
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              letterSpacing: "0.06em",
              fontSize: "clamp(28px, 4vw, 40px)",
            }}
          >
            VESSA<span style={{ color: "var(--accent)" }}>·</span>ATLAS
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--muted)", marginTop: 6 }}>
            unofficial campus WC ratings — Otaniemi, for the culture
          </div>
        </div>
      </header>

      <CampusMapContainer mapSvg={mapSvg} mapWidth={mapWidth} mapHeight={mapHeight} buildingLabels={buildingLabels} />

      <footer
        style={{
          marginTop: 16,
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--muted)",
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <span>Ratings and reviews are fully anonymous.</span>
        <span>building footprints © OpenStreetMap contributors</span>
      </footer>
    </div>
  );
}
