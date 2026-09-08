// Copyright (c) 2026 Jamf. All rights reserved.
// Licensed under the MIT License. See LICENSE file in the project root for details.

import * as core from '@actions/core'
import * as fs from 'fs'
import * as path from 'path'
import type { ActionConfig } from './types.js'
import { SUPPORTED_CHAINS } from './types.js'
import { isValidEthereumAddress } from './signature.js'

export function parseKeyownersFile(filePath: string): string[] {
  if (!fs.existsSync(filePath)) {
    return []
  }

  const content = fs.readFileSync(filePath, 'utf-8')
  return parseKeyownersContent(content)
}

export function parseKeyownersContent(content: string): string[] {
  return content
    .split('\n')
    .map((line) => {
      // Remove comments (everything after #)
      const commentIndex = line.indexOf('#')
      const addressPart = commentIndex >= 0 ? line.slice(0, commentIndex) : line
      return addressPart.trim()
    })
    .filter((line) => line.length > 0)
}

export function getConfig(): ActionConfig {
  const allowedKeysInput = core.getInput('allowed-keys')
  const keyownersFile = core.getInput('keyowners-file') || '.github/KEYOWNERS'
  const minApprovalsInput = core.getInput('min-approvals')
  const requireCanary = core.getBooleanInput('require-canary')
  const canaryChain = core.getInput('canary-chain') as keyof typeof SUPPORTED_CHAINS
  const canaryRpcUrl = core.getInput('canary-rpc-url') || undefined
  const canaryMinBalanceInput = core.getInput('canary-min-balance')
  const signatureMaxAgeInput = core.getInput('signature-max-age')
  const githubToken = core.getInput('github-token', { required: true })

  // Precedence: allowed-keys input > KEYOWNERS file
  let allowedKeys: string[]
  let keySource: string

  if (allowedKeysInput && allowedKeysInput.trim().length > 0) {
    allowedKeys = allowedKeysInput
      .split(',')
      .map((key) => key.trim())
      .filter((key) => key.length > 0)
    keySource = 'allowed-keys input'
  } else {
    const keyownersPath = path.resolve(process.cwd(), keyownersFile)
    allowedKeys = parseKeyownersFile(keyownersPath)
    keySource = `KEYOWNERS file (${keyownersFile})`

    if (allowedKeys.length === 0) {
      throw new Error(
        `No allowed keys configured. Provide either:\n` +
          `  1. 'allowed-keys' input in workflow\n` +
          `  2. A KEYOWNERS file at ${keyownersFile}\n\n` +
          `See README for configuration options.`
      )
    }
  }

  core.info(`Loading authorized keys from: ${keySource}`)

  for (const key of allowedKeys) {
    if (!isValidEthereumAddress(key)) {
      throw new Error(`Invalid Ethereum address in ${keySource}: ${key}`)
    }
  }

  const minApprovals = parseInt(minApprovalsInput || '1', 10)

  if (isNaN(minApprovals) || minApprovals < 1) {
    throw new Error(`Invalid min-approvals: ${minApprovalsInput}`)
  }

  if (minApprovals > allowedKeys.length) {
    throw new Error(
      `min-approvals (${minApprovals}) cannot be greater than number of allowed-keys (${allowedKeys.length})`
    )
  }

  if (requireCanary && !(canaryChain in SUPPORTED_CHAINS)) {
    throw new Error(
      `Unsupported chain: ${canaryChain}. Supported: ${Object.keys(SUPPORTED_CHAINS).join(', ')}`
    )
  }

  const canaryMinBalance = BigInt(canaryMinBalanceInput || '10000000000000000')
  const signatureMaxAge = parseInt(signatureMaxAgeInput || '3600', 10)

  if (isNaN(signatureMaxAge) || signatureMaxAge <= 0) {
    throw new Error(`Invalid signature-max-age: ${signatureMaxAgeInput}`)
  }

  return {
    allowedKeys,
    minApprovals,
    requireCanary,
    canaryChain,
    canaryRpcUrl,
    canaryMinBalance,
    signatureMaxAge,
    githubToken,
  }
}

export function validateConfig(config: ActionConfig): void {
  if (config.allowedKeys.length === 0) {
    throw new Error('At least one allowed key must be specified')
  }

  if (config.signatureMaxAge < 60) {
    core.warning('signature-max-age is less than 60 seconds, this may cause issues')
  }

  if (config.signatureMaxAge > 86400) {
    core.warning(
      'signature-max-age is greater than 24 hours, consider reducing for security'
    )
  }
}
