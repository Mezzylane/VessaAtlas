import { sql } from "drizzle-orm";
import {
  bigserial,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const genderEnum = pgEnum("gender", ["men", "women", "unisex"]);

export const restrooms = pgTable(
  "restrooms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    building: text("building").notNull(),
    // sort key, allows negatives for basement floors
    floorNumber: smallint("floor_number").notNull(),
    // display text, e.g. "1st floor"
    floorLabel: text("floor_label").notNull(),
    wing: text("wing"),
    gender: genderEnum("gender").notNull(),
    // integer SVG viewBox units — exact-match grouping for cluster pins depends on this
    xCoord: integer("x_coord").notNull(),
    yCoord: integer("y_coord").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("restrooms_coord_idx").on(t.xCoord, t.yCoord)],
);

/**
 * Anonymity guarantee (structural, not policy): this table must NEVER gain an
 * ip / cookie_id / user_id / session_id column. Nothing here should ever be
 * joinable back to a submitter. Do not join this table to rate_limit_hits.
 */
export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restroomId: uuid("restroom_id")
      .notNull()
      .references(() => restrooms.id, { onDelete: "cascade" }),
    rating: smallint("rating").notNull(),
    comment: text("comment"),
    likeCount: integer("like_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("reviews_helpful_idx").on(t.restroomId, t.likeCount, t.createdAt),
    check("rating_range", sql`${t.rating} BETWEEN 1 AND 10`),
    check("comment_length", sql`char_length(${t.comment}) <= 500`),
  ],
);

/**
 * One polymorphic table backing every rate-limit and like-dedupe check.
 * target_id intentionally has NO foreign key: it's polymorphic (points at
 * restrooms.id for 'submission' rows, reviews.id for 'like' rows) and must
 * never read as a sanctioned join path back into reviews. Rows are purged
 * after ~24h (see /api/cron/cleanup and the lazy delete in rate-limit.ts).
 */
export const rateLimitHits = pgTable(
  "rate_limit_hits",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    // HMAC-SHA256(ip, IP_HASH_SECRET) — never the raw IP
    ipHash: text("ip_hash").notNull(),
    actionType: text("action_type").notNull(), // 'submission' | 'like' | 'admin_login'
    targetId: uuid("target_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("rlh_window_idx").on(t.ipHash, t.actionType, t.createdAt),
    index("rlh_target_idx").on(t.ipHash, t.actionType, t.targetId, t.createdAt),
  ],
);
