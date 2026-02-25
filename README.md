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

## Running Tests

```bash
npm test
```
