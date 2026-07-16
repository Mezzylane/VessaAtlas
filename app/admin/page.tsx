"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(
          body.error === "too_many_attempts"
            ? "Too many attempts — try again later."
            : "Wrong password.",
        );
        return;
      }
      router.push("/admin/dashboard");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        maxWidth: 360,
        margin: "18vh auto",
        padding: "0 20px",
        fontFamily: "var(--font-body)",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          fontSize: 28,
        }}
      >
        VESSA<span style={{ color: "var(--accent)" }}>·</span>ATLAS
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", marginTop: 6, marginBottom: 24 }}>
        admin
      </div>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoFocus
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--line-faint)",
            color: "var(--ink)",
            padding: "10px 12px",
            fontFamily: "var(--font-mono)",
            fontSize: 14,
          }}
        />
        <button
          type="submit"
          disabled={submitting || !password}
          style={{
            background: "var(--ink)",
            color: "var(--paper)",
            border: "none",
            padding: "10px 14px",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            cursor: submitting || !password ? "not-allowed" : "pointer",
            opacity: submitting || !password ? 0.5 : 1,
          }}
        >
          {submitting ? "Checking…" : "Log in"}
        </button>
        {error && <div style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--pin-women)" }}>{error}</div>}
      </form>
    </div>
  );
}
