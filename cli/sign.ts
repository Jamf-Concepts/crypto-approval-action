#!/usr/bin/env node

import {
  createApprovalMessage,
  formatApprovalComment,
  serializeMessage,
} from '../src/message.js'
import { hashPersonalMessage } from '../src/signature.js'

async function main(): Promise<void> {
  const args = process.argv.slice(2)

  if (args.length < 3) {
    console.log(`
Usage: npx tsx cli/sign.ts <repo> <pr-number> <head-sha>

Example:
  npx tsx cli/sign.ts owner/repo 123 abc123def456

This tool:
1. Constructs an approval message from PR metadata
2. Displays the message hash for signing with your hardware wallet
3. Prompts for the signature
4. Outputs the formatted PR comment

For hardware wallet signing:
- Ledger: Use Ledger Live or the ledger-js library
- Trezor: Use Trezor Suite or trezor-connect
- MetaMask: Use personal_sign RPC method

The signature should be the 65-byte secp256k1 signature (r, s, v).
`)
    process.exit(1)
  }

  const [repo, prNumberStr, headSha] = args
  const prNumber = parseInt(prNumberStr, 10)

  if (isNaN(prNumber)) {
    console.error('Error: PR number must be a valid integer')
    process.exit(1)
  }

  console.log('\n=== Crypto-Signed PR Approval ===\n')
  console.log(`Repository: ${repo}`)
  console.log(`PR Number:  ${prNumber}`)
  console.log(`Head SHA:   ${headSha}`)

  const message = createApprovalMessage(repo, prNumber, headSha)

  console.log('\n--- Approval Message ---')
  console.log(JSON.stringify(message, null, 2))

  const serialized = serializeMessage(message)
  console.log('\n--- Serialized Message (what gets signed) ---')
  console.log(serialized)

  const messageHash = hashPersonalMessage(serialized)
  console.log('\n--- EIP-191 Message Hash (keccak256 with Ethereum prefix) ---')
  console.log(`0x${Buffer.from(messageHash).toString('hex')}`)

  console.log('\n--- Instructions ---')
  console.log('1. Sign the above hash with your hardware wallet')
  console.log('2. Use personal_sign or eth_sign method')
  console.log('3. Paste the 65-byte signature (130 hex chars) below')

  // In a real implementation, this would integrate with hardware wallet APIs
  // For now, we prompt for manual signature input
  const readline = await import('readline')
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  const signature = await new Promise<string>((resolve) => {
    rl.question('\nEnter signature (hex): ', (answer) => {
      rl.close()
      resolve(answer.trim().replace('0x', ''))
    })
  })

  if (signature.length !== 130) {
    console.error(
      `\nError: Signature must be 130 hex characters (65 bytes), got ${signature.length}`
    )
    process.exit(1)
  }

  console.log('\n=== PR Comment (copy and paste to GitHub) ===\n')
  console.log(formatApprovalComment(message, signature))
}

main().catch((error) => {
  console.error('Error:', error.message)
  process.exit(1)
})
