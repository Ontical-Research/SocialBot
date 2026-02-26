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

## Running the Bot

SocialBot includes an AI bot participant that joins the chat room and responds to messages
using a large language model. The bot requires a local proxy server and an LLM API key.

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) with the Compose plugin (v2+)
- [Node.js](https://nodejs.org/) (see `package.json` for the required version)
- An LLM API key — set as an environment variable before starting the bot:

For Anthropic models (e.g. `claude-haiku-4-5-20251001`):

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

For OpenAI models (e.g. `gpt-4o`, `o3-mini`), set `OPENAI_API_KEY` instead.
Other providers need their own keys — see the model string format below.

### Model string format

The bot's **Model** field accepts model identifier strings in the format used by the
provider's API:

| Provider  | Example model string        |
| --------- | --------------------------- |
| Anthropic | `claude-haiku-4-5-20251001` |
| Anthropic | `claude-sonnet-4-6`         |
| OpenAI    | `gpt-4o`                    |
| OpenAI    | `o3-mini`                   |

For the full list of Anthropic model names, see the
[Anthropic models documentation](https://docs.anthropic.com/en/docs/about-claude/models).
For OpenAI, see the [OpenAI models page](https://platform.openai.com/docs/models).

### Steps to start the bot

1. Start the NATS broker (if not already running):

   ```bash
   docker compose up -d
   ```

2. Start the bot server and Vite dev server together:

   ```bash
   npm run bot
   ```

   This opens `http://localhost:5173/bot` in your browser automatically.

### Alice + Bob demo session

With the bot running, open a second browser tab for Alice:

**Tab 1 — Alice (human)**

```
http://localhost:5173
```

Enter **Name:** `Alice`, **Topic:** `chat`, then click **Connect**.

**Tab 2 — Bob (bot)**

```
http://localhost:5173/bot
```

- **Name:** `Bob`
- **Topic:** `chat`
- **Model:** `claude-haiku-4-5-20251001`
- **Prompt file:** browse to `prompts/friendly.md` in the repo root

Click **Connect**. Alice's messages will appear in both windows, and Bob's LLM
responses will appear within a few seconds.

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

> **Note:** The GitHub Pages demo is the **human UI only** — the `/bot` route and LLM
> proxy require a local server and API key. For Alice + Bob bot sessions, follow the
> [Running the Bot](#running-the-bot) instructions above.

Open the published URL in two browser tabs. Make sure your local NATS server is running:

```bash
docker compose up -d
```

Then in each tab, enter a different name (e.g. `Alice` and `Bob`) with the same topic,
and click **Connect**. Messages appear in both tabs in real time.
