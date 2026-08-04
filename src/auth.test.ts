import {
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import {
  checkPasswordHash,
  hashPassword,
  makeJWT,
  validateJWT,
} from "./auth.js";

describe("Password Hashing", () => {
  const correctPassword = "correctPassword123!";
  const wrongPassword = "wrongPassword456!";

  let hash: string;

  beforeAll(async () => {
    hash = await hashPassword(correctPassword);
  });

  it("accepts the correct password", async () => {
    const result = await checkPasswordHash(
      correctPassword,
      hash
    );

    expect(result).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const result = await checkPasswordHash(
      wrongPassword,
      hash
    );

    expect(result).toBe(false);
  });
});

describe("JWT", () => {
  const userID = "user-123";
  const secret = "test-secret";

  it("creates and validates a JWT", () => {
    const token = makeJWT(userID, 60, secret);

    const result = validateJWT(token, secret);

    expect(result).toBe(userID);
  });

  it("rejects an expired JWT", () => {
    const token = makeJWT(userID, -1, secret);

    expect(() => {
      validateJWT(token, secret);
    }).toThrow();
  });

  it("rejects a JWT signed with another secret", () => {
    const token = makeJWT(userID, 60, secret);

    expect(() => {
      validateJWT(token, "wrong-secret");
    }).toThrow();
  });
});