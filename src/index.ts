import { config } from "./config.js";
import express, { NextFunction, Request, Response } from "express";




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
app.post("/api/validate_chirp", handlerValidateChirp);

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
  config.fileserverHits++;
  next();
}

function handlerMetrics(_req: Request, res: Response): void {
  res.set("Content-Type", "text/html; charset=utf-8");

  res.send(`
<html>
  <body>
    <h1>Welcome, Chirpy Admin</h1>
    <p>Chirpy has been visited ${config.fileserverHits} times!</p>
  </body>
</html>
  `);
}

function handlerReset(_req: Request, res: Response): void {
  config.fileserverHits = 0;

  res.set("Content-Type", "text/plain; charset=utf-8");
  res.send("Hits reset to 0");
}

type ValidateChirpParams = {
  body: string;
};

function handlerValidateChirp(req: Request, res: Response): void {
  const params = req.body as ValidateChirpParams;

  if (typeof params.body !== "string") {
    res.status(400).json({
      error: "Something went wrong",
    });
    return;
  }

  if (params.body.length > 140) {
    res.status(400).json({
      error: "Chirp is too long",
    });
    return;
  }

  const cleanedBody = cleanChirp(params.body);

  res.status(200).json({
     cleanedBody,
  });
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