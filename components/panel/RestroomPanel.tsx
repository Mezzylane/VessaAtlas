"use client";

import { useEffect, useState } from "react";

import { genderColorVar, genderLabel } from "@/lib/gender";
import type { RestroomDetail } from "@/lib/types";

import styles from "./restroom-panel.module.css";

type Props = {
  group: RestroomDetail[];
  selectedIndex: number;
  isOpen: boolean;
  onSelectFloor: (index: number) => void;
  onClose: () => void;
  onSubmitRating: (restroomId: string, rating: number, comment: string) => Promise<{ ok: boolean; error?: string }>;
  onLike: (restroomId: string, reviewId: string) => void;
};

const RATE_LIMIT_MESSAGES: Record<string, string> = {
  already_rated_this_restroom_recently: "You've already rated this one recently — thanks though.",
  too_many_submissions_this_hour: "That's a lot of ratings in one hour — try again later.",
  submitting_too_fast: "Whoa, slow down a moment and try again.",
};

export function RestroomPanel({
  group,
  selectedIndex,
  isOpen,
  onSelectFloor,
  onClose,
  onSubmitRating,
  onLike,
}: Props) {
  const restroom = group[selectedIndex];
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSelectedRating(null);
    setComment("");
    setSubmitted(false);
    setSubmitError(null);
  }, [restroom?.id]);

  if (!restroom) return null;

  const sortedReviews = [...restroom.reviews].sort((a, b) => b.likeCount - a.likeCount);
  const maxHist = Math.max(...restroom.histogram, 1);

  async function handleSubmit() {
    // Honeypot: bots fill hidden fields humans never see. Silently no-op —
    // never a visible error, so scripted submitters can't tell rejection
    // from acceptance and iterate against the signal.
    if (honeypot) return;
    if (selectedRating === null) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await onSubmitRating(restroom.id, selectedRating, comment.trim());
      if (result.ok) {
        setSubmitted(true);
        setSelectedRating(null);
        setComment("");
      } else {
        setSubmitError(RATE_LIMIT_MESSAGES[result.error ?? ""] ?? "Something went wrong — try again.");
      }
    } catch {
      setSubmitError("Something went wrong — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleLike(reviewId: string) {
    if (likedIds.has(reviewId)) return;
    setLikedIds((prev) => new Set(prev).add(reviewId));
    onLike(restroom.id, reviewId);
  }

  return (
    <aside className={`${styles.panel} ${isOpen ? styles.panelOpen : ""}`} aria-hidden={!isOpen}>
      <div className={styles.panelHead}>
        <div>
          <div className={styles.rBuilding}>{restroom.building}</div>
          <div className={styles.rSub}>
            <span
              className={styles.rSubDot}
              style={{ background: genderColorVar(restroom.gender) }}
            />
            <span>
              {restroom.floorLabel}
              {restroom.wing ? ` · ${restroom.wing}` : ""} · {genderLabel(restroom.gender)}
            </span>
          </div>
        </div>
        <button className={styles.panelClose} onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      {group.length > 1 && (
        <div className={styles.floorChips}>
          {group.map((r, i) => (
            <button
              key={r.id}
              className={`${styles.floorChip} ${i === selectedIndex ? styles.floorChipActive : ""}`}
              onClick={() => onSelectFloor(i)}
            >
              {r.floorLabel}
            </button>
          ))}
        </div>
      )}

      <div className={styles.panelBody}>
        <div className={styles.avgRow}>
          <div className={styles.avgNum}>{restroom.avgRating.toFixed(1)}</div>
          <div className={styles.avgDen}>/10</div>
          <div className={styles.avgCount}>({restroom.ratingCount} ratings)</div>
        </div>
        <div className={styles.hist}>
          {restroom.histogram.map((v, i) => (
            <i key={i} className={styles.histBar} style={{ height: `${(v / maxHist) * 100}%` }} />
          ))}
        </div>

        <div className={styles.rateBlock}>
          <div className={styles.rateLabel}>Rate this one</div>
          <div className={styles.rateScale}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                className={`${styles.rateBtn} ${selectedRating === n ? styles.rateBtnSelected : ""}`}
                onClick={() => {
                  setSelectedRating(n);
                  setSubmitted(false);
                }}
              >
                {n}
              </button>
            ))}
          </div>
          <textarea
            className={styles.rateText}
            placeholder="Tell us what you think..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={500}
          />
          {/* Honeypot: hidden from real visitors via CSS, invisible bots still fill it in */}
          <div className={styles.honeypot} aria-hidden="true">
            <label htmlFor="website">Website</label>
            <input
              id="website"
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
            />
          </div>
          <button className={styles.rateSubmit} disabled={selectedRating === null || submitting} onClick={handleSubmit}>
            {submitting ? "Submitting…" : "Submit rating"}
          </button>
          {submitted && <div className={styles.rateThanks}>Thanks — logged anonymously.</div>}
          {submitError && <div className={styles.rateError}>{submitError}</div>}
          <div className={styles.rateHint}>One rating per visitor per day, per restroom.</div>
        </div>

        <div className={styles.reviewsHead}>Reviews</div>
        {sortedReviews.map((r) => (
          <div key={r.id} className={styles.review}>
            <span className={styles.reviewBadge}>{r.rating}/10</span>
            <div className={styles.reviewText}>{r.comment}</div>
            <button
              className={`${styles.likeBtn} ${likedIds.has(r.id) ? styles.likeBtnLiked : ""}`}
              onClick={() => handleLike(r.id)}
              type="button"
            >
              ▲ Helpful ({r.likeCount})
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}
