"use client";

import { useEffect, useState } from "react";

import type { BuildingLabel, RestroomDetail, RestroomPin } from "@/lib/types";

import { CampusMap, type PinGroup } from "./CampusMap";

type Props = {
  mapSvg: string;
  mapWidth: number;
  mapHeight: number;
  buildingLabels?: BuildingLabel[];
  /** Admin "add restroom" mode: forwarded straight through to CampusMap. */
  onMapClick?: (x: number, y: number) => void;
  onPinClick?: (group: PinGroup) => void;
  extraMarkers?: { x: number; y: number; label: string }[];
  /** Admin dashboard uses this to populate the "same spot as..." picker. */
  onRestroomsLoaded?: (pins: RestroomPin[]) => void;
};

/**
 * Owns restroom/review state for the public map page. Loads real data from
 * the API on mount. Submit/like handlers persist through the write-path API
 * routes with an optimistic local update on success.
 */
export function CampusMapContainer({
  mapSvg,
  mapWidth,
  mapHeight,
  buildingLabels,
  onMapClick,
  onPinClick,
  extraMarkers,
  onRestroomsLoaded,
}: Props) {
  const [restrooms, setRestrooms] = useState<RestroomDetail[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const pinsRes = await fetch("/api/restrooms");
        if (!pinsRes.ok) throw new Error("failed to load restrooms");
        const pins: RestroomPin[] = await pinsRes.json();
        onRestroomsLoaded?.(pins);

        const details = await Promise.all(
          pins.map(async (pin) => {
            const res = await fetch(`/api/restrooms/${pin.id}`);
            if (!res.ok) throw new Error(`failed to load restroom ${pin.id}`);
            return (await res.json()) as RestroomDetail;
          }),
        );

        if (!cancelled) {
          setRestrooms(details);
          setStatus("ready");
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmitRating(restroomId: string, rating: number, comment: string) {
    const res = await fetch(`/api/restrooms/${restroomId}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, comment: comment || undefined }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: body.error as string | undefined };
    }

    const created = await res.json();
    setRestrooms((prev) =>
      prev.map((r) => {
        if (r.id !== restroomId) return r;
        const newCount = r.ratingCount + 1;
        const newAvg = (r.avgRating * r.ratingCount + rating) / newCount;
        const newHistogram = [...r.histogram];
        newHistogram[rating - 1] += 1;
        const newReviews = comment
          ? [...r.reviews, { id: created.id, rating, comment, likeCount: 0, createdAt: created.createdAt }]
          : r.reviews;
        return { ...r, avgRating: newAvg, ratingCount: newCount, histogram: newHistogram, reviews: newReviews };
      }),
    );
    return { ok: true };
  }

  async function handleLike(restroomId: string, reviewId: string) {
    const res = await fetch(`/api/reviews/${reviewId}/like`, { method: "POST" });
    if (!res.ok) return;
    const { likeCount } = await res.json();
    setRestrooms((prev) =>
      prev.map((r) => {
        if (r.id !== restroomId) return r;
        return {
          ...r,
          reviews: r.reviews.map((rev) => (rev.id === reviewId ? { ...rev, likeCount } : rev)),
        };
      }),
    );
  }

  if (status === "error") {
    return (
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--muted)", padding: "40px 0" }}>
        Couldn&apos;t load the map right now. Try refreshing.
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--muted)", padding: "40px 0" }}>
        Loading campus map…
      </div>
    );
  }

  return (
    <CampusMap
      mapSvg={mapSvg}
      mapWidth={mapWidth}
      mapHeight={mapHeight}
      restrooms={restrooms}
      buildingLabels={buildingLabels}
      onSubmitRating={handleSubmitRating}
      onLike={handleLike}
      onMapClick={onMapClick}
      onPinClick={onPinClick}
      extraMarkers={extraMarkers}
    />
  );
}
