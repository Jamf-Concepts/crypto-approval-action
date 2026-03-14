export interface ApprovalMessage {
  repo: string
  prNumber: number
  headSha: string
  timestamp: number
  nonce: string
}

export interface SignedApproval {
  message: ApprovalMessage
  signature: string
}

export interface VerificationResult {
  valid: boolean
  signer?: string
  error?: string
}

export interface CanaryCheckResult {
  valid: boolean
  balance: bigint
  threshold: bigint
  address: string
  error?: string
}

export interface ActionConfig {
  allowedKeys: string[]
  requireCanary: boolean
  canaryChain: 'ethereum' | 'base' | 'polygon'
  canaryRpcUrl?: string
  canaryMinBalance: bigint
  signatureMaxAge: number
  githubToken: string
}

export interface ActionResult {
  valid: boolean
  signer?: string
  canaryBalance?: string
  error?: string
}

export const SUPPORTED_CHAINS = {
  ethereum: {
    name: 'Ethereum Mainnet',
    chainId: 1,
    defaultRpc: 'https://eth.llamarpc.com',
  },
  base: {
    name: 'Base',
    chainId: 8453,
    defaultRpc: 'https://base.llamarpc.com',
  },
  polygon: {
    name: 'Polygon',
    chainId: 137,
    defaultRpc: 'https://polygon.llamarpc.com',
  },
} as const
