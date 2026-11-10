# barra.

Inventory planning with paid supplier quotes. English UI, larger text and concise demo screens.

## Run and test

From the repository root with Node.js 22 or later:

```sh
npm ci
npm run setup:testnet
npm run dev
```

Open http://localhost:5173. Use **Restocking → Generate quote** for the MPP flow, **Menu** for demo sales, **Ingredients** for stock targets, and **My Autopilot** for policies.

`npm test` runs offline checks. `npm run demo:testnet` verifies a complete Testnet payment. `npm run build` exports the dashboard to `dist/`; the paid API requires Node.js.

## Files

| Location | Purpose |
| --- | --- |
| `index.html` | Views, navigation and short demo guide |
| `src/main.js` | Menu, sales, stock and navigation |
| `src/features/operations.js` | Restocking and local demo requests |
| `src/features/budget.js` | Quote button, totals and receipt |
| `src/data/` | Drinks, ingredients, pack units and stock targets |
| `src/lib/inventory.js` | Shared inventory and restocking calculations |
| `src/lib/order-policy.js` | Local request rules |
| `server/api.mjs` | Supplier API and quote orchestration |
| `server/quotes.mjs` | Simulated prices and spending checks |
| `server/payments.mjs` | MPP client and verifier |
| `server/config.mjs` | Fixed Testnet settings and server limits |
| `server/store.mjs` | Persistent records for one process |
| `src/styles/main.css` | Layout, readable typography and responsive styles |
| `scripts/` | Local server, build and Testnet setup/demo |
| `tests/` | Inventory, persistence, rules and quote checks |

## Data and limits

Inventory and local requests stay in the browser's existing `barra:*` storage keys. IDs, quantities, policies and saved targets are preserved when labels change. **Reset demo** refills stock and clears local requests; it does not clear server spending records.

The initial request contains 19 lager, 3 IPA, 12 stout and 6 alcohol-free beers: 40 bottles, **€55.20** in simulated prices. Each quote costs **0.01 test pathUSD**, plus Testnet gas. Nothing purchases or receives inventory.

The server checks monetary limits before signing and keeps pending payments reserved. One data directory supports one Node process. Public binding requires a private demo access code. This is not a multiuser identity system. Container configuration is included; a live public deployment is still pending.

[Demo and debugging guide](docs/MPP-MVP.md). Original illustrations and generation prompts remain in `public/images/`.

[Debugging walkthrough](docs/DEBUGGING.md) · [Public deployment and submission](docs/DEPLOYMENT.md).
