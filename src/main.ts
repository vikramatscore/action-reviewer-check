import * as core from '@actions/core'
import * as github from '@actions/github'
import {wait} from './wait'
import fs from 'fs'

async function run(): Promise<void> {
  try {
    const token = core.getInput('github_token') || process.env.GITHUB_TOKEN

    if (!token) {
      core.setFailed('❌ Missing Github token')
      return
    }

    const reviewersJsonFilePath = core.getInput('reviewers_json_file_path')

    if (!reviewersJsonFilePath) {
      core.setFailed('❌ Missing reviewers JSON')
      return
    }

    const pullRequest = github.context.payload.pull_request

    if (pullRequest) {
      console.log("Found pull request")
      const octokit = github.getOctokit(token)

      const {
        repo: {repo: repoName, owner: repoOwner},
        runId: runId
      } = github.context
      const defaultParameter = {
        repo: repoName,
        owner: repoOwner
      }

      const reviews = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews', {
        ...defaultParameter,
        pull_number: pullRequest.number
      })
      console.log("reviews: " + reviews.data.length)

      const reviewersJson = JSON.parse(fs.readFileSync(reviewersJsonFilePath, 'utf-8')) as string[]
      console.log("Reviewers JSON: " + JSON.stringify(reviewersJson))

      const match = reviews.data.find((review) => {
        return review.state === "APPROVED" && reviewersJson.includes(`${review.user?.login}`) 
      })
      console.log("Match found: " + JSON.stringify(match))

      if (!match) {
        core.setFailed("Mandatory review check failed")
      }
    }
  } catch (error) {
    console.log("Error: " + JSON.stringify(error))
    if (error instanceof Error) core.setFailed("Caught an error: " + error.message)
  }
}

run()
