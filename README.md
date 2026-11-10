# barra. — Restocking & paid supplier quotes

A JavaScript dashboard and Node.js API for inventory planning. An agent pays **0.01 test pathUSD** for a simulated supplier quote using MPP on **Tempo Testnet (Moderato, 42431)**. No inventory is purchased.

## Run

Node.js 22 or later. From the repository root:

```sh
npm ci
npm run setup:testnet
npm run dev
```

Open http://localhost:5173 and select **Generate quote**. If the port is in use, run `PORT=5186 npm run dev` and open http://localhost:5186.

## Verify

```sh
npm test                 # offline tests
npm run demo:testnet     # complete HTTP + Testnet payment check
npm run build            # static dashboard; paid quotes still need Node
```

The initial inventory needs 40 bottles across four products, estimated at **€55.20**. The quote fee is displayed separately. A repeated request uses the saved result without another payment.

## Architecture

- Browser: inventory simulation, rules and dashboard.
- Node.js: spending checks and quote orchestration at `POST /api/budget`.
- Supplier API: `GET /api/supplier/quote`, protected by MPP.
- Tempo Testnet: confirmed test transfer and `Payment-Receipt`.

The UI uses English copy, larger text and collapsible secondary details for presentations.

[Demo and presentation guide](barra/docs/MPP-MVP.md) · [Debug one request](barra/docs/DEBUGGING.md) · [Public deployment and submission](barra/docs/DEPLOYMENT.md) · [Project structure](barra/README.md) · [Recorded Testnet evidence](barra/docs/testnet-evidence.json)

Keys are stored only in `barra/.env`. Payment records and replay protection are in `barra/.data/`. Both are ignored by Git. Run one Node process per data directory. Inventory and prices are simulated; real payments are disabled. Public hosting requires a demo access code and a persistent data directory. A Dockerfile is included; a live deployment is still pending.
