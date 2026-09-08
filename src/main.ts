// Copyright (c) 2026 Jamf. All rights reserved.
// Licensed under the MIT License. See LICENSE file in the project root for details.

import * as core from '@actions/core'
import * as github from '@actions/github'
import { getConfig, validateConfig } from './config.js'
import { parseSignedApproval, isMessageExpired, doesMessageMatchPR } from './message.js'
import { verifySignature } from './signature.js'
import { checkCanaryBalance } from './blockchain.js'

async function run(): Promise<void> {
  try {
    const config = getConfig()
    validateConfig(config)

    const context = github.context
    const octokit = github.getOctokit(config.githubToken)

    let prNumber: number
    let headSha: string

    // Handle both pull_request and issue_comment events
    if (context.payload.pull_request) {
      prNumber = context.payload.pull_request.number
      headSha = context.payload.pull_request.head.sha
    } else if (context.payload.issue?.pull_request) {
      // This is a comment on a PR
      prNumber = context.payload.issue.number
      // Fetch PR details to get head SHA
      const { data: pr } = await octokit.rest.pulls.get({
        owner: context.repo.owner,
        repo: context.repo.repo,
        pull_number: prNumber,
      })
      headSha = pr.head.sha
    } else {
      core.setFailed('This action must run on a pull_request or issue_comment event')
      return
    }

    const repo = `${context.repo.owner}/${context.repo.repo}`

    core.info(`Checking crypto approvals for PR #${prNumber}`)
    core.info(`Head SHA: ${headSha}`)
    core.info(`Required approvals: ${config.minApprovals}`)
    core.info(`Allowed signers: ${config.allowedKeys.length}`)

    const comments = await octokit.paginate(octokit.rest.issues.listComments, {
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: prNumber,
      per_page: 100,
    })

    // Track unique valid signers and their canary balances
    const validSigners = new Set<string>()
    const canaryBalances = new Map<string, bigint>()

    for (const comment of comments) {
      const approval = parseSignedApproval(comment.body || '')
      if (!approval) continue

      core.info(`Found approval comment from ${comment.user?.login}`)

      if (!doesMessageMatchPR(approval.message, repo, prNumber, headSha)) {
        core.warning('Approval message does not match current PR state')
        continue
      }

      if (isMessageExpired(approval.message, config.signatureMaxAge)) {
        core.warning('Approval signature has expired')
        continue
      }

      const verification = verifySignature(
        approval.message,
        approval.signature,
        config.allowedKeys
      )

      if (!verification.valid) {
        core.warning(`Signature verification failed: ${verification.error}`)
        continue
      }

      // Skip if this signer already approved
      if (verification.signer && validSigners.has(verification.signer)) {
        core.info(`Signer ${verification.signer} already counted, skipping duplicate`)
        continue
      }

      // Check canary if required
      if (config.requireCanary && verification.signer) {
        core.info(`Checking canary balance on ${config.canaryChain}`)

        const canaryResult = await checkCanaryBalance(
          verification.signer,
          config.canaryChain,
          config.canaryMinBalance,
          config.canaryRpcUrl
        )

        if (!canaryResult.valid) {
          core.warning(
            `Canary check failed for ${verification.signer}: ${canaryResult.error}`
          )
          continue
        }

        core.info(`Canary balance OK: ${canaryResult.balance}`)
        canaryBalances.set(verification.signer, canaryResult.balance)
      }

      // Valid signer!
      if (verification.signer) {
        validSigners.add(verification.signer)
        core.info(
          `Valid signature from ${verification.signer} (${validSigners.size}/${config.minApprovals})`
        )
      }
    }

    const signersList = Array.from(validSigners)
    const hasEnoughApprovals = validSigners.size >= config.minApprovals
    const statusDescription = hasEnoughApprovals
      ? `Approved by ${signersList.join(', ')}`
      : `${validSigners.size}/${config.minApprovals} approvals (need ${config.minApprovals - validSigners.size} more)`

    core.setOutput('valid', hasEnoughApprovals)
    core.setOutput('signer', signersList.join(','))
    core.setOutput('approval-count', validSigners.size)
    if (canaryBalances.size > 0) {
      const balancesList = signersList
        .map((signer) => canaryBalances.get(signer)?.toString() ?? '')
        .filter((b) => b !== '')
      core.setOutput('canary-balance', balancesList.join(','))
    }

    // Set commit status so branch protection can use it
    await octokit.rest.repos.createCommitStatus({
      owner: context.repo.owner,
      repo: context.repo.repo,
      sha: headSha,
      state: hasEnoughApprovals ? 'success' : 'pending',
      context: 'crypto-approval',
      description: statusDescription,
    })

    if (!hasEnoughApprovals) {
      core.setFailed(`Need ${config.minApprovals} approvals, got ${validSigners.size}`)
    } else {
      core.info(
        `PR approved with ${validSigners.size} signature(s): ${signersList.join(', ')}`
      )
    }
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message)
    } else {
      core.setFailed('An unexpected error occurred')
    }
  }
}

run()
