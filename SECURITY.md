# Security Policy

crypto-approval-action adds a hardware-wallet signature requirement to GitHub
pull request approvals. Because it handles cryptographic verification logic and
interacts with GitHub tokens and PR comments, security reports are taken
seriously.

For Jamf Concepts' broader security posture, see
**[concepts.jamf.com/en/security](https://concepts.jamf.com/en/security/)**.

## Supported versions

Security fixes are applied to the latest released version. Please make sure you
can reproduce an issue on the most recent release before reporting it.

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Instead, report privately via Jamf's [Vulnerability Disclosure Program](https://www.jamf.com/trust-center/vulnerability-disclosure/),
or use the **Report a vulnerability** button under this repository's **Security** tab.

Please include:

- A description of the issue and its potential impact.
- Steps to reproduce, or a proof of concept.
- The action version (tag or SHA) and workflow context you observed it on.

You can expect an initial acknowledgement within a few business days. Once a
fix is available, the report will be disclosed publicly with credit to the
reporter, unless you ask to remain anonymous.

## Scope

In-scope examples: flaws in signature verification that could allow a spoofed
or replayed approval to pass, allowlist configuration parsing that could be
bypassed to permit an unauthorized signer, blockchain canary checks that could
be circumvented to suppress compromise detection, or any path where the action's
`GITHUB_TOKEN` usage exceeds its documented read/comment scope.

Out of scope: vulnerabilities in Ledger, Trezor, MetaMask, or other hardware
wallet firmware and software; vulnerabilities in the Ethereum/EVM ecosystem; or
issues in GitHub itself. Please report those to the relevant vendor.
