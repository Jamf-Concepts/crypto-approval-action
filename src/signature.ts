import { secp256k1 } from '@noble/curves/secp256k1'
import { keccak_256 } from '@noble/hashes/sha3'
import type { ApprovalMessage, VerificationResult } from './types.js'
import { hashMessage } from './message.js'

export function ethereumPersonalSign(messageHash: Buffer): Buffer {
  const prefix = Buffer.from(`\x19Ethereum Signed Message:\n${messageHash.length}`)
  const prefixed = Buffer.concat([prefix, messageHash])
  return Buffer.from(keccak_256(prefixed))
}

export function recoverAddress(messageHash: Buffer, signature: string): string | null {
  try {
    const sigBytes = Buffer.from(signature, 'hex')

    if (sigBytes.length !== 65) {
      return null
    }

    const r = sigBytes.subarray(0, 32)
    const s = sigBytes.subarray(32, 64)
    let v = sigBytes[64]

    // Handle both pre-EIP-155 (27/28) and post-EIP-155 recovery ids
    if (v >= 27) {
      v -= 27
    }

    const sig = new secp256k1.Signature(
      BigInt('0x' + r.toString('hex')),
      BigInt('0x' + s.toString('hex'))
    ).addRecoveryBit(v)

    const ethHash = ethereumPersonalSign(messageHash)
    const publicKey = sig.recoverPublicKey(ethHash)
    const pubKeyBytes = publicKey.toRawBytes(false).slice(1) // Remove 0x04 prefix
    const addressHash = keccak_256(pubKeyBytes)
    const address = '0x' + Buffer.from(addressHash).subarray(-20).toString('hex')

    return address.toLowerCase()
  } catch {
    return null
  }
}

export function verifySignature(
  message: ApprovalMessage,
  signature: string,
  allowedAddresses: string[]
): VerificationResult {
  const normalizedAllowed = allowedAddresses.map((addr) => addr.toLowerCase())

  const messageHash = hashMessage(message)
  const recoveredAddress = recoverAddress(messageHash, signature)

  if (!recoveredAddress) {
    return {
      valid: false,
      error: 'Failed to recover address from signature',
    }
  }

  if (!normalizedAllowed.includes(recoveredAddress)) {
    return {
      valid: false,
      signer: recoveredAddress,
      error: `Signer ${recoveredAddress} is not in the allowed list`,
    }
  }

  return {
    valid: true,
    signer: recoveredAddress,
  }
}

export function isValidEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

export function checksumAddress(address: string): string {
  const addr = address.toLowerCase().replace('0x', '')
  const hash = Buffer.from(keccak_256(addr)).toString('hex')

  let checksummed = '0x'
  for (let i = 0; i < addr.length; i++) {
    if (parseInt(hash[i], 16) >= 8) {
      checksummed += addr[i].toUpperCase()
    } else {
      checksummed += addr[i]
    }
  }

  return checksummed
}
