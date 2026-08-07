import express, {
  NextFunction,
  Request,
  Response,
} from "express";

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

import { config } from "./config.js";

import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "./errors.js";

import {
  checkPasswordHash,
  getAPIKey,
  getBearerToken,
  hashPassword,
  makeJWT,
  makeRefreshToken,
  validateJWT,
} from "./auth.js";

import {
  createRefreshToken,
  getUserFromRefreshToken,
  revokeRefreshToken,
} from "./db/queries/refreshTokens.js";

import {
  createUser,
  deleteUsers,
  getUserByEmail,
  updateUser,
  upgradeUserToChirpyRed,
} from "./db/queries/users.js";

import {
  createChirp,
  deleteChirpById,
  getAllChirps,
  getChirpById,
} from "./db/queries/chirps.js";

import type { UserResponse } from "./db/schema.js";







const migrationClient = postgres(config.db.url, {
  max: 1,
});

await migrate(
  drizzle(migrationClient),
  config.db.migrationConfig
);

const app = express();
const PORT = 8080;
app.use(express.json());

app.use(middlewareLogResponses);


app.get("/api/healthz", handlerReadiness);

app.use(
  "/app",
  middlewareMetricsInc,
  express.static("./src/app")
);

app.get("/admin/metrics", handlerMetrics);
app.post("/admin/reset", handlerReset);

app.post("/api/users", handlerCreateUser);
app.post("/api/chirps", handlerCreateChirp);
app.get("/api/chirps", handlerGetChirps);
app.get("/api/chirps/:chirpId", handlerGetChirp);
app.post("/api/login", handlerLogin);
app.post("/api/refresh", handlerRefresh);
app.post("/api/revoke", handlerRevoke);
app.put("/api/users", handlerUpdateUser);
app.delete(
  "/api/chirps/:chirpId",
  handlerDeleteChirp
);
app.post(
  "/api/polka/webhooks",
  handlerPolkaWebhook
);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});

function handlerReadiness(_req: Request, res: Response): void {
  res.set("Content-Type", "text/plain; charset=utf-8");
  res.send("OK");
}


function middlewareLogResponses(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  res.on("finish", () => {
    const statusCode = res.statusCode;

    if (statusCode < 200 || statusCode >= 300) {
      console.log(
        `[NON-OK] ${req.method} ${req.url} - Status: ${statusCode}`
      );
    }
  });

  next();
}

function middlewareMetricsInc(
  _req: Request,
  _res: Response,
  next: NextFunction
): void {
  config.api.fileserverHits++;
  next();
}

function handlerMetrics(_req: Request, res: Response): void {
  res.set("Content-Type", "text/html; charset=utf-8");

  res.send(`
<html>
  <body>
    <h1>Welcome, Chirpy Admin</h1>
    <p>Chirpy has been visited ${config.api.fileserverHits} times!</p>
  </body>
</html>
  `);
}

async function handlerReset(
  _req: Request,
  res: Response
): Promise<void> {
  if (config.api.platform !== "dev") {
    throw new ForbiddenError("Forbidden");
  }

  await deleteUsers();
  config.api.fileserverHits = 0;

  res.set("Content-Type", "text/plain; charset=utf-8");
  res.send("Hits reset to 0");
}

type ValidateChirpParams = {
  body: string;
};


type CreateChirpParams = {
  body: string;
};

async function handlerCreateChirp(
  req: Request,
  res: Response
): Promise<void> {
  const params = req.body as CreateChirpParams;

  if (typeof params.body !== "string") {
    throw new BadRequestError("Invalid request body");
  }

  let userId: string;

  try {
    const token = getBearerToken(req);

    userId = validateJWT(
      token,
      config.api.jwtSecret
    );
  } catch {
    throw new UnauthorizedError("Invalid token");
  }

  if (params.body.length > 140) {
    throw new BadRequestError(
      "Chirp is too long. Max length is 140"
    );
  }

  const cleanedBody = cleanChirp(params.body);

  const chirp = await createChirp({
    body: cleanedBody,
    userId,
  });

  res.status(201).json(chirp);
}



function cleanChirp(body: string): string {
  const profaneWords = ["kerfuffle", "sharbert", "fornax"];

  const words = body.split(" ");

  const cleanedWords = words.map((word) => {
    if (profaneWords.includes(word.toLowerCase())) {
      return "****";
    }

    return word;
  });

  return cleanedWords.join(" ");
}


function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.log(err);

  if (err instanceof BadRequestError) {
    res.status(400).json({
      error: err.message,
    });
    return;
  }

  if (err instanceof UnauthorizedError) {
    res.status(401).json({
      error: err.message,
    });
    return;
  }

  if (err instanceof ForbiddenError) {
    res.status(403).json({
      error: err.message,
    });
    return;
  }

  if (err instanceof NotFoundError) {
    res.status(404).json({
      error: err.message,
    });
    return;
  }

  res.status(500).json({
    error: "Something went wrong on our end",
  });
}

type CreateUserParams = {
  email: string;
  password: string;
};

type LoginParams = {
  email: string;
  password: string;
};

type UpdateUserParams = {
  email: string;
  password: string;
};

type PolkaWebhookParams = {
  event: string;
  data: {
    userId: string;
  };
};

async function handlerCreateUser(
  req: Request,
  res: Response
): Promise<void> {
  const params = req.body as CreateUserParams;

  if (
    typeof params.email !== "string" ||
    typeof params.password !== "string"
  ) {
    throw new BadRequestError("Invalid request body");
  }

  const hashedPassword = await hashPassword(params.password);

  const user = await createUser({
    email: params.email,
    hashedPassword,
  });

  if (!user) {
    throw new BadRequestError("User could not be created");
  }

 const response: UserResponse = {
  id: user.id,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  email: user.email,
  isChirpyRed: user.isChirpyRed,
};

  res.status(201).json(response);
}

