"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { RestroomPanel } from "@/components/panel/RestroomPanel";
import { genderColorVar } from "@/lib/gender";
import type { BuildingLabel, RestroomDetail } from "@/lib/types";

import styles from "./campus-map.module.css";

type Props = {
  mapSvg: string;
  mapWidth: number;
  mapHeight: number;
  restrooms: RestroomDetail[];
  onSubmitRating: (restroomId: string, rating: number, comment: string) => Promise<{ ok: boolean; error?: string }>;
  onLike: (restroomId: string, reviewId: string) => void;
  /**
   * Optional: when provided, clicking empty map space (not a pin) reports
   * the click's position in map coordinates. Used by the admin "add
   * restroom" flow — regular visitors never pass this, so the map stays
   * read-only-except-pins for them.
   */
  onMapClick?: (x: number, y: number) => void;
  /** Extra pins to render that aren't part of `restrooms` (e.g. an admin's in-progress "ghost pin"). */
  extraMarkers?: { x: number; y: number; label: string }[];
  buildingLabels?: BuildingLabel[];
  /** Admin edit flow: when provided, clicking an existing pin calls this instead of opening the public review panel. */
  onPinClick?: (group: PinGroup) => void;
};

export type PinGroup = { key: string; x: number; y: number; restrooms: RestroomDetail[] };

