import * as core from '@actions/core'
import type { ActionConfig } from './types.js'
import { SUPPORTED_CHAINS } from './types.js'
import { isValidEthereumAddress } from './signature.js'

export function getConfig(): ActionConfig {
  const allowedKeysInput = core.getInput('allowed-keys', { required: true })
  const requireCanary = core.getBooleanInput('require-canary')
  const canaryChain = core.getInput('canary-chain') as keyof typeof SUPPORTED_CHAINS
  const canaryRpcUrl = core.getInput('canary-rpc-url') || undefined
  const canaryMinBalanceInput = core.getInput('canary-min-balance')
  const signatureMaxAgeInput = core.getInput('signature-max-age')
  const githubToken = core.getInput('github-token', { required: true })

  const allowedKeys = allowedKeysInput
    .split(',')
    .map((key) => key.trim())
    .filter((key) => key.length > 0)

  for (const key of allowedKeys) {
    if (!isValidEthereumAddress(key)) {
      throw new Error(`Invalid Ethereum address in allowed-keys: ${key}`)
    }
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
