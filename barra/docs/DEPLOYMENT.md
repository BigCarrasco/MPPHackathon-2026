# Public demo and hackathon submission

## What the submission page checks

The [hackathon form](https://mpp-hackathon.vercel.app/submit) asks for the **live service origin**, such as `https://your-demo.example`. It scans:

- `/openapi.json`, including `x-payment-info.offers[]`.
- `/llms.txt`.
- An unpaid request to a paid endpoint, which must return HTTP 402 with `WWW-Authenticate: Payment`.

This scan does not perform a complete paid round trip. Verify a Testnet payment separately. After a successful scan, the form lets you write the submission packet. Submitting opens a pull request on the hackathon's private repository.

## Hosting requirements

Use a host that runs a **Node.js 22 process or this repository's Dockerfile**. A static-only host can display the dashboard but cannot execute MPP verification or the payer backend.

Deploy one instance, attach persistent storage at `/app/barra/.data` for Docker (or `barra/.data` relative to the checkout), make it writable by the Node user (UID 1000), and expose the port provided by the host. The default is 5173. Configure:

| Setting | Value |
| --- | --- |
| Build | `npm ci --omit=dev`, or build `Dockerfile` |
| Start | `npm start` |
| Health check | `/api/health` |
| Host | `HOST=0.0.0.0` |
| Instances | One per persistent data directory |
| Protocol | Public HTTPS |

Set these as hosting secrets, not source files:

- `MPP_SECRET_KEY`: a random 32-byte hexadecimal secret.
- `MPP_RECIPIENT`: a disposable Tempo Testnet recipient.
- `TEMPO_TESTNET_PRIVATE_KEY`: a funded disposable Testnet payer key.
- `DEMO_ACCESS_CODE`: a random code of at least 12 characters, shared privately with evaluators.

`npm run setup:testnet` prepares disposable credentials locally and requests faucet funds. Transfer the values to the host's secret settings; never commit `.env` or paste it into the submission form. Keep real-money wallets out of this project.

Public binding is rejected without a demo access code. The dashboard asks evaluators for this code before using the server's test payer. The supplier endpoint and discovery files remain publicly accessible to the hackathon scanner and MPP buyers, who pay using their own Testnet account.

Server spending caps still apply. Evaluators share the demo payer's daily limit; inventory simulation stays in each browser. A reset of the browser demo does not erase server spending or payment replay records.

## Verify the public URL

1. Open the dashboard in another browser or device.
2. Check `/api/health` reports chain 42431 and `realPayments: false`.
3. Call `/api/supplier/quote` without credentials: expect 402.
4. Enter the private demo code in the dashboard, generate a quote, and verify its Testnet receipt.
5. Repeat the same request and confirm the saved result avoids another payment.
6. Paste the **origin** into the hackathon form and click **Scan service**. Review the packet before submitting.

## Current status

The repository contains the English UI, larger typography, MPP Testnet implementation, offline tests and container configuration. A local end-to-end Testnet payment has been verified and recorded in `testnet-evidence.json`.

**A public deployment has not yet been completed.** The existing Sites project is `appgprj_6af1fea11dc08191a871c6acd5f07ba7`. Its current configuration is static-only; deploying this Node backend there requires a supported Worker/storage adaptation. The attempt to access its source host was blocked by this session's network approval policy. The Docker configuration is prepared for a Node-capable host; the container has not been built or deployed in this session.
