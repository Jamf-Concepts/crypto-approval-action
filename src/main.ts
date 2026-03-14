import * as core from '@actions/core'
import * as github from '@actions/github'
import { getConfig, validateConfig } from './config.js'
import { parseSignedApproval, isMessageExpired, doesMessageMatchPR } from './message.js'
import { verifySignature } from './signature.js'
import { checkCanaryBalance } from './blockchain.js'
import type { ActionResult } from './types.js'

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
    core.info(`Allowed signers: ${config.allowedKeys.length}`)

    const { data: comments } = await octokit.rest.issues.listComments({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: prNumber,
    })

    let result: ActionResult = {
      valid: false,
      error: 'No valid crypto approval found',
    }

    core.info(`Found ${comments.length} comments to check`)

    for (const comment of comments) {
      core.debug(`Checking comment ${comment.id} from ${comment.user?.login}`)
      const approval = parseSignedApproval(comment.body || '')
      if (!approval) {
        core.debug(`Comment ${comment.id} does not contain approval format`)
        continue
      }

      core.info(`Found approval comment from ${comment.user?.login}`)

      core.info(
        `Approval message: repo=${approval.message.repo}, pr=${approval.message.prNumber}, sha=${approval.message.headSha}`
      )
      core.info(`Expected: repo=${repo}, pr=${prNumber}, sha=${headSha}`)

      if (!doesMessageMatchPR(approval.message, repo, prNumber, headSha)) {
        core.warning('Approval message does not match current PR state')
        continue
      }

      if (isMessageExpired(approval.message, config.signatureMaxAge)) {
        core.warning('Approval signature has expired')
        continue
      }

      core.info(`Verifying signature: ${approval.signature.substring(0, 20)}...`)
      core.info(`Allowed keys: ${config.allowedKeys.join(', ')}`)

      const verification = verifySignature(
        approval.message,
        approval.signature,
        config.allowedKeys
      )

      core.info(
        `Verification result: valid=${verification.valid}, signer=${verification.signer || 'none'}, error=${verification.error || 'none'}`
      )

      if (!verification.valid) {
        core.warning(`Signature verification failed: ${verification.error}`)
        continue
      }

      core.info(`Valid signature from ${verification.signer}`)

      if (config.requireCanary && verification.signer) {
        core.info(`Checking canary balance on ${config.canaryChain}`)

        const canaryResult = await checkCanaryBalance(
          verification.signer,
          config.canaryChain,
          config.canaryMinBalance,
          config.canaryRpcUrl
        )

        if (!canaryResult.valid) {
          core.warning(`Canary check failed: ${canaryResult.error}`)
          result = {
            valid: false,
            signer: verification.signer,
            canaryBalance: canaryResult.balance.toString(),
            error: `Canary balance check failed: ${canaryResult.error}`,
          }
          continue
        }

        core.info(`Canary balance OK: ${canaryResult.balance}`)
        result.canaryBalance = canaryResult.balance.toString()
      }

      result = {
        valid: true,
        signer: verification.signer,
        canaryBalance: result.canaryBalance,
      }
      break
    }

    core.setOutput('valid', result.valid)
    core.setOutput('signer', result.signer || '')
    core.setOutput('canary-balance', result.canaryBalance || '')

    if (!result.valid) {
      core.setFailed(result.error || 'No valid crypto approval found')
    } else {
      core.info(`PR approved by ${result.signer}`)
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
