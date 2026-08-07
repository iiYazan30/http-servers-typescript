import argon2 from "argon2";
import type { Request } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { randomBytes } from "node:crypto";


export async function hashPassword(
  password: string
): Promise<string> {
  return argon2.hash(password);
}

export async function checkPasswordHash(
  password: string,
  hash: string
): Promise<boolean> {
  return argon2.verify(hash, password);
}


export function makeJWT(
  userID: string,
  expiresIn: number,
  secret: string
): string {
  const issuedAt = Math.floor(Date.now() / 1000);

  const payload: Pick<
    JwtPayload,
    "iss" | "sub" | "iat" | "exp"
  > = {
    iss: "chirpy",
    sub: userID,
    iat: issuedAt,
    exp: issuedAt + expiresIn,
  };

  return jwt.sign(payload, secret);
}

export function validateJWT(
  tokenString: string,
  secret: string
): string {
  const payload = jwt.verify(
    tokenString,
    secret
  ) as JwtPayload;

  if (!payload.sub) {
    throw new Error("JWT is missing subject");
  }

  return payload.sub;
}

export function getBearerToken(req: Request): string {
  const authHeader = req.get("Authorization");

  if (!authHeader) {
    throw new Error("Missing Authorization header");
  }

  const [scheme, token] = authHeader.trim().split(/\s+/);

  if (scheme !== "Bearer" || !token) {
    throw new Error("Invalid Authorization header");
  }

  return token;
}

export function makeRefreshToken(): string {
  return randomBytes(32).toString("hex");
}

export function getAPIKey(req: Request): string {
  const authHeader = req.get("Authorization");

  if (!authHeader) {
    throw new Error("Missing Authorization header");
  }

  const [scheme, apiKey] = authHeader.trim().split(/\s+/);

  if (scheme !== "ApiKey" || !apiKey) {
    throw new Error("Invalid Authorization header");
  }

  return apiKey;
}