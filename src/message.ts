import { createHash, randomBytes } from 'crypto'
import type { ApprovalMessage, SignedApproval } from './types.js'

const MESSAGE_VERSION = 'v1'
const MESSAGE_PREFIX = 'CRYPTO_APPROVAL'

export function createApprovalMessage(
  repo: string,
  prNumber: number,
  headSha: string
): ApprovalMessage {
  return {
    repo,
    prNumber,
    headSha,
    timestamp: Math.floor(Date.now() / 1000),
    nonce: randomBytes(16).toString('hex'),
  }
}

export function serializeMessage(message: ApprovalMessage): string {
  const parts = [
    MESSAGE_PREFIX,
    MESSAGE_VERSION,
    message.repo,
    message.prNumber.toString(),
    message.headSha,
    message.timestamp.toString(),
    message.nonce,
  ]
  return parts.join(':')
}

export function hashMessage(message: ApprovalMessage): Buffer {
  const serialized = serializeMessage(message)
  return createHash('sha256').update(serialized).digest()
}

export function parseSignedApproval(commentBody: string): SignedApproval | null {
  const regex =
    /```crypto-approval\n([\s\S]*?)\n```[\s\S]*?```signature\n([a-fA-F0-9]+)\n```/

  const match = commentBody.match(regex)
  if (!match) return null

  try {
    const messageJson = match[1].trim()
    const signature = match[2].trim()

    const parsed = JSON.parse(messageJson)

    if (
      typeof parsed.repo !== 'string' ||
      typeof parsed.prNumber !== 'number' ||
      typeof parsed.headSha !== 'string' ||
      typeof parsed.timestamp !== 'number' ||
      typeof parsed.nonce !== 'string'
    ) {
      return null
    }

    return {
      message: parsed as ApprovalMessage,
      signature,
    }
  } catch {
    return null
  }
}

export function formatApprovalComment(
  message: ApprovalMessage,
  signature: string
): string {
  const messageJson = JSON.stringify(message, null, 2)

  return `## Crypto-Signed Approval

This PR has been cryptographically approved with a hardware wallet signature.

\`\`\`crypto-approval
${messageJson}
\`\`\`

\`\`\`signature
${signature}
\`\`\`

---
*Verified by [crypto-approval-action](https://github.com/danjamf/crypto-approval-action)*`
}

export function isMessageExpired(
  message: ApprovalMessage,
  maxAgeSeconds: number
): boolean {
  const now = Math.floor(Date.now() / 1000)
  return now - message.timestamp > maxAgeSeconds
}

export function doesMessageMatchPR(
  message: ApprovalMessage,
  repo: string,
  prNumber: number,
  headSha: string
): boolean {
  return (
    message.repo === repo && message.prNumber === prNumber && message.headSha === headSha
  )
}
