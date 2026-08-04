import { config } from "./config.js";
import express, { NextFunction, Request, Response } from "express";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "./errors.js";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";import {
  createUser,
  deleteUsers,
} from "./db/queries/users.js";
import {
  createChirp,
  getAllChirps,
  getChirpById,
} from "./db/queries/chirps.js";



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
  userId: string;
};

async function handlerCreateChirp(
  req: Request,
  res: Response
): Promise<void> {
  const params = req.body as CreateChirpParams;

  if (
    typeof params.body !== "string" ||
    typeof params.userId !== "string"
  ) {
    throw new BadRequestError("Invalid request body");
  }

  if (params.body.length > 140) {
    throw new BadRequestError(
      "Chirp is too long. Max length is 140"
    );
  }

  const cleanedBody = cleanChirp(params.body);

  const chirp = await createChirp({
    body: cleanedBody,
    userId: params.userId,
  });

  res.status(201).json(chirp);``
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
};

async function handlerCreateUser(
  req: Request,
  res: Response
): Promise<void> {
  const params = req.body as CreateUserParams;

  const user = await createUser({
    email: params.email,
  });

  res.status(201).json(user);
}

async function handlerGetChirps(
  _req: Request,
  res: Response
): Promise<void> {
  const chirps = await getAllChirps();

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