# Chirpy API

Chirpy is a RESTful HTTP server built with TypeScript, Express, PostgreSQL, and Drizzle ORM.

The project implements a small social API where users can register, authenticate, create chirps, manage their account, and interact with protected resources.

> Built as part of the Boot.dev HTTP Servers in TypeScript course.

## Features

- User registration and login
- Password hashing with Argon2
- JWT access-token authentication
- Refresh tokens and token revocation
- Authorization for protected resources
- Create, read, and delete chirps
- Filter chirps by author
- Sort chirps by creation date
- PostgreSQL database
- Drizzle ORM and database migrations
- Webhook handling
- API-key protected webhooks
- Chirpy Red user upgrades
- Error handling and HTTP status codes
- Static file serving
- Admin metrics and development reset endpoint

## Tech Stack

- TypeScript
- Node.js
- Express
- PostgreSQL
- Drizzle ORM
- Argon2
- JSON Web Tokens (JWT)
- Vitest

## Getting Started

Install dependencies:

```bash
npm install
```

Create a `.env` file:

```env
DB_URL="postgres://postgres:postgres@localhost:5432/chirpy?sslmode=disable"
PLATFORM="dev"
JWT_SECRET="your-secret"
POLKA_KEY="your-polka-api-key"
```

Generate database migrations when needed:

```bash
npx drizzle-kit generate
```

Build the project:

```bash
npm run build
```

Run the server:

```bash
npm run dev
```

The API runs on:

```text
http://localhost:8080
```

## Main API Endpoints

### Users

```text
POST /api/users
PUT  /api/users
POST /api/login
POST /api/refresh
POST /api/revoke
```

### Chirps

```text
POST   /api/chirps
GET    /api/chirps
GET    /api/chirps/:chirpId
DELETE /api/chirps/:chirpId
```

Filter chirps by author:

```text
GET /api/chirps?authorId=<USER_ID>
```

Sort chirps:

```text
GET /api/chirps?sort=asc
GET /api/chirps?sort=desc
```

Both parameters can be combined:

```text
GET /api/chirps?authorId=<USER_ID>&sort=desc
```

### Webhooks

```text
POST /api/polka/webhooks
```

Polka webhooks are protected using an API key:

```text
Authorization: ApiKey <POLKA_KEY>
```

### Admin

```text
GET  /admin/metrics
POST /admin/reset
```

## Authentication

Protected endpoints use JWT access tokens.

```text
Authorization: Bearer <ACCESS_TOKEN>
```

Access tokens expire after one hour. Refresh tokens can be used to obtain new access tokens without requiring the user to log in again.

## Tests

Run the test suite with:

```bash
npm test
```

## Security

Sensitive values such as database credentials, JWT secrets, and API keys are stored in `.env`.

The `.env` file is excluded from Git and should never be committed.

## License

This project was created for educational purposes.