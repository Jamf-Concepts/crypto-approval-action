// Copyright (c) 2026 Jamf. All rights reserved.
// Licensed under the MIT License. See LICENSE file in the project root for details.

import type { CanaryCheckResult } from './types.js'
import { SUPPORTED_CHAINS } from './types.js'
import { keccak_256 } from '@noble/hashes/sha3'

interface JsonRpcResponse {
  jsonrpc: string
  id: number
  result?: string
  error?: { code: number; message: string }
}

export async function getBalance(address: string, rpcUrl: string): Promise<bigint> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000) // 30 second timeout

  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getBalance',
        params: [address, 'latest'],
        id: 1,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`RPC request failed: ${response.status}`)
    }

    const data = (await response.json()) as JsonRpcResponse

    if (data.error) {
      throw new Error(`RPC error: ${data.error.message}`)
    }

    if (!data.result) {
      throw new Error('No result in RPC response')
    }

    return BigInt(data.result)
  } finally {
    clearTimeout(timeout)
  }
}

export async function checkCanaryBalance(
  address: string,
  chain: keyof typeof SUPPORTED_CHAINS,
  minBalance: bigint,
  customRpcUrl?: string
): Promise<CanaryCheckResult> {
  const chainConfig = SUPPORTED_CHAINS[chain]
  const rpcUrl = customRpcUrl || chainConfig.defaultRpc

  try {
    const balance = await getBalance(address, rpcUrl)

    return {
      valid: balance >= minBalance,
      balance,
      threshold: minBalance,
      address,
      error:
        balance < minBalance
          ? `Balance ${formatWei(balance)} is below threshold ${formatWei(minBalance)}`
          : undefined,
    }
  } catch (error) {
    return {
      valid: false,
      balance: 0n,
      threshold: minBalance,
      address,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export function formatWei(wei: bigint): string {
  const eth = Number(wei) / 1e18
  return `${eth.toFixed(6)} ETH`
}

export function parseWei(value: string): bigint {
  const lowerValue = value.toLowerCase().trim()

  if (lowerValue.endsWith('ether') || lowerValue.endsWith('eth')) {
    const num = parseFloat(value.replace(/\s*(ether|eth)$/i, ''))
    return BigInt(Math.floor(num * 1e18))
  }

  if (lowerValue.endsWith('gwei')) {
    const num = parseFloat(value.replace(/\s*gwei$/i, ''))
    return BigInt(Math.floor(num * 1e9))
  }

  return BigInt(value)
}

export function addressFromPublicKey(publicKeyHex: string): string {
  // If it's already an address, return it
  if (/^0x[a-fA-F0-9]{40}$/.test(publicKeyHex)) {
    return publicKeyHex.toLowerCase()
  }

  // Handle uncompressed public key (65 bytes with 04 prefix or 64 bytes without)
  let keyBytes: Uint8Array
  const hex = publicKeyHex.startsWith('0x') ? publicKeyHex.slice(2) : publicKeyHex

  if (hex.length === 130) {
    // 65 bytes with 04 prefix
    keyBytes = Buffer.from(hex.slice(2), 'hex')
  } else if (hex.length === 128) {
    // 64 bytes without prefix
    keyBytes = Buffer.from(hex, 'hex')
  } else {
    throw new Error(`Invalid public key length: ${hex.length}`)
  }

  const hash = keccak_256(keyBytes)
  return '0x' + Buffer.from(hash).subarray(-20).toString('hex')
}
