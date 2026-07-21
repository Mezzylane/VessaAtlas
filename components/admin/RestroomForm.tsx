"use client";

import { useState } from "react";

import { floorLabelFromNumber } from "@/lib/floors";
import type { Gender, RestroomDraft } from "@/lib/types";

import styles from "./restroom-form.module.css";

type Props = {
  draft: RestroomDraft;
  onCancel: () => void;
  onSaved: () => void;
  onDeleted: () => void;
  /** Coordinates live in the parent (also updated by clicking the map), not this form's local state. */
  onCoordsChange: (x: number, y: number) => void;
  /** Editing an existing restroom but want to add another floor at this same spot, without touching the one you clicked? This starts a fresh create-draft here, prefilled with this restroom's other fields. */
  onAddAnotherHere: () => void;
};

export function RestroomForm({ draft, onCancel, onSaved, onDeleted, onCoordsChange, onAddAnotherHere }: Props) {
  const isEditing = !!draft.id;
  const [building, setBuilding] = useState(draft.building);
  const [floorNumber, setFloorNumber] = useState(draft.floorNumber);
  const [wing, setWing] = useState(draft.wing);
  const [gender, setGender] = useState<Gender>(draft.gender);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Positive integers only — anything else is silently ignored, so the
  // field just keeps showing its last valid value instead of erroring.
  function handleXChange(e: React.ChangeEvent<HTMLInputElement>) {
    const parsed = Number(e.target.value);
    if (Number.isInteger(parsed) && parsed > 0) onCoordsChange(parsed, draft.y);
  }
  function handleYChange(e: React.ChangeEvent<HTMLInputElement>) {
    const parsed = Number(e.target.value);
    if (Number.isInteger(parsed) && parsed > 0) onCoordsChange(draft.x, parsed);
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

      <div className={styles.coordsRow}>
        <label className={styles.field}>
          <span>X</span>
          <input type="number" min={1} step={1} value={draft.x} onChange={handleXChange} />
        </label>
        <label className={styles.field}>
          <span>Y</span>
          <input type="number" min={1} step={1} value={draft.y} onChange={handleYChange} />
        </label>
      </div>
      <span className={styles.derivedLabel}>or click a new spot on the map to move it</span>

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
          <option value="unisex">Unisex WC</option>
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
        <button type="button" className={styles.cancel} onClick={onAddAnotherHere}>
          + Add another restroom at this spot
        </button>
      )}
      {isEditing && (
        <button type="button" className={styles.delete} onClick={handleDelete} disabled={deleting}>
          {deleting ? "Removing…" : confirmingDelete ? "Click again to confirm removal" : "Remove restroom"}
        </button>
      )}
      {error && <div className={styles.error}>{error}</div>}
    </form>
  );
}
