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

### 3. (Optional) Set LLM API keys

To use an AI bot participant, export one or both API keys before starting:

```bash
export ANTHROPIC_API_KEY=sk-ant-...   # enables Claude models
export OPENAI_API_KEY=sk-...          # enables GPT/o-series models
```

The login page's **Model** dropdown will only show models whose provider key is present.
If no keys are set, the dropdown shows only **None** (human mode).

### 4. Start the app

```bash
npm start
```

This starts the Express proxy server on port 3001 and the Vite dev server, then opens
`http://localhost:5173/` in your browser automatically.

## Multi-Agent Tabs

SocialBot runs multiple agents in a single browser window. A vertical tab strip on the
left side lists all active agents. Each tab is independent — it has its own NATS connection
and message history.

- **Add a tab** — click the **+** button at the bottom of the tab strip.
- **Remove a tab** — click the **×** button on the tab, then confirm. The last tab cannot
  be removed.
- **Duplicate names** — two connected agents cannot share the same name. The Connect button
  is disabled and an error is shown if you try.

## Using the Login Page

Each new tab opens a login form with four fields:

| Field  | Human mode         | Bot mode                         |
| ------ | ------------------ | -------------------------------- |
| Name   | Your display name  | Bot's display name               |
| Topic  | NATS topic to join | NATS topic to join               |
| Model  | **None**           | Select a model from the dropdown |
| Prompt | (disabled)         | Select from history or Browse... |

- **Human mode** — leave **Model** as `None` and click **Connect**. You join the chat as a
  human participant and can send messages.
- **Bot mode** — select a model, then choose a prompt file. The bot joins silently, listens
  on the topic, and replies using the LLM.

Name and topic selections are remembered across sessions. Previously used models and prompts
appear in their respective dropdowns for quick re-selection.

## YAML Config Files

Pass a YAML file to `npm start` to pre-populate agents at startup, skipping the login form:

```bash
npm start -- demo.yaml
npm start -- my-agents.yaml
```

### YAML schema

```yaml
nats_url: ws://localhost:9222 # optional, defaults to ws://localhost:9222
agents:
  - name: Alice
    topic: chat
  - name: Bob
    topic: chat
    model: claude-haiku-4-5-20251001
    prompt: prompts/friendly.md # path relative to project root, or absolute
```

The `model` and `prompt` fields are optional. Omitting them puts the agent in human mode.

## Running the Alice + Bob Demo

`demo.yaml` (included in the repo) launches Alice as a human and Bob as a Claude bot, both
on the `chat` topic, in a single browser window:

```bash
npm start -- demo.yaml
```

Both agents appear as tabs immediately — no login form required.

## Running Tests

```bash
npm test
```

## Available Models

The **Model** dropdown is populated from the server based on which API keys are set:

| Key                 | Models available                                                    |
| ------------------- | ------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY` | `claude-haiku-4-5-20251001`, `claude-sonnet-4-6`, `claude-opus-4-6` |
| `OPENAI_API_KEY`    | `gpt-4o`, `o3`, `o4-mini`                                           |

For the full list of Anthropic model names, see the
[Anthropic models documentation](https://docs.anthropic.com/en/docs/about-claude/models).
For OpenAI, see the [OpenAI models page](https://platform.openai.com/docs/models).

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

> **Note:** The GitHub Pages demo shows the login page, but bot mode requires a local
> `npm start` session with API keys set. For Alice + Bob bot sessions, follow the
> [Running the Alice + Bob Demo](#running-the-alice--bob-demo) instructions above.

Open the published URL. Make sure your local NATS server is running:

```bash
docker compose up -d
```

Add agents via the **+** button, enter a name and topic, and click **Connect**.
Messages appear in real time across all tabs on the same topic.
