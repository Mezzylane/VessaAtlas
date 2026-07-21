"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { CampusMapContainer } from "@/components/map/CampusMapContainer";
import type { PinGroup } from "@/components/map/CampusMap";
import { genderLabel } from "@/lib/gender";
import type { BuildingLabel, RestroomDetail, RestroomDraft } from "@/lib/types";

import { RestroomForm } from "./RestroomForm";
import styles from "./restroom-form.module.css";

type Props = {
  mapSvg: string;
  mapWidth: number;
  mapHeight: number;
  buildingLabels?: BuildingLabel[];
};

function toDraft(r: RestroomDetail): RestroomDraft {
  return { id: r.id, x: r.x, y: r.y, building: r.building, floorNumber: r.floorNumber, wing: r.wing ?? "", gender: r.gender };
}

export function AdminDashboard({ mapSvg, mapWidth, mapHeight, buildingLabels }: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<RestroomDraft | null>(null);
  const [clusterPicker, setClusterPicker] = useState<RestroomDetail[] | null>(null);
  const [mapKey, setMapKey] = useState(0);

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin");
    router.refresh();
  }

  function handleMapClick(x: number, y: number) {
    setClusterPicker(null);
    setDraft((prev) => (prev ? { ...prev, x, y } : { x, y, building: "", floorNumber: 0, wing: "", gender: "men" }));
  }

  function handlePinClick(group: PinGroup) {
    if (group.restrooms.length === 1) {
      setClusterPicker(null);
      setDraft(toDraft(group.restrooms[0]));
    } else {
      setDraft(null);
      setClusterPicker(group.restrooms);
    }
  }

  function handleDone() {
    setDraft(null);
    setClusterPicker(null);
    setMapKey((k) => k + 1); // remount CampusMapContainer to refetch pins
  }

  function handleCoordsChange(x: number, y: number) {
    setDraft((prev) => (prev ? { ...prev, x, y } : prev));
  }

  function handleAddAnotherHere(base: RestroomDraft) {
    setClusterPicker(null);
    setDraft({ ...base, id: undefined });
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
            admin — click empty map space to add a restroom, or an existing pin to edit it
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
            buildingLabels={buildingLabels}
            onMapClick={handleMapClick}
            onPinClick={handlePinClick}
            extraMarkers={draft ? [{ x: draft.x, y: draft.y, label: draft.id ? "Editing" : "New restroom" }] : []}
          />
        </div>

        {clusterPicker && (
          <div className={styles.form}>
            <div className={styles.title}>Multiple floors here</div>
            <div className={styles.coords}>Which one do you want to edit?</div>
            {clusterPicker.map((r) => (
              <button
                key={r.id}
                type="button"
                className={styles.cancel}
                onClick={() => {
                  setDraft(toDraft(r));
                  setClusterPicker(null);
                }}
              >
                {r.building} · {r.floorLabel} · {genderLabel(r.gender)}
              </button>
            ))}
            <button
              type="button"
              className={styles.cancel}
              onClick={() => handleAddAnotherHere(toDraft(clusterPicker[0]))}
            >
              + Add another restroom at this spot
            </button>
            <button type="button" className={styles.cancel} onClick={() => setClusterPicker(null)}>
              Cancel
            </button>
          </div>
        )}

        {draft && (
          <RestroomForm
            key={draft.id ?? "new"}
            draft={draft}
            onCancel={() => setDraft(null)}
            onSaved={handleDone}
            onDeleted={handleDone}
            onCoordsChange={handleCoordsChange}
            onAddAnotherHere={() => handleAddAnotherHere(draft)}
          />
        )}
      </div>
    </div>
  );
}
