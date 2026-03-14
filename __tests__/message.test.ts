import {
  createApprovalMessage,
  serializeMessage,
  hashMessage,
  parseSignedApproval,
  formatApprovalComment,
  isMessageExpired,
  doesMessageMatchPR,
} from '../src/message'
import type { ApprovalMessage } from '../src/types'

describe('message', () => {
  const mockMessage: ApprovalMessage = {
    repo: 'owner/repo',
    prNumber: 123,
    headSha: 'abc123def456',
    timestamp: 1710422400, // Fixed timestamp for testing
    nonce: 'deadbeef12345678deadbeef12345678',
  }

  describe('createApprovalMessage', () => {
    it('creates a message with correct fields', () => {
      const message = createApprovalMessage('owner/repo', 123, 'abc123')

      expect(message.repo).toBe('owner/repo')
      expect(message.prNumber).toBe(123)
      expect(message.headSha).toBe('abc123')
      expect(message.timestamp).toBeDefined()
      expect(message.nonce).toHaveLength(32) // 16 bytes = 32 hex chars
    })

    it('generates unique nonces', () => {
      const msg1 = createApprovalMessage('owner/repo', 1, 'sha1')
      const msg2 = createApprovalMessage('owner/repo', 1, 'sha1')

      expect(msg1.nonce).not.toBe(msg2.nonce)
    })
  })

  describe('serializeMessage', () => {
    it('serializes message to deterministic string', () => {
      const serialized = serializeMessage(mockMessage)

      expect(serialized).toBe(
        'CRYPTO_APPROVAL:v1:owner/repo:123:abc123def456:1710422400:deadbeef12345678deadbeef12345678'
      )
    })
  })

  describe('hashMessage', () => {
    it('produces consistent hash for same message', () => {
      const hash1 = hashMessage(mockMessage)
      const hash2 = hashMessage(mockMessage)

      expect(hash1.toString('hex')).toBe(hash2.toString('hex'))
    })

    it('produces different hash for different messages', () => {
      const modifiedMessage = { ...mockMessage, prNumber: 456 }
      const hash1 = hashMessage(mockMessage)
      const hash2 = hashMessage(modifiedMessage)

      expect(hash1.toString('hex')).not.toBe(hash2.toString('hex'))
    })
  })

  describe('parseSignedApproval', () => {
    it('parses valid approval comment', () => {
      const comment = formatApprovalComment(mockMessage, 'a'.repeat(130))
      const parsed = parseSignedApproval(comment)

      expect(parsed).not.toBeNull()
      expect(parsed?.message.repo).toBe('owner/repo')
      expect(parsed?.message.prNumber).toBe(123)
      expect(parsed?.signature).toBe('a'.repeat(130))
    })

    it('returns null for invalid comment', () => {
      expect(parseSignedApproval('just a normal comment')).toBeNull()
      expect(parseSignedApproval('```crypto-approval\ninvalid json\n```')).toBeNull()
    })

    it('returns null for malformed message fields', () => {
      const badComment = `\`\`\`crypto-approval
{"repo": 123, "prNumber": "bad"}
\`\`\`
\`\`\`signature
${'a'.repeat(130)}
\`\`\``

      expect(parseSignedApproval(badComment)).toBeNull()
    })
  })

  describe('isMessageExpired', () => {
    it('returns false for recent message', () => {
      const recentMessage = {
        ...mockMessage,
        timestamp: Math.floor(Date.now() / 1000) - 60, // 1 minute ago
      }

      expect(isMessageExpired(recentMessage, 3600)).toBe(false)
    })

    it('returns true for old message', () => {
      const oldMessage = {
        ...mockMessage,
        timestamp: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
      }

      expect(isMessageExpired(oldMessage, 3600)).toBe(true)
    })
  })

  describe('doesMessageMatchPR', () => {
    it('returns true for matching PR', () => {
      expect(doesMessageMatchPR(mockMessage, 'owner/repo', 123, 'abc123def456')).toBe(
        true
      )
    })

    it('returns false for different repo', () => {
      expect(doesMessageMatchPR(mockMessage, 'other/repo', 123, 'abc123def456')).toBe(
        false
      )
    })

    it('returns false for different PR number', () => {
      expect(doesMessageMatchPR(mockMessage, 'owner/repo', 456, 'abc123def456')).toBe(
        false
      )
    })

    it('returns false for different SHA', () => {
      expect(doesMessageMatchPR(mockMessage, 'owner/repo', 123, 'differentsha')).toBe(
        false
      )
    })
  })
})
