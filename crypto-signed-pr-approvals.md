# Crypto-Signed PR Approvals with Blockchain Canary

**Date:** March 14, 2026
**Author:** Dan Cuddeford
**Status:** Concept / Pre-build

---

## The Problem

GitHub's PR approval model is entirely account-based — you click "Approve" while authenticated. If someone compromises a GitHub account (session hijack, stolen token, compromised SSO), they can approve PRs. Branch protection rules enforce that approved reviews exist before merge, but there's no mechanism to require a detached cryptographic proof alongside that approval.

## The Idea

Require PR approvers to sign a message with an **offline hardware signing device** (Ledger, Trezor, YubiKey) before a PR can be merged. A GitHub Action validates the signed message, ensuring it's impossible for someone without the physical device to approve a PR.

**Optional blockchain extension:** Validate that the signing key's associated wallet holds a minimum balance on a public blockchain. If the balance is missing, it signals that the key or person was compromised. This also acts as a financial incentive for the user to safeguard the signing device.

## Prior Art Research

No existing GitHub Action does this. Adjacent tooling exists but covers different use cases:

- **GitHub native commit signing** — GPG, SSH, S/MIME signatures on commits (not PR approvals)
- **Sigstore / Gitsign** — Keyless signing using OIDC identity for commits and container images
- **HashiCorp Vault Transit** — Detached signing in CI where private keys never leave Vault
- **YubiKey SSH (FIDO2)** — Hardware-backed SSH keys requiring physical touch for Git operations
- **Cosign** — Container image signing (not PR approval gating)

All focus on **commit signing** or **artifact signing** — none gate **PR approval** on a cryptographic signature from a hardware device.

---

## Architecture

### Phase 1 — Approver signs offline

1. Approver runs a CLI tool (or browser extension)
2. Tool constructs a deterministic message from PR metadata:
   - Repository owner/name
   - PR number
   - Head commit SHA
   - Timestamp
   - Nonce (replay prevention)
3. Message is sent to the hardware wallet for ECDSA/EdDSA signing
4. Signed message is posted as a PR comment or via the GitHub API

### Phase 2 — GitHub Action validates

1. Action triggers on `issue_comment` or `pull_request_review`
2. Extracts the signature from the comment/review
3. Verifies the cryptographic signature (ECDSA/EdDSA) against a repo-level allowlist of public keys
4. Validates the message payload matches the current PR state:
   - PR number matches
   - Head SHA matches current PR head (prevents replay after new commits)
   - Timestamp is within acceptable window

### Phase 3 — Blockchain canary check (optional)

1. Action queries a public blockchain RPC endpoint
2. Checks the wallet balance associated with the signing key
3. Compares against a configurable minimum threshold
4. If balance is below threshold → approval rejected
5. If balance meets threshold → proceed to set status

### Phase 4 — Branch protection enforces

- GitHub branch protection rule requires the `crypto-approval` status check to pass before merge
- Standard GitHub merge flow — no custom merge tooling needed

---

## The Blockchain Canary Mechanism

This is the key innovation. The on-chain balance serves three simultaneous purposes:

### 1. Compromise detection

If an attacker steals the seed phrase and drains the wallet, approvals from that key automatically stop working across **every repo** that uses it — with zero manual intervention. No revocation list to update, no admin to notify.

### 2. Incentive alignment

The approver has their own money at stake. They're not just following a security policy because their employer said so — they have a direct financial reason to:

- Keep the hardware device in a safe location
- Store the seed phrase securely
- Never expose the private key
- Report suspected compromise immediately

It's skin in the game.

### 3. Instant revocation

If you suspect compromise, drain the wallet. Done. Every repo sees it immediately on the next approval attempt. Compare that to:

- Rotating GPG keys across an organization
- Revoking SSH keys from every repo
- Updating PKI certificate revocation lists
- Waiting for admin action in a centralized key management system

The blockchain balance check is:

- **Chain-agnostic** — works with Ethereum, Solana, Base, or any EVM-compatible chain
- **Configurable** — threshold can be as low as $10–50 in native token
- **Public** — anyone can verify the canary status at any time
- **Decentralized** — no centralized infrastructure required

---

## Threat Model

| Threat | Mitigation |
|--------|-----------|
| Compromised GitHub account | Cannot approve PRs — attacker doesn't have the physical signing device |
| Stolen signing device | Detected via wallet balance drain (canary signal) |
| Replayed approval signature | Head SHA binding invalidates old signatures after new commits |
| Stale approval | Timestamp window + head SHA binding |
| Insider with GitHub admin access | Cannot bypass branch protection status check without valid signature |
| Social engineering | Hardware device requires physical interaction — cannot be phished remotely |

---

## Potential Extensions

### M-of-N multi-signature approval

Require multiple wallets to sign before a PR can merge. This gives you quorum-based approval without any centralized infrastructure — similar to a Gnosis Safe-style multisig but for code review.

### Audit trail on-chain

Optionally record approval attestations on-chain for an immutable, timestamped audit trail. Useful for compliance-heavy environments.

### Organization-wide key registry

A shared configuration file or smart contract that maps GitHub usernames to wallet addresses, making key management visible and auditable.

---

## Open Design Decisions

| Decision | Options | Notes |
|----------|---------|-------|
| Message format | JSON / EIP-712 typed data / plain text | EIP-712 gives nice UX on Ledger/MetaMask |
| Nonce strategy | Timestamp-based / sequential / random | Timestamp + SHA binding may be sufficient |
| Chain selection | Ethereum mainnet / Base / Solana / configurable | Base or Solana for low fees if on-chain recording is desired |
| Signing UX | CLI tool / browser extension / both | CLI for developers, extension for less technical approvers |
| RPC URL management | Repo secret / action input / hardcoded public RPC | Repo secret is most flexible |
| Threshold denomination | Native token amount / USD equivalent | USD equivalent requires a price oracle — adds complexity |
| Signature delivery | PR comment / commit status API / both | PR comment is most visible and auditable |

---

## Next Steps

- [ ] Scaffold the GitHub Action (YAML + TypeScript)
- [ ] Implement signature verification logic (ethers.js or noble-curves)
- [ ] Implement on-chain balance check via public RPC
- [ ] Build CLI tool for local message signing
- [ ] Test with a hardware wallet (Ledger Nano)
- [ ] Write documentation and publish to GitHub Marketplace
- [ ] Consider open-sourcing as a standalone project

---

*This concept was developed in a conversation with Claude on March 14, 2026. Stored in second brain as memory #14.*
