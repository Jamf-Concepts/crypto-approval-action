// Copyright (c) 2026 Jamf. All rights reserved.
// Licensed under the MIT License. See LICENSE file in the project root for details.

import { parseKeyownersContent } from '../src/config.js'

describe('parseKeyownersContent', () => {
  it('parses simple addresses', () => {
    const content = `0xAlice123
0xBob456
0xCharlie789`
    expect(parseKeyownersContent(content)).toEqual([
      '0xAlice123',
      '0xBob456',
      '0xCharlie789',
    ])
  })

  it('ignores comments', () => {
    const content = `# This is a comment
0xAlice123  # Alice - Security Lead
0xBob456    # Bob - Platform Team
# Another comment
0xCharlie789`
    expect(parseKeyownersContent(content)).toEqual([
      '0xAlice123',
      '0xBob456',
      '0xCharlie789',
    ])
  })

  it('ignores empty lines', () => {
    const content = `0xAlice123

0xBob456

`
    expect(parseKeyownersContent(content)).toEqual(['0xAlice123', '0xBob456'])
  })

  it('trims whitespace', () => {
    const content = `  0xAlice123
	0xBob456
0xCharlie789   # with comment  `
    expect(parseKeyownersContent(content)).toEqual([
      '0xAlice123',
      '0xBob456',
      '0xCharlie789',
    ])
  })

  it('returns empty array for empty content', () => {
    expect(parseKeyownersContent('')).toEqual([])
    expect(parseKeyownersContent('   \n\n   ')).toEqual([])
    expect(parseKeyownersContent('# just comments\n# nothing else')).toEqual([])
  })

  it('handles real-world KEYOWNERS file', () => {
    const content = `# KEYOWNERS - Authorized signers for crypto-approval
# One address per line, comments start with #

0x810a44040c66446C394b9dC09E80394C03ab90d2  # Alice - Security Lead
0xe93Ce3fD806985Fd5259B4F4669C51C3cB224b19  # Bob - Platform Team

# Inactive signers (commented out)
# 0xOldSigner123  # Charlie - Left company
`
    expect(parseKeyownersContent(content)).toEqual([
      '0x810a44040c66446C394b9dC09E80394C03ab90d2',
      '0xe93Ce3fD806985Fd5259B4F4669C51C3cB224b19',
    ])
  })
})
