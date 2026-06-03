# Orange Belt Crowdfund

A Soroban smart contract crowdfunding campaign with a React/Next.js frontend, deployed on Stellar Testnet.

- **Smart Contract (Testnet):** `CCLJ4FEXKXEZKS6UCROBEKLIVDOPFVP6Z75QS3AV5CUS2WAM3EBQNL7W`
- **Live Demo Link:** https://stellar-orange-belt-crowdfund-inyxwywvi.vercel.app/
- **Stack:** Soroban (Rust), Next.js, Tailwind CSS, `@creit.tech/stellar-wallets-kit`
- **Wallets Supported:** Freighter, xBull, Albedo

## Features

- Connect wallet (Freighter / xBull / Albedo)
- View campaign progress bar and live countdown timer
- Contribute XLM to the campaign
- Step-by-step transaction status feedback
- 3-tier error handling (WalletNotFound, UserRejected, InsufficientFunds)
- localStorage caching with 5-minute TTL

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).
