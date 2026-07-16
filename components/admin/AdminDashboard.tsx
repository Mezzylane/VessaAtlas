"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { CampusMapContainer } from "@/components/map/CampusMapContainer";
import type { RestroomPin } from "@/lib/types";

import { RestroomForm } from "./RestroomForm";

type Props = {
  mapSvg: string;
  mapWidth: number;
  mapHeight: number;
};

export function AdminDashboard({ mapSvg, mapWidth, mapHeight }: Props) {
  const router = useRouter();
  const [ghostPin, setGhostPin] = useState<{ x: number; y: number } | null>(null);
  const [existing, setExisting] = useState<RestroomPin[]>([]);
  const [mapKey, setMapKey] = useState(0);

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin");
    router.refresh();
  }

  function handleCreated() {
    setGhostPin(null);
    setMapKey((k) => k + 1); // remount CampusMapContainer to refetch pins
  }

  return (
    <div className="max-w-295 mx-auto px-5 pt-5 pb-12 w-full">
      <header
        className="flex items-end justify-between gap-4 flex-wrap mb-4 pb-3.5"
        style={{ borderBottom: "1px solid var(--line-faint)" }}
      >
        <div>
          <div
            className="uppercase leading-none"
            style={{ fontFamily: "var(--font-display)", fontWeight: 800, letterSpacing: "0.06em", fontSize: 28 }}
          >
            VESSA<span style={{ color: "var(--accent)" }}>·</span>ATLAS
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
            admin — click anywhere on the map to add a restroom
          </div>
        </div>
        <button
          onClick={handleLogout}
          style={{
            background: "none",
            border: "1px solid var(--line-faint)",
            color: "var(--muted)",
            padding: "8px 12px",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          Log out
        </button>
      </header>

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <CampusMapContainer
            key={mapKey}
            mapSvg={mapSvg}
            mapWidth={mapWidth}
            mapHeight={mapHeight}
            onMapClick={(x, y) => setGhostPin({ x, y })}
            extraMarkers={ghostPin ? [{ x: ghostPin.x, y: ghostPin.y, label: "New restroom" }] : []}
            onRestroomsLoaded={setExisting}
          />
        </div>
        {ghostPin && (
          <RestroomForm
            x={ghostPin.x}
            y={ghostPin.y}
            existing={existing}
            onCancel={() => setGhostPin(null)}
            onCreated={handleCreated}
          />
        )}
      </div>
    </div>
  );
}