export function CampusMap({
  mapSvg,
  mapWidth,
  mapHeight,
  restrooms,
  onSubmitRating,
  onLike,
  onMapClick,
  extraMarkers,
  buildingLabels,
  onPinClick,
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const mapStageRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const transform = useRef({ scale: 1, panX: 0, panY: 0, minScale: 0.6, maxScale: 4 });

  const groups = useMemo<PinGroup[]>(() => {
    const byCoord = new Map<string, RestroomDetail[]>();
    for (const r of restrooms) {
      const key = `${r.x},${r.y}`;
      const list = byCoord.get(key) ?? [];
      list.push(r);
      byCoord.set(key, list);
    }
    return Array.from(byCoord.entries()).map(([key, list]) => ({
      key,
      x: list[0].x,
      y: list[0].y,
      restrooms: list,
    }));
  }, [restrooms]);

  // Derived live from `groups` (not a snapshot) so the open panel reflects
  // updated ratings/reviews immediately after a submit, without needing to
  // be closed and reopened.
  const selectedGroup = groups.find((g) => g.key === selectedGroupKey) ?? null;

  function applyTransform() {
    const { scale, panX, panY } = transform.current;
    const stage = mapStageRef.current;
    if (!stage) return;
    stage.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
    stage.querySelectorAll<HTMLElement>("[data-pin]").forEach((el) => {
      el.style.transform = `scale(${1 / scale})`;
    });
    // Labels are plain children of the scaled map-stage, same as the
    // building outlines — no counter-scale, so they grow and shrink with
    // the map exactly like the buildings do. Only their reveal (opacity)
    // is zoom-gated, toggled here since it depends on the live scale.
    stage.querySelectorAll<HTMLElement>("[data-label]").forEach((el) => {
      const revealScale = Number(el.dataset.revealScale);
      el.style.opacity = scale >= revealScale ? "1" : "0";
    });
  }

  function fitToViewport() {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;
    // "Cover" the viewport (like CSS background-size: cover), not "contain" —
    // with contain, whichever axis doesn't match the viewport's aspect ratio
    // shows blank space on both sides even at the most-zoomed-out state. With
    // cover, the map always fully fills the viewport; the axis that
    // overflows is reachable by panning instead.
    const fitScale = Math.max(vw / mapWidth, vh / mapHeight);
    // Never allow zooming out past that — beyond it you'd see blank space
    // around the map's edges again.
    transform.current.minScale = fitScale;
    transform.current.scale = fitScale;
    transform.current.panX = (vw - mapWidth * fitScale) / 2;
    transform.current.panY = (vh - mapHeight * fitScale) / 2;
    clampPan();
    applyTransform();
  }

  function clamp(v: number, lo: number, hi: number) {
    return Math.max(lo, Math.min(hi, v));
  }

  /**
   * Panning has no other limit, so dragging far enough used to be able to
   * push the entire map off-screen, revealing the viewport's own blank
   * background. Cap visible whitespace at a quarter of the viewport on any
   * side, on every axis, at every zoom level (not just the most-zoomed-out
   * state — that's just the tightest case since there's the least overflow
   * slack to pan within).
   */
  function clampPan() {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;
    const t = transform.current;
    const mapVisibleW = mapWidth * t.scale;
    const mapVisibleH = mapHeight * t.scale;
    const maxWhitespaceX = vw * 0.25;
    const maxWhitespaceY = vh * 0.25;
    t.panX = clamp(t.panX, vw - maxWhitespaceX - mapVisibleW, maxWhitespaceX);
    t.panY = clamp(t.panY, vh - maxWhitespaceY - mapVisibleH, maxWhitespaceY);
  }

  function zoomAt(focusX: number, focusY: number, nextScale: number) {
    const t = transform.current;
    const clamped = clamp(nextScale, t.minScale, t.maxScale);
    const mapX = (focusX - t.panX) / t.scale;
    const mapY = (focusY - t.panY) / t.scale;
    t.scale = clamped;
    t.panX = focusX - mapX * clamped;
    t.panY = focusY - mapY * clamped;
    clampPan();
    applyTransform();
  }

  useEffect(() => {
    fitToViewport();
    window.addEventListener("resize", fitToViewport);
    return () => window.removeEventListener("resize", fitToViewport);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapWidth, mapHeight]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    function onWheel(e: WheelEvent) {
      if (panelRef.current?.contains(e.target as Node)) return; // let the panel scroll normally
      e.preventDefault();
      const rect = viewport!.getBoundingClientRect();
      const fx = e.clientX - rect.left;
      const fy = e.clientY - rect.top;
      zoomAt(fx, fy, transform.current.scale * (e.deltaY < 0 ? 1.12 : 1 / 1.12));
    }

    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startPanX = 0;
    let startPanY = 0;

    function onPointerDown(e: PointerEvent) {
      const target = e.target as HTMLElement;
      // Every clickable thing on the map (pins, zoom/reset buttons) is a
      // <button> — capturing the pointer here would swallow their click
      // events (pointer capture redirects the matching pointerup away from
      // the button, so its native click never fires).
      if (target.closest("button") || panelRef.current?.contains(target)) return;
      dragging = true;
      setIsDragging(true);
      startX = e.clientX;
      startY = e.clientY;
      startPanX = transform.current.panX;
      startPanY = transform.current.panY;
      viewport!.setPointerCapture(e.pointerId);
    }
    function onPointerMove(e: PointerEvent) {
      if (!dragging) return;
      transform.current.panX = startPanX + (e.clientX - startX);
      transform.current.panY = startPanY + (e.clientY - startY);
      clampPan();
      applyTransform();
    }
    function onPointerUp(e: PointerEvent) {
      const moved = dragging && (Math.abs(e.clientX - startX) > 3 || Math.abs(e.clientY - startY) > 3);
      dragging = false;
      setIsDragging(false);
      if (!moved && onMapClick) {
        const target = e.target as HTMLElement;
        if (!target.closest("button") && !panelRef.current?.contains(target)) {
          const rect = viewport!.getBoundingClientRect();
          const fx = e.clientX - rect.left;
          const fy = e.clientY - rect.top;
          const t = transform.current;
          onMapClick(Math.round((fx - t.panX) / t.scale), Math.round((fy - t.panY) / t.scale));
        }
      }
    }

    viewport.addEventListener("wheel", onWheel, { passive: false });
    viewport.addEventListener("pointerdown", onPointerDown);
    viewport.addEventListener("pointermove", onPointerMove);
    viewport.addEventListener("pointerup", onPointerUp);
    viewport.addEventListener("pointercancel", onPointerUp);
    return () => {
      viewport.removeEventListener("wheel", onWheel);
      viewport.removeEventListener("pointerdown", onPointerDown);
      viewport.removeEventListener("pointermove", onPointerMove);
      viewport.removeEventListener("pointerup", onPointerUp);
      viewport.removeEventListener("pointercancel", onPointerUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onMapClick]);

  function openGroup(group: PinGroup) {
    if (onPinClick) {
      onPinClick(group);
      return;
    }
    setSelectedGroupKey(group.key);
    setSelectedIndex(0);
  }

  return (
    <div className={styles.stageWrap}>
      <div
        ref={viewportRef}
        className={`${styles.viewport} ${isDragging ? styles.dragging : ""}`}
      >
        <div
          ref={mapStageRef}
          className={styles.mapStage}
          style={{ width: mapWidth, height: mapHeight }}
        >
          <div dangerouslySetInnerHTML={{ __html: mapSvg }} />

          {buildingLabels?.map((b) => (
            <div
              key={b.key}
              data-label="true"
              data-reveal-scale={b.revealScale}
              className={styles.buildingLabel}
              style={{ left: b.x, top: b.y, opacity: 0, fontSize: b.fontSize }}
            >
              {b.label.toUpperCase()}
            </div>
          ))}

          {groups.map((group) => {
            const first = group.restrooms[0];
            const isCluster = group.restrooms.length > 1;
            return (
              <button
                key={group.key}
                data-pin="true"
                className={`${styles.pin} ${isCluster ? styles.pinCluster : ""}`}
                style={{ left: group.x, top: group.y, background: isCluster ? undefined : genderColorVar(first.gender) }}
                aria-label={`${first.building} restroom${isCluster ? "s" : ""}`}
                onClick={() => openGroup(group)}
              >
                {isCluster && <span className={styles.clusterBadge}>{group.restrooms.length}</span>}
              </button>
            );
          })}

          {extraMarkers?.map((m, i) => (
            <div
              key={i}
              data-pin="true"
              className={styles.pin}
              style={{ left: m.x, top: m.y, background: "var(--accent)" }}
              title={m.label}
            />
          ))}
        </div>

        <div className={styles.scaleNote}>drag to pan · scroll or +/− to zoom</div>
        <div className={styles.mapToolbar}>
          <button aria-label="Zoom in" onClick={() => zoomAt(viewportRef.current!.clientWidth / 2, viewportRef.current!.clientHeight / 2, transform.current.scale * 1.3)}>
            +
          </button>
          <button aria-label="Zoom out" onClick={() => zoomAt(viewportRef.current!.clientWidth / 2, viewportRef.current!.clientHeight / 2, transform.current.scale / 1.3)}>
            –
          </button>
          <button aria-label="Reset view" onClick={fitToViewport}>
            ⤢
          </button>
        </div>
        <div className={styles.legend}>
          <div className={styles.legendRow}>
            <span className={styles.legendDot} style={{ background: "var(--pin-men)" }} /> Men&apos;s WC
          </div>
          <div className={styles.legendRow}>
            <span className={styles.legendDot} style={{ background: "var(--pin-women)" }} /> Women&apos;s WC
          </div>
          <div className={styles.legendRow}>
            <span className={styles.legendDot} style={{ background: "var(--pin-unisex)" }} /> General WC
          </div>
          <div className={styles.legendRow}>
            <span className={styles.legendDot} style={{ background: "var(--accent)" }} /> Multiple floors here
          </div>
        </div>

        <div ref={panelRef}>
          {selectedGroup && (
            <RestroomPanel
              group={selectedGroup.restrooms}
              selectedIndex={selectedIndex}
              isOpen={!!selectedGroup}
              onSelectFloor={setSelectedIndex}
              onClose={() => setSelectedGroupKey(null)}
              onSubmitRating={onSubmitRating}
              onLike={onLike}
            />
          )}
        </div>
      </div>
    </div>
  );
}
