// Copyright (c) 2026 Jamf. All rights reserved.
// Licensed under the MIT License. See LICENSE file in the project root for details.

import { formatWei, parseWei, addressFromPublicKey } from '../src/blockchain'

// Note: getBalance and checkCanaryBalance require network calls,
// so we test them separately with mocked fetch or integration tests

describe('blockchain', () => {
  describe('formatWei', () => {
    it('formats wei to ETH', () => {
      expect(formatWei(1000000000000000000n)).toBe('1.000000 ETH')
      expect(formatWei(10000000000000000n)).toBe('0.010000 ETH')
      expect(formatWei(0n)).toBe('0.000000 ETH')
    })

    it('handles large values', () => {
      expect(formatWei(1000000000000000000000n)).toBe('1000.000000 ETH')
    })
  })

  describe('parseWei', () => {
    it('parses raw wei values', () => {
      expect(parseWei('1000000000000000000')).toBe(1000000000000000000n)
      expect(parseWei('0')).toBe(0n)
    })

    it('parses ether notation', () => {
      expect(parseWei('1 ether')).toBe(1000000000000000000n)
      expect(parseWei('0.5eth')).toBe(500000000000000000n)
      expect(parseWei('2.5 ETH')).toBe(2500000000000000000n)
    })

    it('parses gwei notation', () => {
      expect(parseWei('1 gwei')).toBe(1000000000n)
      expect(parseWei('100gwei')).toBe(100000000000n)
    })
  })

  describe('addressFromPublicKey', () => {
    it('returns address unchanged if already an address', () => {
      const address = '0x742d35Cc6634C0532925a3b844Bc9e7595f9fEb1'
      expect(addressFromPublicKey(address)).toBe(address.toLowerCase())
    })

    it('derives address from uncompressed public key (with 04 prefix)', () => {
      // Well-known test public key
      const publicKey =
        '04e68acfc0253a10620dff706b0a1b1f1f5833ea3beb3bde2250d5f271f3563606672ebc45e0b7ea2e816ecb70ca03137b1c9476eec63d4632e990020b7b6fba39'

      const address = addressFromPublicKey(publicKey)
      expect(address).toMatch(/^0x[a-f0-9]{40}$/)
    })

    it('derives address from uncompressed public key (without prefix)', () => {
      const publicKey =
        'e68acfc0253a10620dff706b0a1b1f1f5833ea3beb3bde2250d5f271f3563606672ebc45e0b7ea2e816ecb70ca03137b1c9476eec63d4632e990020b7b6fba39'

      const address = addressFromPublicKey(publicKey)
      expect(address).toMatch(/^0x[a-f0-9]{40}$/)
    })

    it('throws for invalid public key length', () => {
      expect(() => addressFromPublicKey('0x1234')).toThrow('Invalid public key length')
    })
  })
})