async function handlerGetChirps(
  req: Request,
  res: Response
): Promise<void> {
  const authorIdQuery = req.query.authorId;
  const sortQuery = req.query.sort;

  let authorId: string | undefined;

  if (typeof authorIdQuery === "string") {
    authorId = authorIdQuery;
  }

  const chirps = await getAllChirps(authorId);

  if (sortQuery === "desc") {
    chirps.sort(
      (a, b) =>
        b.createdAt.getTime() - a.createdAt.getTime()
    );
  } else {
    chirps.sort(
      (a, b) =>
        a.createdAt.getTime() - b.createdAt.getTime()
    );
  }

  res.status(200).json(chirps);
}

async function handlerGetChirp(
  req: Request<{ chirpId: string }>,
  res: Response
): Promise<void> {
  const chirpId = req.params.chirpId;

  const chirp = await getChirpById(chirpId);

  if (!chirp) {
    throw new NotFoundError("Chirp not found");
  }

  res.status(200).json(chirp);
}

async function handlerLogin(
  req: Request,
  res: Response
): Promise<void> {
  const params = req.body as LoginParams;

  if (
    typeof params.email !== "string" ||
    typeof params.password !== "string"
  ) {
    throw new UnauthorizedError(
      "Incorrect email or password"
    );
  }

  const user = await getUserByEmail(params.email);

  if (!user) {
    throw new UnauthorizedError(
      "Incorrect email or password"
    );
  }

  let passwordsMatch: boolean;

  try {
    passwordsMatch = await checkPasswordHash(
      params.password,
      user.hashedPassword
    );
  } catch {
    throw new UnauthorizedError(
      "Incorrect email or password"
    );
  }

  if (!passwordsMatch) {
    throw new UnauthorizedError(
      "Incorrect email or password"
    );
  }

  const accessToken = makeJWT(
  user.id,
  60 * 60,
  config.api.jwtSecret
);

const refreshToken = makeRefreshToken();

const refreshTokenExpiresAt = new Date(
  Date.now() + 60 * 24 * 60 * 60 * 1000
);

await createRefreshToken({
  token: refreshToken,
  userId: user.id,
  expiresAt: refreshTokenExpiresAt,
});

const response: UserResponse & {
  token: string;
  refreshToken: string;
} = {
  id: user.id,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  email: user.email,
  isChirpyRed: user.isChirpyRed,
  token: accessToken,
  refreshToken,
};

res.status(200).json(response);
}


async function handlerRefresh(
  req: Request,
  res: Response
): Promise<void> {
  let refreshToken: string;

  try {
    refreshToken = getBearerToken(req);
  } catch {
    throw new UnauthorizedError("Invalid refresh token");
  }

  const user = await getUserFromRefreshToken(
    refreshToken
  );

  if (!user) {
    throw new UnauthorizedError("Invalid refresh token");
  }

  const accessToken = makeJWT(
    user.id,
    60 * 60,
    config.api.jwtSecret
  );

  res.status(200).json({
    token: accessToken,
  });
}


async function handlerRevoke(
  req: Request,
  res: Response
): Promise<void> {
  let refreshToken: string;

  try {
    refreshToken = getBearerToken(req);
  } catch {
    throw new UnauthorizedError("Invalid refresh token");
  }

  await revokeRefreshToken(refreshToken);

  res.status(204).send();
}


async function handlerUpdateUser(
  req: Request,
  res: Response
): Promise<void> {
  let userId: string;

  try {
    const token = getBearerToken(req);

    userId = validateJWT(
      token,
      config.api.jwtSecret
    );
  } catch {
    throw new UnauthorizedError("Invalid token");
  }

  const params = req.body as UpdateUserParams;

  if (
    typeof params.email !== "string" ||
    typeof params.password !== "string"
  ) {
    throw new BadRequestError("Invalid request body");
  }

  const hashedPassword = await hashPassword(
    params.password
  );

  const updatedUser = await updateUser(
    userId,
    params.email,
    hashedPassword
  );

  if (!updatedUser) {
    throw new UnauthorizedError("Invalid token");
  }

  res.status(200).json(updatedUser);
}


async function handlerDeleteChirp(
  req: Request<{ chirpId: string }>,
  res: Response
): Promise<void> {
  let userId: string;

  try {
    const token = getBearerToken(req);

    userId = validateJWT(
      token,
      config.api.jwtSecret
    );
  } catch {
    throw new UnauthorizedError("Invalid token");
  }

  const chirpId = req.params.chirpId;

  const chirp = await getChirpById(chirpId);

  if (!chirp) {
    throw new NotFoundError("Chirp not found");
  }

  if (chirp.userId !== userId) {
    throw new ForbiddenError(
      "You are not allowed to delete this chirp"
    );
  }

  await deleteChirpById(chirpId);

  res.status(204).send();
}

async function handlerPolkaWebhook(
  req: Request,
  res: Response
): Promise<void> {
  let apiKey: string;

  try {
    apiKey = getAPIKey(req);
  } catch {
    throw new UnauthorizedError("Invalid API key");
  }

  if (apiKey !== config.api.polkaKey) {
    throw new UnauthorizedError("Invalid API key");
  }

  const params = req.body as PolkaWebhookParams;

  if (params.event !== "user.upgraded") {
    res.status(204).send();
    return;
  }

  const user = await upgradeUserToChirpyRed(
    params.data.userId
  );

  if (!user) {
    throw new NotFoundError("User not found");
  }

  res.status(204).send();
}