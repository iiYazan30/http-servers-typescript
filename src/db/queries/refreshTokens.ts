import {
  and,
  eq,
  gt,
  isNull,
} from "drizzle-orm";

import { db } from "../index.js";

import {
  refreshTokens,
  users,
  type NewRefreshToken,
} from "../schema.js";

export async function createRefreshToken(
  refreshToken: NewRefreshToken
) {
  const [result] = await db
    .insert(refreshTokens)
    .values(refreshToken)
    .returning();

  return result;
}

export async function getUserFromRefreshToken(
  token: string
) {
  const [result] = await db
    .select({
      id: users.id,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      email: users.email,
    })
    .from(refreshTokens)
    .innerJoin(
      users,
      eq(refreshTokens.userId, users.id)
    )
    .where(
      and(
        eq(refreshTokens.token, token),
        gt(refreshTokens.expiresAt, new Date()),
        isNull(refreshTokens.revokedAt)
      )
    );

  return result;
}

export async function revokeRefreshToken(
  token: string
) {
  const now = new Date();

  const [result] = await db
    .update(refreshTokens)
    .set({
      revokedAt: now,
      updatedAt: now,
    })
    .where(eq(refreshTokens.token, token))
    .returning();

  return result;
}