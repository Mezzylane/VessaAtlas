"use client";

import { useState } from "react";

import { floorLabelFromNumber } from "@/lib/floors";
import { genderLabel } from "@/lib/gender";
import type { Gender, RestroomDraft, RestroomPin } from "@/lib/types";

import styles from "./restroom-form.module.css";

type Props = {
  draft: RestroomDraft;
  existing: RestroomPin[];
  onCancel: () => void;
  onSaved: () => void;
  onDeleted: () => void;
};

export function RestroomForm({ draft, existing, onCancel, onSaved, onDeleted }: Props) {
  const isEditing = !!draft.id;
  const [building, setBuilding] = useState(draft.building);
  const [floorNumber, setFloorNumber] = useState(draft.floorNumber);
  const [wing, setWing] = useState(draft.wing);
  const [gender, setGender] = useState<Gender>(draft.gender);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function applySameSpot(id: string) {
    const match = existing.find((r) => r.id === id);
    if (!match) return;
    setBuilding(match.building);
    if (match.wing) setWing(match.wing);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(isEditing ? `/api/admin/restrooms/${draft.id}` : "/api/admin/restrooms", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          building,
          floorNumber,
          wing: wing || undefined,
          gender,
          xCoord: draft.x,
          yCoord: draft.y,
        }),
      });
      if (!res.ok) {
        setError("Couldn't save — check the fields and try again.");
        return;
      }
      onSaved();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/restrooms/${draft.id}`, { method: "DELETE" });
      if (!res.ok) {
        setError("Couldn't delete — try again.");
        setConfirmingDelete(false);
        return;
      }
      onDeleted();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.title}>{isEditing ? "Edit restroom" : "New restroom"}</div>
      <div className={styles.coords}>
        at ({draft.x}, {draft.y})
        {isEditing && <span> — click a new spot on the map to move it</span>}
      </div>

      {existing.length > 0 && (
        <label className={styles.field}>
          <span>Same spot as an existing floor (optional)</span>
          <select onChange={(e) => e.target.value && applySameSpot(e.target.value)} defaultValue="">
            <option value="">— none —</option>
            {existing.map((r) => (
              <option key={r.id} value={r.id}>
                {r.building} · {r.floorLabel} · {genderLabel(r.gender)} · ({r.x}, {r.y})
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
        <span>Floor number (0 = ground, negative = basement)</span>
        <input
          type="number"
          value={floorNumber}
          onChange={(e) => setFloorNumber(Number(e.target.value))}
          required
        />
        <span className={styles.derivedLabel}>→ {floorLabelFromNumber(floorNumber)}</span>
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
          <option value="unisex">General WC</option>
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
      {isEditing && (
        <button type="button" className={styles.delete} onClick={handleDelete} disabled={deleting}>
          {deleting ? "Removing…" : confirmingDelete ? "Click again to confirm removal" : "Remove restroom"}
        </button>
      )}
      {error && <div className={styles.error}>{error}</div>}
    </form>
  );
}
