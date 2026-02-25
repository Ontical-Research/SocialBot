# SocialBot

NATS Chatbot

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) with the Compose plugin (v2+)
- [Node.js](https://nodejs.org/) (see `package.json` for the required version)

## Getting Started

### 1. Start the NATS broker

SocialBot uses [NATS](https://nats.io/) as its message broker. A `docker-compose.yml` is
provided that starts a NATS server with TCP, WebSocket, and HTTP monitor ports exposed.

```bash
docker compose up -d
```

This starts a NATS container (`socialbot-nats`) with the following ports:

| Port | Protocol  | Description          |
| ---- | --------- | -------------------- |
| 4222 | TCP/NATS  | Standard NATS client |
| 8222 | HTTP      | NATS monitoring UI   |
| 9222 | WebSocket | WebSocket clients    |

You can verify the server is running by checking the monitor endpoint:

```bash
curl http://localhost:8222/varz
```

To stop the NATS container:

```bash
docker compose down
```

### 2. Install dependencies

```bash
npm install
```

### 3. Start the development server

```bash
npm run dev
```

## Chatting as Alice and Bob

With the NATS broker and dev server both running, open two browser tabs:

**Tab 1 — Alice**

```
http://localhost:5173
```

Enter **Name:** `Alice`, **Topic:** `chat`, then click **Connect**.

**Tab 2 — Bob**

```
http://localhost:5173
```

Enter **Name:** `Bob`, **Topic:** `chat`, then click **Connect**.

Messages sent in either tab appear instantly in both. Any name and topic can
be used; participants on the same topic see each other's messages.

## Running Tests

```bash
npm test
```

## Deployment (GitHub Pages)

The app is published automatically to GitHub Pages on every push to `main` that passes CI.
The live demo connects to whatever NATS server is running on the visitor's own machine at
`ws://localhost:9222`, so no external NATS infrastructure is required.

### One-time repository setup

A repo admin must enable GitHub Actions-based Pages once before the first deployment will succeed:

1. Go to **Settings → Pages** in the GitHub repository.
2. Under **Build and deployment → Source**, select **GitHub Actions**.

This only needs to be done once. After that, every merge to `main` triggers the `deploy` job
in CI, which builds the app with the correct `/SocialBot/` base path and publishes the `dist`
folder to GitHub Pages. The deployed URL is reported in the Actions UI under the `deploy` job.

### How the CI deploy job works

- The `deploy` job runs only on `push` to `main` (pull requests skip it).
- It waits for the `ci` job (tests, lint, format check) to pass before deploying.
- The build sets `VITE_BASE_URL=/SocialBot/` so all asset paths and routing work correctly
  under the GitHub Pages subpath.

### Live demo usage

Open the published URL in two browser tabs. Make sure your local NATS server is running:

```bash
docker compose up -d
```

Then in each tab, enter a different name (e.g. `Alice` and `Bob`) with the same topic,
and click **Connect**. Messages appear in both tabs in real time.
