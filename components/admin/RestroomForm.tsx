"use client";

import { useState } from "react";

import type { Gender, RestroomPin } from "@/lib/types";

import styles from "./restroom-form.module.css";

type Props = {
  x: number;
  y: number;
  existing: RestroomPin[];
  onCancel: () => void;
  onCreated: () => void;
};

export function RestroomForm({ x, y, existing, onCancel, onCreated }: Props) {
  const [coords, setCoords] = useState({ x, y });
  const [building, setBuilding] = useState("");
  const [floorNumber, setFloorNumber] = useState(0);
  const [floorLabel, setFloorLabel] = useState("");
  const [wing, setWing] = useState("");
  const [gender, setGender] = useState<Gender>("men");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function applySameSpot(id: string) {
    const match = existing.find((r) => r.id === id);
    if (!match) return;
    setCoords({ x: match.x, y: match.y });
    setBuilding(match.building);
    if (match.wing) setWing(match.wing);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/restrooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          building,
          floorNumber,
          floorLabel,
          wing: wing || undefined,
          gender,
          xCoord: coords.x,
          yCoord: coords.y,
        }),
      });
      if (!res.ok) {
        setError("Couldn't save — check the fields and try again.");
        return;
      }
      onCreated();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.title}>New restroom</div>
      <div className={styles.coords}>
        at ({coords.x}, {coords.y})
      </div>

      {existing.length > 0 && (
        <label className={styles.field}>
          <span>Same spot as an existing floor (optional)</span>
          <select onChange={(e) => e.target.value && applySameSpot(e.target.value)} defaultValue="">
            <option value="">— none —</option>
            {existing.map((r) => (
              <option key={r.id} value={r.id}>
                {r.building} · {r.floorLabel} · {r.gender}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className={styles.field}>
        <span>Building</span>
        <input value={building} onChange={(e) => setBuilding(e.target.value)} required />
      </label>
      <label className={styles.field}>
        <span>Floor number (sort order, 0 = ground, negative = basement)</span>
        <input
          type="number"
          value={floorNumber}
          onChange={(e) => setFloorNumber(Number(e.target.value))}
          required
        />
      </label>
      <label className={styles.field}>
        <span>Floor label</span>
        <input
          value={floorLabel}
          onChange={(e) => setFloorLabel(e.target.value)}
          placeholder="e.g. 1st floor"
          required
        />
      </label>
      <label className={styles.field}>
        <span>Wing (optional)</span>
        <input value={wing} onChange={(e) => setWing(e.target.value)} />
      </label>
      <label className={styles.field}>
        <span>Gender</span>
        <select value={gender} onChange={(e) => setGender(e.target.value as Gender)}>
          <option value="men">Men&apos;s WC</option>
          <option value="women">Women&apos;s WC</option>
        </select>
      </label>

      <div className={styles.actions}>
        <button type="button" className={styles.cancel} onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className={styles.submit} disabled={submitting}>
          {submitting ? "Saving…" : "Save restroom"}
        </button>
      </div>
      {error && <div className={styles.error}>{error}</div>}
    </form>
  );
}
