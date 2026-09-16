# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest release (`main`) | ✅ |
| Older pinned versions | ⚠️ Best-effort |

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Report security issues privately via [GitHub's private vulnerability reporting](https://github.com/Jamf-Concepts/crypto-approval-action/security/advisories/new).

Include:
- A description of the vulnerability and its potential impact
- Steps to reproduce or a proof-of-concept (if safe to share)
- The version(s) affected

You'll receive an acknowledgment within **5 business days**. If confirmed, we'll work on a fix and coordinate disclosure timing with you.

## Scope

This action enforces hardware-wallet-signed approvals for pull requests. Security-relevant areas include:

- **Signature verification logic** (`src/`) — incorrect verification could allow spoofed approvals
- **Allowlist/configuration parsing** — misconfiguration could bypass the hardware-wallet requirement
- **Blockchain canary check** — a bypass here would prevent compromise detection from triggering
- **GitHub token usage** — the action reads PR comments and posts status; any escalation beyond that scope is in scope

Out of scope: vulnerabilities in third-party dependencies that have their own disclosure process, or issues requiring write access to the target repository's workflow files.

## Security Model

The core threat model is: a GitHub account is compromised (stolen token, hijacked session). This action defends against that by requiring a signature from an offline hardware device the attacker does not possess.

It does **not** protect against:
- An attacker who also has physical access to the hardware wallet
- A compromised CI runner with write access to the repository
- Workflow file changes made directly (the action must be pinned and protected by branch rules)
