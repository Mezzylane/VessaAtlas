import { createHmac } from "node:crypto";

import { ipAddress } from "@vercel/functions";
import { and, count, eq, gt, lt, max } from "drizzle-orm";

import { db } from "./db/client";
import { rateLimitHits } from "./db/schema";

export type ActionType = "submission" | "like" | "admin_login";

/** Fixed, non-restroom, non-review target for admin-login attempt tracking. */
export const ADMIN_LOGIN_TARGET = "00000000-0000-0000-0000-000000000000";

const SUBMISSION_HOURLY_LIMIT = 15;
const SUBMISSION_MIN_GAP_MS = 5_000;
const ADMIN_LOGIN_HOURLY_LIMIT = 10;
const PURGE_MAX_AGE_HOURS = 24;
/** Small chance any given write also sweeps stale rows — see purgeOldHits(). */
const PURGE_PROBABILITY = 0.05;

function requireSecret(): string {
  const secret = process.env.IP_HASH_SECRET;
  if (!secret) throw new Error("IP_HASH_SECRET is not set");
  return secret;
}

export function hashIp(ip: string): string {
  return createHmac("sha256", requireSecret()).update(ip).digest("hex");
}

/** Vercel injects x-forwarded-for in production; falls back for local dev. */
export function getClientIp(request: Request): string {
  return ipAddress(request) ?? "127.0.0.1";
}

export async function recordHit(ipHash: string, actionType: ActionType, targetId: string) {
  await db.insert(rateLimitHits).values({ ipHash, actionType, targetId });
  if (Math.random() < PURGE_PROBABILITY) {
    await purgeOldHits();
  }
}

/**
 * Daily Vercel Cron (see /api/cron/cleanup) is the guaranteed backstop;
 * this probabilistic sweep on ~5% of writes keeps the table self-bounding
 * between cron runs without adding latency to every request.
 */
export async function purgeOldHits() {
  const cutoff = new Date(Date.now() - PURGE_MAX_AGE_HOURS * 60 * 60 * 1000);
  await db.delete(rateLimitHits).where(lt(rateLimitHits.createdAt, cutoff));
}

export type RateLimitResult = { allowed: true } | { allowed: false; reason: string };

export async function checkSubmissionAllowed(ipHash: string, restroomId: string): Promise<RateLimitResult> {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [{ value: dupCount }] = await db
    .select({ value: count() })
    .from(rateLimitHits)
    .where(
      and(
        eq(rateLimitHits.ipHash, ipHash),
        eq(rateLimitHits.actionType, "submission"),
        eq(rateLimitHits.targetId, restroomId),
        gt(rateLimitHits.createdAt, dayAgo),
      ),
    );
  if (dupCount > 0) return { allowed: false, reason: "already_rated_this_restroom_recently" };

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const [{ value: hourlyCount, lastHit }] = await db
    .select({ value: count(), lastHit: max(rateLimitHits.createdAt) })
    .from(rateLimitHits)
    .where(
      and(
        eq(rateLimitHits.ipHash, ipHash),
        eq(rateLimitHits.actionType, "submission"),
        gt(rateLimitHits.createdAt, hourAgo),
      ),
    );
  if (hourlyCount >= SUBMISSION_HOURLY_LIMIT) return { allowed: false, reason: "too_many_submissions_this_hour" };
  if (lastHit && Date.now() - new Date(lastHit).getTime() < SUBMISSION_MIN_GAP_MS) {
    return { allowed: false, reason: "submitting_too_fast" };
  }
  return { allowed: true };
}

/** Likes are idempotent, not rejected: caller treats "already liked" as a no-op success. */
export async function hasAlreadyLiked(ipHash: string, reviewId: string): Promise<boolean> {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [{ value: existing }] = await db
    .select({ value: count() })
    .from(rateLimitHits)
    .where(
      and(
        eq(rateLimitHits.ipHash, ipHash),
        eq(rateLimitHits.actionType, "like"),
        eq(rateLimitHits.targetId, reviewId),
        gt(rateLimitHits.createdAt, dayAgo),
      ),
    );
  return existing > 0;
}

export async function checkAdminLoginAllowed(ipHash: string): Promise<boolean> {
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const [{ value: attempts }] = await db
    .select({ value: count() })
    .from(rateLimitHits)
    .where(
      and(
        eq(rateLimitHits.ipHash, ipHash),
        eq(rateLimitHits.actionType, "admin_login"),
        gt(rateLimitHits.createdAt, hourAgo),
      ),
    );
  return attempts < ADMIN_LOGIN_HOURLY_LIMIT;
}
