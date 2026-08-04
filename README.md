# Orange Belt Crowdfund

A Soroban smart contract crowdfunding campaign with a React/Next.js frontend, deployed on Stellar Testnet.

- **Live App:** https://risein-leve-3-m85obpmpr-jobby2.vercel.app
- **Smart Contract (Testnet):** `CDAZNHHPR7N72EXUOE2Y6GEVEPE2ZWV4G7NVHPKYWP63YTYHHRZZOKMV`
- **Explorer Link:** https://stellar.expert/explorer/testnet/contract/CDAZNHHPR7N72EXUOE2Y6GEVEPE2ZWV4G7NVHPKYWP63YTYHHRZZOKMV
- **Stack:** Soroban (Rust), Next.js, Tailwind CSS, `@creit.tech/stellar-wallets-kit`
- **Wallets Supported:** Freighter, xBull, Albedo

## Features

- Connect wallet (Freighter / xBull / Albedo)
- View campaign progress bar and live countdown timer
- Contribute XLM to the campaign
- Claim raised funds when the target is met
- Post-campaign status banners (completed / failed / claimable)
- Step-by-step transaction status feedback
- 3-tier error handling (WalletNotFound, UserRejected, InsufficientFunds)
- localStorage caching with 5-minute TTL

## Redeploying the upgraded contract

**⚠️ Required before the app will work.** The on-chain testnet contract still runs the
original code (no real transfers). The `crowdfund-client` bindings in this repo were
regenerated for the **upgraded** contract (typed errors + real XLM transfers via the
Stellar Asset Contract), so the contract must be redeployed and re-initialized.

### One-command deploy

```bash
cd soroban-crowdfund

# 1. Scaffold the local config (creates .env from .env.example)
make init

# 2. Fill in your deploy details in .env:
#    STELLAR_SOURCE = your funded testnet account (secret key or `stellar keys add` alias)
#    BENEFICIARY    = the address that receives the raised funds on claim

# 3. Deploy everything — builds the wasm, deploys a fresh contract, initializes
#    the campaign, regenerates the TS client, and points it at the new contract
make deploy
```

`make deploy` handles: build → `stellar contract deploy` → `stellar contract invoke initialize`
→ `stellar contract bindings typescript` → wiring `networks.testnet.contractId` in the client.

### What it runs (for reference)

```bash
cargo build --release --target wasm32-unknown-unknown

stellar contract deploy --wasm target/wasm32-unknown-unknown/release/crowdfund.wasm \
  --source-account <YOUR_ACCOUNT> --network testnet

stellar contract invoke --id <NEW_CONTRACT_ID> --source-account <YOUR_ACCOUNT> \
  --network testnet -- initialize \
  --target <TARGET_IN_STROOPS> --deadline <UNIX_SECONDS> \
  --beneficiary <G...BENEFICIARY> \
  --token CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC

stellar contract bindings typescript --output-dir ../src/contracts/crowdfund-client \
  --overwrite --contract-id <NEW_CONTRACT_ID> --network testnet
```

`token` is the native XLM SAC on testnet; amounts are in stroops (1 XLM = 10,000,000 stroops).
Defaults: `TARGET_STROOPS` = 10,000 XLM, `DEADLINE_UNIX` = now + 30 days.

## Testing

**Soroban contract** (12 tests — transfers, balances, beneficiary payout, typed errors):

```bash
cd soroban-crowdfund
make test        # cargo test --workspace
make lint        # cargo fmt --check + clippy -D warnings
```

**Frontend** (19 tests — Vitest + React Testing Library):

```bash
npm test         # vitest run
npm run test:watch
```

Coverage: `ProgressBar` (percentage math, 100% cap, zero-target), `CountdownTimer`
(per-second updates, ended state), `TransactionAlert` (success link, failure error,
dismiss), `ContributeForm` (connect-first flow, amount validation, pending state),
and `CrowdfundContext` (campaign load + live event stream wiring, XLM→stroops
conversion, typed contract errors surfaced **before** signing, wallet-rejection
mapping, claim error path) — with `Client`, `rpc.Server`, and the wallet kit mocked.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).
