# barra. — Demo and technical guide

## What the project does

barra. detects stock shortfalls, pays for a supplier quote and shows a restocking estimate. It uses simulated inventory and prices with a genuine Testnet payment. It does not buy inventory.

| Component | Responsibility |
| --- | --- |
| JavaScript frontend | Inventory simulation, rules and dashboard |
| Node.js backend | Calculates needs and checks spending before signing |
| Supplier API | Returns simulated prices after verifying payment |
| MPP / `mppx` | HTTP 402 challenge, payment credential and receipt |
| Tempo Moderato | Confirms the test transfer on chain 42431 |

The agent is a deterministic orchestrator. It does not require a language model.

## Run

With Node.js 22 or later, from the repository root:

```sh
npm ci
npm run setup:testnet
npm run dev
```

Open http://localhost:5173. For another port, use `PORT=5186 npm run dev`.

Setup creates disposable test credentials in `barra/.env`, checks the Testnet chain ID and requests free faucet funds. It preserves an existing `.env`. Never use a key that controls real funds. No mainnet mode exists.

The dashboard can open without setup; paying for quotes requires a funded test account and a server restart. The static build needs the Node backend for quotes.

## Request flow

1. **Generate quote** sends inventory, policy and `requestId` to `POST /api/budget`.
2. Node calculates pack quantities and calls `GET /api/supplier/quote`.
3. The supplier returns **402** with `WWW-Authenticate: Payment`.
4. The backend checks the chain, currency, recipient, basket and spending limits, then reserves the fee.
5. The MPP client signs the test transfer and retries with a payment credential.
6. The supplier verifies the payment on Tempo Testnet and returns **200**, simulated prices and `Payment-Receipt`.
7. The dashboard shows the estimated inventory cost and quote fee separately.

The initial inventory needs 40 bottles with a simulated total of **€55.20**. The API fee is **0.01 test pathUSD**; Testnet gas is separate. These currencies are not added together.

The browser's Network panel shows `/api/budget`. The internal 402 exchange appears in the server log and **Payment flow & receipt**.

## Tests

```sh
npm test
npm run demo:testnet
```

Offline tests cover inventory, policies, Testnet restrictions, prices, persistence, concurrent requests and uncertain outcomes. Payment orchestration tests use an explicit test adapter; the unpaid endpoint uses the official SDK.

The Testnet demo starts a temporary server and checks 402 → payment → 200, a confirmed transaction, a blocked paused request, an unchanged inventory object and a repeated request without another payment. Each new run consumes one test quote plus gas and counts against server limits. Run one server process per data directory.

To inspect the API without paying:

```sh
curl -i http://localhost:5173/api/health
curl -i http://localhost:5173/api/supplier/quote
curl -s http://localhost:5173/openapi.json
```

To request a paid test quote without the UI, from the root:

```sh
curl -i http://localhost:5173/api/budget \
  -H 'Content-Type: application/json' \
  --data-binary @barra/examples/budget-request.json
```

Repeat the same request to check `cached: true` and the same receipt. The example has a fixed ID. For a new quote after expiry, use a new UUID. For a blocked case, set `policy.paused` to `true` with another ID.

## Presentation walkthrough

1. Show the initial restocking needs: 40 bottles, four products.
2. Generate a quote. Explain **€55.20 estimated inventory cost** and **0.01 test pathUSD quote fee**.
3. Open the payment details and the Testnet transaction link.
4. Repeat the request: the saved result avoids another payment.
5. Pause Autopilot and show a blocked request before payment.
6. Record a demo sale and show the updated stock shortfall.

The separate **Review demo request** action only records a local simulated request. Generating a quote does not execute it.

A concise project explanation:

> barra. lets an agent pay for supplier information within a spending policy. The supplier advertises its fee through HTTP 402, verifies a Tempo Testnet transfer and returns prices with a receipt. The manager receives a restocking estimate and retains control of inventory purchases.

Be clear about the scope: simulated supplier and stock, deterministic orchestration, localhost, one server process and no real payments. A public hackathon submission additionally needs a live host. Public binding requires a private evaluator code for the demo payer; the current file storage supports one process. See [deployment and submission](DEPLOYMENT.md).

## Debugging

| Question | Where to look |
| --- | --- |
| Button or rendering issue | Browser Console; `src/features/budget.js` |
| Request body or API error | Browser Network → `/api/budget` |
| HTTP 402 challenge | `curl -i` against the supplier route |
| Policy decision | Server log `[budget requestId]`; `server/quotes.mjs` |
| Signing and verification | `server/api.mjs`, `server/payments.mjs` |
| Confirmed payment | Testnet transaction link in the receipt |
| Pending or repeated request | `barra/.data/testnet.json`: status, fee and transaction hash |

For breakpoints, run `node --inspect scripts/serve.mjs` from `barra/`, or use a JavaScript Debug Terminal in your editor. Useful points are challenge receipt, policy approval, credential creation and receipt parsing. Signed transactions have a short validity window, so avoid long pauses after signing. Never print private keys or complete authorization headers.

If signing fails, check faucet funds and RPC connectivity. If a payment outcome is unknown, keep the reservation and inspect the saved transaction hash; do not make another payment to resolve an uncertain outcome. For 403, inspect the policy. For 410, generate a new quote.

## Server limits

Set these in `barra/.env` and restart Node. Browser rules can restrict requests further.

| Variable | Default | Maximum |
| --- | ---: | ---: |
| `QUOTE_MAX_FEE_MICROS` | 10000 = 0.01 test pathUSD | 10000 |
| `QUOTE_DAILY_BUDGET_MICROS` | 50000 = 0.05 test pathUSD | 100000 |
| `QUOTE_MAX_DAILY` | 5 quotes | 10 |
| `QUOTE_MAX_PACKAGES` | 50 packs | 200 |
| `QUOTE_PAUSED` | false | true blocks requests |

The spending day uses UTC. Local demo orders use the browser's date. Pending payments count toward spending limits. Completed responses are cached; reused IDs with different baskets or policies are rejected. SDK replay protection binds credentials to the quoted basket. These records survive normal restarts.

**Reset demo** only changes browser data. It does not erase server spending. The server defaults to localhost. Public binding requires DEMO_ACCESS_CODE; this is not a production identity system. Keep `.env` and `.data/` out of Git.

## Sources

Implementation references consulted on 10 November 2026:

- [Hackathon guide](https://mpp-hackathon.vercel.app/)
- [MPP server quickstart](https://mpp.dev/quickstart/server)
- [Manual credential handling](https://mpp.dev/sdk/typescript/client/Mppx.create)
- [Tempo charge and replay protection](https://mpp.dev/sdk/typescript/server/Method.tempo.charge)
- [API discovery](https://mpp.dev/extensions/discovery)

Pinned SDKs: `mppx@0.18.0`, `viem@2.57.1`. Recorded Testnet evidence is in `testnet-evidence.json`.

For a hands-on walkthrough, see [Debug one request](DEBUGGING.md).
