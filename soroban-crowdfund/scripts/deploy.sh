#!/usr/bin/env bash
#
# One-command deployment of the crowdfund contract.
#
# Flow: build the wasm -> deploy a fresh contract -> initialize the campaign
#       -> regenerate the TypeScript client -> point it at the new contract.
#
# Configuration comes from the environment or a local `.env` file
# (copy `.env.example` to `.env`; run `make init` to scaffold it).
#
# Required:
#   STELLAR_SOURCE   your funded testnet account (secret key S... or `stellar keys add` alias)
#   BENEFICIARY      address that receives the raised funds on claim (G...)
#
# Optional:
#   STELLAR_NETWORK  testnet | futurenet | mainnet          (default: testnet)
#   TARGET_STROOPS   funding target in stroops (1 XLM = 10M) (default: 10,000 XLM)
#   DEADLINE_UNIX    campaign deadline as unix seconds       (default: now + 30 days)
#   TOKEN_SAC        token contract the campaign accepts     (default: native XLM SAC on testnet)
set -euo pipefail

# --- Locate the project root (this script lives in <root>/scripts) ---------
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# --- Load .env if present --------------------------------------------------
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

NETWORK="${STELLAR_NETWORK:-testnet}"
SOURCE="${STELLAR_SOURCE:-}"
TARGET="${TARGET_STROOPS:-100000000000000}" # 10,000 XLM in stroops
DEADLINE="${DEADLINE_UNIX:-}"
BENEFICIARY="${BENEFICIARY:-}"
TOKEN="${TOKEN_SAC:-CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC}"
CLIENT_DIR="${CLIENT_DIR:-../src/contracts/crowdfund-client}"
WASM_PATH="${WASM_PATH:-target/wasm32-unknown-unknown/release/crowdfund.wasm}"

# --- Preflight -------------------------------------------------------------
fail() { echo "ERROR: $*" >&2; exit 1; }

for tool in stellar make cargo rustup; do
  command -v "$tool" >/dev/null 2>&1 || fail \
    "required tool '$tool' is not installed or not on your PATH."
done
[[ -n "$SOURCE" ]] || fail \
  "STELLAR_SOURCE is required (your funded testnet account). Set it in .env — see .env.example."
[[ -n "$BENEFICIARY" ]] || fail \
  "BENEFICIARY is required (the address that receives raised funds on claim). See .env.example."
[[ "$NETWORK" == "mainnet" ]] && fail \
  "Refusing to deploy to mainnet from this workflow — it is configured for test/futurenet only."

if [[ -z "$DEADLINE" ]]; then
  DEADLINE=$(( $(date +%s) + 30 * 24 * 60 * 60 )) # now + 30 days
fi

echo "==> Deploying to network: $NETWORK"
echo "    target:     $TARGET stroops ($((TARGET / 10000000)) XLM)"
echo "    deadline:   $(date -u -d @"$DEADLINE" '+%Y-%m-%d %H:%M:%S UTC' 2>/dev/null || echo "$DEADLINE")"
echo "    beneficiary: $BENEFICIARY"
echo "    token:      $TOKEN"

# --- Build -----------------------------------------------------------------
echo "==> Building contract wasm"
make build

# --- Deploy ----------------------------------------------------------------
echo "==> Deploying contract"
DEPLOY_OUTPUT="$(stellar contract deploy \
  --wasm "$WASM_PATH" \
  --source-account "$SOURCE" \
  --network "$NETWORK")"

if ! CONTRACT_ID="$(printf '%s\n' "$DEPLOY_OUTPUT" | grep -oE 'C[0-9A-Z]{55}' | head -1)"; then
  fail "could not parse the new contract id from:\n$DEPLOY_OUTPUT"
fi
echo "    new contract id: $CONTRACT_ID"

# --- Initialize ------------------------------------------------------------
echo "==> Initializing campaign"
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --source-account "$SOURCE" \
  --network "$NETWORK" -- \
  initialize \
  --target "$TARGET" \
  --deadline "$DEADLINE" \
  --beneficiary "$BENEFICIARY" \
  --token "$TOKEN"

# --- Bindings --------------------------------------------------------------
echo "==> Regenerating TypeScript client for the new contract"
stellar contract bindings typescript \
  --output-dir "$CLIENT_DIR" --overwrite \
  --contract-id "$CONTRACT_ID" --network "$NETWORK"

# The generator does not emit the `networks` const or the top-level re-export
# that this repo's app imports (`@/contracts/crowdfund-client`) — restore both.
echo "==> Wiring the new contract id into the client"
{
  echo ""
  echo "export const networks = {"
  echo "  testnet: {"
  echo "    networkPassphrase: \"Test SDF Network ; September 2015\","
  echo "    contractId: \"$CONTRACT_ID\","
  echo "  },"
  echo "} as const"
} >> "$CLIENT_DIR/src/index.ts"
printf 'export * from "./src/index";\n' > "$CLIENT_DIR/index.ts"

echo ""
echo "✅ Done — contract deployed and client updated."
echo "   Contract ID: $CONTRACT_ID"
echo "   Explorer:    https://stellar.expert/explorer/testnet/contract/$CONTRACT_ID"
echo ""
echo "Next: cd .. && npm run typecheck && npm run build to ship the frontend."
