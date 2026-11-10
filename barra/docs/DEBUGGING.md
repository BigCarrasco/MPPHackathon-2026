# Follow one quote from button to receipt

## Start the debugger

Stop the regular server first. From the repository root:

```sh
npm run debug
```

Use VS Code's **JavaScript Debug Terminal**, or attach a Node debugger to the inspector URL printed in the terminal. Open http://localhost:5173. Browser DevTools and the Node debugger are separate: the browser inspects the UI, Node inspects policy checks and payments.

## Set these breakpoints

| File | Pause at | What you learn |
| --- | --- | --- |
| `src/features/budget.js` | `fetch('/api/budget', ...)` | The inventory, policy and request ID sent by the browser |
| `server/api.mjs` | `const items = itemsFromState(state)` | Quantities calculated from stock targets |
| `server/api.mjs` | `if (unpaid.status !== 402)` | The supplier asks for payment instead of returning prices |
| `server/api.mjs` | `checkChallenge(...)` | Network, token, recipient, basket and spending are checked |
| `server/api.mjs` | `payment.createCredential()` | The first point at which a payment is signed |
| `server/api.mjs` | `Receipt.fromResponse(paid)` | The supplier accepted payment and returned a receipt |

Keep pauses short after signing: a signed transaction has a limited validity window. Do not print keys or the Authorization header.

## What to inspect

In browser DevTools → **Network**, select `/api/budget`:

- **Payload**: `state`, `policy`, `requestId`.
- **Response**: `quote.totalCents`, `payment.feeMicros`, `payment.receipt`, `trace`.
- **Status**: 200 success; 401 missing demo code; 403 blocked by policy; 409 reused or pending ID; 410 expired quote; 502 supplier/payment uncertainty; 503 missing test account.

The internal supplier call happens in Node, so its 402 will not appear as a separate browser request. Look in the server terminal for `[budget requestId]`, or inspect it directly:

```sh
curl -i http://localhost:5173/api/supplier/quote
```

The expected response is 402 with `WWW-Authenticate: Payment`. No prices are released yet.

## Three useful experiments

1. **Happy path**: Generate quote, open Payment flow & receipt, then view the Testnet transaction. The initial estimate is €55.20 and the quote fee is 0.01 test pathUSD.
2. **Blocked path**: Pause Autopilot, then generate a quote. The backend returns 403 before signing anything.
3. **Retry**: Repeat a successful request. `cached` is true and the receipt is unchanged; no second payment occurs.

`npm test` runs without network access. `npm run demo:testnet` exercises the complete Testnet flow and checks the transaction on-chain. New network demos count against the shared daily test budget.

## Explain it to evaluators

“The browser identifies the business need. The backend enforces the spending policy. The supplier sells a quote through HTTP 402. MPP carries the payment terms, credential and receipt, while Tempo Testnet confirms the transfer. The result is a restocking estimate; buying inventory is a separate future decision.”

The inventory and supplier prices are simulated. The verified Testnet transfer is real activity on a test network, using tokens with no real monetary value. The agent is deterministic; this MVP does not require a language model.
