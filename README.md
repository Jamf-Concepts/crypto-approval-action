<p align="center">
  <img src="assets/banner.svg" alt="Crypto-Signed Approvals - Hardware wallet signatures for GitHub PR approvals" width="800">
</p>

<p align="center">
  <a href="https://github.com/danjamf/crypto-approval-action/actions/workflows/ci.yml"><img src="https://github.com/danjamf/crypto-approval-action/actions/workflows/ci.yml/badge.svg" alt="Build and Test"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
</p>

A GitHub Action that requires cryptographic signatures from hardware wallets to approve pull requests. Adds a second factor to PR approvals that can't be compromised by a stolen GitHub session or token.

## Why?

GitHub's PR approval model is entirely account-based. If someone compromises a GitHub account (session hijack, stolen token, compromised SSO), they can approve PRs. This action adds a requirement that approvers sign a message with an **offline hardware signing device** (Ledger, Trezor, or any Ethereum-compatible wallet).

**Optional blockchain canary:** The action can validate that the signing key's associated wallet holds a minimum balance. If the balance is drained, it signals compromise and approvals automatically stop working - with zero manual intervention.

## What this is NOT

This project uses cryptographic signatures and optionally queries blockchain balances, but:

- **Not an ICO** - There is no token, no investment opportunity, nothing to buy
- **Not an NFT** - No digital collectibles, no ownership certificates
- **Not blockchain-based git history** - Your commits are not recorded on any blockchain
- **Not Web3** - No smart contracts, no DeFi, no decentralized anything

This is simply using well-established elliptic curve cryptography (the same math that secures Bitcoin/Ethereum) as a second factor for PR approvals. The optional blockchain canary is just a method to detect key compromise - it reads a balance, nothing more.

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

### 1. Create a KEYOWNERS file

Create `.github/KEYOWNERS` with your authorized signer addresses:

```
# Authorized signers for crypto-approval
0xYourAddress1  # Alice - Security Lead
0xYourAddress2  # Bob - Platform Team
```

### 2. Add the workflow

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
          github-token: ${{ secrets.GITHUB_TOKEN }}
          # Reads from .github/KEYOWNERS by default
          # Or use: allowed-keys: '0xAddr1,0xAddr2'
```

### 2. Sign a PR approval

Use the hosted signing tool:

**https://danjamf.github.io/crypto-approval-action/**

Or run locally:
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
| `allowed-keys` | No | | Comma-separated Ethereum addresses authorized to approve |
| `keyowners-file` | No | `.github/KEYOWNERS` | Path to KEYOWNERS file listing authorized addresses |
| `min-approvals` | No | `1` | Minimum unique signers required (M-of-N multi-sig) |
| `github-token` | Yes | | GitHub token for API access |
| `require-canary` | No | `false` | Enable blockchain balance check |
| `canary-chain` | No | `ethereum` | Chain to check (`ethereum`, `base`, `polygon`) |
| `canary-min-balance` | No | `10000000000000000` | Minimum balance in wei (0.01 ETH) |
| `signature-max-age` | No | `3600` | Maximum signature age in seconds |

## Outputs

| Output | Description |
|--------|-------------|
| `valid` | Whether enough valid crypto approvals were found |
| `signer` | Comma-separated addresses of valid signers |
| `approval-count` | Number of unique valid approvals |
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
  "timestamp": 1710000000
}
```

```signature
<65-byte ECDSA signature in hex>
```
````

The signature covers a serialized message:
```
CRYPTO_APPROVAL:v1:{repo}:{prNumber}:{headSha}:{timestamp}
```

## Security Model

| Threat | Mitigation |
|--------|------------|
| Compromised GitHub account | Attacker can't approve - doesn't have hardware wallet |
| Stolen signing device | Detected via wallet balance drain (canary) |
| Replayed signature | Head SHA binding invalidates after new commits |
| Stale approval | Timestamp expiry (configurable) |
| Insider with admin access | Can't bypass without valid signature |

## Configuring Allowed Keys

You have three options for configuring authorized signers:

### Option 1: KEYOWNERS file (recommended)

Create `.github/KEYOWNERS`:

```
# Authorized signers for crypto-approval
# One address per line, comments start with #

0xAlice123...  # Alice - Security Lead
0xBob456...    # Bob - Platform Team
0xCharlie789...  # Charlie - CTO
```

```yaml
- uses: danjamf/crypto-approval-action@main
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    # keyowners-file defaults to .github/KEYOWNERS
```

**Benefits:**
- Changes tracked in git history with full context
- Document who owns each key with inline comments
- Follows familiar CODEOWNERS pattern
- Transparent and auditable

### Option 2: Hardcoded in workflow

```yaml
- uses: danjamf/crypto-approval-action@main
  with:
    allowed-keys: '0xAlice,0xBob,0xCharlie'
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

**Benefits:**
- Simple for small teams
- Visible in workflow file

**Trade-off:** No inline comments, clutters workflow for many keys

### Option 3: GitHub Secrets

```yaml
- uses: danjamf/crypto-approval-action@main
  with:
    allowed-keys: ${{ secrets.ALLOWED_SIGNER_KEYS }}
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

