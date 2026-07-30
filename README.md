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

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).
