# Crypto-Signed PR Approvals

A GitHub Action that requires cryptographic signatures from hardware wallets to approve pull requests. Adds a second factor to PR approvals that can't be compromised by a stolen GitHub session or token.

## Why?

GitHub's PR approval model is entirely account-based. If someone compromises a GitHub account (session hijack, stolen token, compromised SSO), they can approve PRs. This action adds a requirement that approvers sign a message with an **offline hardware signing device** (Ledger, Trezor, or any Ethereum-compatible wallet).

**Optional blockchain canary:** The action can validate that the signing key's associated wallet holds a minimum balance. If the balance is drained, it signals compromise and approvals automatically stop working - with zero manual intervention.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PR Approval Flow                                │
└─────────────────────────────────────────────────────────────────────────────┘

  ┌──────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────────┐
  │ Approver │     │   MetaMask   │     │   GitHub    │     │    Action    │
  │          │     │   / Ledger   │     │     PR      │     │              │
  └────┬─────┘     └──────┬───────┘     └──────┬──────┘     └──────┬───────┘
       │                  │                    │                   │
       │  1. Review PR    │                    │                   │
       │─────────────────────────────────────► │                   │
       │                  │                    │                   │
       │  2. Open signing tool                 │                   │
       │────────────────► │                    │                   │
       │                  │                    │                   │
       │  3. Sign message │                    │                   │
       │  (repo, PR#,     │                    │                   │
       │   SHA, timestamp)│                    │                   │
       │◄────────────────►│                    │                   │
       │                  │                    │                   │
       │  4. Post signed comment               │                   │
       │─────────────────────────────────────► │                   │
       │                  │                    │                   │
       │                  │                    │  5. Trigger       │
       │                  │                    │─────────────────► │
       │                  │                    │                   │
       │                  │                    │  6. Parse comment │
       │                  │                    │  7. Verify sig    │
       │                  │                    │  8. Check canary  │
       │                  │                    │     (optional)    │
       │                  │                    │                   │
       │                  │                    │  9. Set commit    │
       │                  │                    │◄──────────────────│
       │                  │                    │     status        │
       │                  │                    │                   │
  ┌────▼─────┐     ┌──────▼───────┐     ┌──────▼──────┐     ┌──────▼───────┐
  │ Approver │     │   MetaMask   │     │   GitHub    │     │    Action    │
  │          │     │   / Ledger   │     │     PR      │     │              │
  └──────────┘     └──────────────┘     └─────────────┘     └──────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                         Blockchain Canary (Optional)                         │
└─────────────────────────────────────────────────────────────────────────────┘

  Normal state:                      Compromise detected:

  ┌─────────────┐                    ┌─────────────┐
  │   Wallet    │                    │   Wallet    │
  │  Balance:   │                    │  Balance:   │
  │  0.05 ETH   │  ✓ Approved        │  0.00 ETH   │  ✗ Rejected
  │  ─────────  │                    │  ─────────  │
  │  Threshold: │                    │  Threshold: │
  │  0.01 ETH   │                    │  0.01 ETH   │
  └─────────────┘                    └─────────────┘

  If attacker steals seed phrase and drains wallet,
  all repos using this key automatically reject approvals.
```

## Quick Start

### 1. Add the workflow

Create `.github/workflows/crypto-approval.yml`:

```yaml
name: Crypto Approval

on:
  pull_request:
    types: [opened, synchronize, reopened]
  issue_comment:
    types: [created]

permissions:
  contents: read
  pull-requests: read
  issues: read
  statuses: write

jobs:
  verify-approval:
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request' || (github.event_name == 'issue_comment' && github.event.issue.pull_request)

    steps:
      - uses: actions/checkout@v4

      - uses: danjamf/crypto-approval-action@main
        with:
          # Allowed signer addresses - hardcoded for transparency
          # Anyone can verify which wallets are authorized
          allowed-keys: '0xYourAddress1,0xYourAddress2'
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

### 2. Sign a PR approval

Open the signing tool locally:

```bash
git clone https://github.com/danjamf/crypto-approval-action
cd crypto-approval-action
python3 -m http.server 8080
# Open http://localhost:8080/tools/sign-with-metamask.html
```

Enter your PR details, sign with MetaMask, and paste the comment on the PR.

### 3. Enable branch protection (optional)

In your repo settings, add `crypto-approval` as a required status check.

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `allowed-keys` | Yes | | Comma-separated Ethereum addresses authorized to approve |
| `github-token` | Yes | | GitHub token for API access |
| `require-canary` | No | `false` | Enable blockchain balance check |
| `canary-chain` | No | `ethereum` | Chain to check (`ethereum`, `base`, `polygon`) |
| `canary-min-balance` | No | `10000000000000000` | Minimum balance in wei (0.01 ETH) |
| `signature-max-age` | No | `3600` | Maximum signature age in seconds |

## Outputs

| Output | Description |
|--------|-------------|
| `valid` | Whether a valid crypto approval was found |
| `signer` | The address that signed the approval |
| `canary-balance` | The signer's wallet balance (if canary enabled) |

## Approval Comment Format

The signing tool generates a comment like this:

````markdown
## Crypto-Signed Approval

```crypto-approval
{
  "repo": "owner/repo",
  "prNumber": 123,
  "headSha": "abc123...",
  "timestamp": 1710000000,
  "nonce": "random-hex-string"
}
```

```signature
<65-byte ECDSA signature in hex>
```
````

The signature covers a serialized message:
```
CRYPTO_APPROVAL:v1:{repo}:{prNumber}:{headSha}:{timestamp}:{nonce}
```

## Security Model

| Threat | Mitigation |
|--------|------------|
| Compromised GitHub account | Attacker can't approve - doesn't have hardware wallet |
| Stolen signing device | Detected via wallet balance drain (canary) |
| Replayed signature | Head SHA binding invalidates after new commits |
| Stale approval | Timestamp expiry (configurable) |
| Insider with admin access | Can't bypass without valid signature |

## Why Hardcode Allowed Keys?

The `allowed-keys` should be committed to your repo, not stored in secrets. This provides:

- **Transparency**: Anyone can verify which addresses are authorized
- **Auditability**: Changes to the allowlist are tracked in git history
- **Verification**: Aligns with the trustless ethos of crypto signing

## Blockchain Canary

The optional canary check queries the signer's wallet balance. If below threshold, the approval is rejected.

**Why this matters:**
- If an attacker steals your seed phrase, they'll likely drain the wallet
- The drained balance instantly revokes approval rights across all repos
- No manual key rotation needed - it's automatic
- You have financial incentive to protect your keys (skin in the game)

Enable with:
```yaml
require-canary: 'true'
canary-chain: 'base'  # Low fees
canary-min-balance: '10000000000000000'  # 0.01 ETH
```

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build
npm run bundle

# Run all checks
npm run all
```

## License

MIT
