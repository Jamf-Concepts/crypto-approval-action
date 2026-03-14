import {
  verifySignature,
  isValidEthereumAddress,
  checksumAddress,
  recoverAddress,
  hashPersonalMessage,
} from '../src/signature'
import type { ApprovalMessage } from '../src/types'
import { serializeMessage } from '../src/message'
import { secp256k1 } from '@noble/curves/secp256k1'

describe('signature', () => {
  // Test private key (DO NOT USE IN PRODUCTION)
  const testPrivateKey =
    'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'

  // Corresponding address
  const testAddress = '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266'

  const mockMessage: ApprovalMessage = {
    repo: 'owner/repo',
    prNumber: 123,
    headSha: 'abc123def456',
    timestamp: 1710422400,
    nonce: 'deadbeef12345678deadbeef12345678',
  }

  // Sign the same way MetaMask personal_sign does
  function signMessage(message: ApprovalMessage, privateKey: string): string {
    const serialized = serializeMessage(message)
    const messageHash = hashPersonalMessage(serialized)
    const sig = secp256k1.sign(messageHash, privateKey)
    const r = sig.r.toString(16).padStart(64, '0')
    const s = sig.s.toString(16).padStart(64, '0')
    const v = (sig.recovery + 27).toString(16).padStart(2, '0')
    return r + s + v
  }

  describe('isValidEthereumAddress', () => {
    it('validates correct addresses', () => {
      expect(isValidEthereumAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f9fEb1')).toBe(
        true
      )
      expect(isValidEthereumAddress('0x0000000000000000000000000000000000000000')).toBe(
        true
      )
    })

    it('rejects invalid addresses', () => {
      expect(isValidEthereumAddress('742d35Cc6634C0532925a3b844Bc9e7595f9fEb1')).toBe(
        false
      ) // missing 0x
      expect(isValidEthereumAddress('0x742d35Cc6634C0532925a3b844Bc9e759')).toBe(false) // too short
      expect(isValidEthereumAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f9fEb1a')).toBe(
        false
      ) // too long
      expect(isValidEthereumAddress('0xGGGd35Cc6634C0532925a3b844Bc9e7595f9fEb1')).toBe(
        false
      ) // invalid chars
    })
  })

  describe('checksumAddress', () => {
    it('returns checksum address', () => {
      const input = '0xfb6916095ca1df60bb79ce92ce3ea74c37c5d359'
      const checksummed = checksumAddress(input)

      // The checksum should change some letters to uppercase
      expect(checksummed).toMatch(/^0x[a-fA-F0-9]{40}$/)
      expect(checksummed.toLowerCase()).toBe(input.toLowerCase())
    })
  })

  describe('recoverAddress', () => {
    it('recovers address from valid signature', () => {
      const signature = signMessage(mockMessage, testPrivateKey)
      const serialized = serializeMessage(mockMessage)
      const recovered = recoverAddress(serialized, signature)

      expect(recovered).toBe(testAddress.toLowerCase())
    })

    it('returns null for invalid signature length', () => {
      const serialized = serializeMessage(mockMessage)
      expect(recoverAddress(serialized, 'invalid')).toBeNull()
      expect(recoverAddress(serialized, 'a'.repeat(128))).toBeNull() // 64 bytes, not 65
    })
  })

  describe('verifySignature', () => {
    it('verifies valid signature from allowed address', () => {
      const signature = signMessage(mockMessage, testPrivateKey)
      const result = verifySignature(mockMessage, signature, [testAddress])

      expect(result.valid).toBe(true)
      expect(result.signer).toBe(testAddress.toLowerCase())
    })

    it('rejects signature from non-allowed address', () => {
      const signature = signMessage(mockMessage, testPrivateKey)
      const otherAddress = '0x1234567890123456789012345678901234567890'
      const result = verifySignature(mockMessage, signature, [otherAddress])

      expect(result.valid).toBe(false)
      expect(result.error).toContain('not in the allowed list')
    })

    it('handles case-insensitive address comparison', () => {
      const signature = signMessage(mockMessage, testPrivateKey)
      const result = verifySignature(mockMessage, signature, [testAddress.toUpperCase()])

      expect(result.valid).toBe(true)
    })

    it('returns error for invalid signature', () => {
      const result = verifySignature(mockMessage, 'invalid', [testAddress])

      expect(result.valid).toBe(false)
      expect(result.error).toContain('Failed to recover')
    })
  })
})