**When to use:**
- Organization policy requires secrets for sensitive values
- You don't want signer addresses publicly visible

**Trade-off:** Loses transparency - no one can independently verify which addresses are authorized or check their canary balances

### Precedence

If multiple sources are configured:
1. `allowed-keys` input takes priority (if provided)
2. Otherwise, reads from `keyowners-file` (defaults to `.github/KEYOWNERS`)

## Multi-Signature Approval (M-of-N)

Require multiple unique signers before a PR can be merged:

```yaml
allowed-keys: '0xAlice,0xBob,0xCharlie'
min-approvals: '2'  # Need 2 of 3 to approve
```

Features:
- Each signer can only count once (no duplicate approvals)
- Status shows progress: `1/2 approvals (need 1 more)`
- All signatures must be valid and unexpired

## Commit SHA Binding (Replay Protection)

Every signature is bound to the **exact commit SHA** of the PR at signing time. This provides critical security:

```
Signature message: CRYPTO_APPROVAL:v1:{repo}:{prNumber}:{headSha}:{timestamp}
                                                         ^^^^^^^^
                                                    Locked to this commit
```

**What happens when new commits are pushed:**

1. Alice signs approval for commit `abc123` → ✓ Valid (1/2)
2. Bob signs approval for commit `abc123` → ✓ Valid (2/2) - PR approved!
3. Someone pushes a new commit → PR head is now `def456`
4. Action re-runs automatically (`pull_request: synchronize`)
5. Both signatures now **invalid** - SHA mismatch
6. Status reverts to: `0/2 approvals (need 2 more)`

**Why this matters:**
- Prevents sneaking malicious code in after approval
- All signers must have reviewed the **exact code** being merged
- Similar to GitHub's "dismiss stale reviews on new commits" but cryptographically enforced
- No one can replay old approvals on new code

**If you push changes during the approval process, everyone must re-sign.**

## Blockchain Canary

The optional canary check queries the signer's wallet balance. If below threshold, the approval is rejected.

**Why this matters:**
- If an attacker steals your seed phrase, they'll likely drain the wallet
- The drained balance instantly revokes approval rights across all repos
- No manual key rotation needed - it's automatic
- You have financial incentive to protect your keys (skin in the game)

### Setup

1. **Get an RPC API key** from a provider like [Ankr](https://ankr.com), [Alchemy](https://alchemy.com), or [Infura](https://infura.io)

2. **Add a repository secret:**
   - Go to **Settings → Secrets and variables → Actions**
   - Create secret: `CANARY_RPC_URL`
   - Value: `https://rpc.ankr.com/eth/YOUR_API_KEY` (or your provider's URL)

3. **Enable in your workflow:**
```yaml
require-canary: 'true'
canary-rpc-url: ${{ secrets.CANARY_RPC_URL }}
canary-min-balance: '10000000000000000'  # 0.01 ETH in wei
canary-chain: 'ethereum'  # fallback only - see note below
```

### RPC URL Configuration

The `canary-rpc-url` input takes priority for all RPC calls. If set, it is used directly regardless of `canary-chain`.

The `canary-chain` input (`ethereum`, `base`, or `polygon`) is **only used as a fallback** when `canary-rpc-url` is not provided. It maps to a default public RPC endpoint:

| Chain | Fallback RPC URL |
|-------|------------------|
| `ethereum` | `https://rpc.ankr.com/eth` |
| `base` | `https://rpc.ankr.com/base` |
| `polygon` | `https://rpc.ankr.com/polygon` |

**Recommendation:** Always set `CANARY_RPC_URL` as a repository secret with an authenticated RPC endpoint (from [Ankr](https://ankr.com), [Alchemy](https://alchemy.com), or [Infura](https://infura.io)). Public RPCs without API keys are unreliable for production use.

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

## Where to get help

If you have questions, encounter bugs, or want to request a feature, please [open an issue](https://github.com/danjamf/crypto-approval-action/issues) on GitHub.

## Dependencies

This action uses the following open-source libraries:

| Package | License | Link |
|---------|---------|------|
| [@actions/core](https://github.com/actions/toolkit) | MIT | [LICENSE](https://github.com/actions/toolkit/blob/main/LICENSE.md) |
| [@actions/github](https://github.com/actions/toolkit) | MIT | [LICENSE](https://github.com/actions/toolkit/blob/main/LICENSE.md) |
| [@noble/curves](https://github.com/paulmillr/noble-curves) | MIT | [LICENSE](https://github.com/paulmillr/noble-curves/blob/main/LICENSE) |
| [@noble/hashes](https://github.com/paulmillr/noble-hashes) | MIT | [LICENSE](https://github.com/paulmillr/noble-hashes/blob/main/LICENSE) |
| [ethers](https://github.com/ethers-io/ethers.js) | MIT | [LICENSE](https://github.com/ethers-io/ethers.js/blob/main/LICENSE.md) |
| [viem](https://github.com/wevm/viem) | MIT | [LICENSE](https://github.com/wevm/viem/blob/main/LICENSE) |

## License

MIT
