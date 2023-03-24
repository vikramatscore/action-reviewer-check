import * as core from '@actions/core'
import * as github from '@actions/github'
import fs from 'fs'

async function run(): Promise<void> {
  try {
    const token = core.getInput('github_token') || process.env.GITHUB_TOKEN;

    if (!token) {
      core.setFailed('❌ Missing Github token');
      return;
    }

    const reviewersJsonFilePath = core.getInput('reviewers_json_file_path');

    if (!reviewersJsonFilePath) {
      core.setFailed('❌ Missing reviewers JSON');
      return;
    }

    const pullRequest = github.context.payload.pull_request;

    if (pullRequest) {
      // Latest commit SHA on the PR
      const headSha = pullRequest.head.sha;
      console.log("Found pull request, head SHA: " + headSha);
      
      const octokit = github.getOctokit(token);

      const {
        repo: {repo: repoName, owner: repoOwner},
        runId: runId
      } = github.context
      const defaultParameter = {
        repo: repoName,
        owner: repoOwner
      };

      // Returns all the reviews posted on this PR.
      // So, it could contain multiple reviews from the 
      // same user. For instance, if they requested changes,
      // and later approved the PR, this would contain 2
      // reviews from the user.
      const reviews = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews', {
        ...defaultParameter,
        pull_number: pullRequest.number
      });

      // Mandatory reviewers
      const reviewersJson = JSON.parse(fs.readFileSync(reviewersJsonFilePath, 'utf-8')) as string[];

      const match = reviews.data.find((review) => {
        // Checks whether the approval is on the 
        // PR's latest commit. This is needed
        // so that we don't consider an approval
        // on a previous commit. 
        // There is a potential issue with this check.
        // If a reviewer approves the latest commit,
        // and then (for some reason) requests changes,
        // this check would still pass because the 
        // approval & the request changes happen on the
        // same (latest) commit. I think this is ok
        // since:
        // - if the request changes happens after the
        //   approval, Github will itself block merging
        //   the PR
        // - if the approval happens after the request 
        //   changes, all good
        // Reviews are time-stamped - so if need be,
        // we could group the reviews received for the
        // latest commit by user, & sort them to get the
        // most recent approval state.
        return review.state === "APPROVED" 
          && review.commit_id === headSha 
          && reviewersJson.includes(`${review.user?.login}`) 
      });

      if (!match) {
        // This will block the PR from getting merged.
        core.setFailed("Mandatory review check failed");
      }
    }
  } catch (error) {
    console.log("Error: " + JSON.stringify(error));
    if (error instanceof Error) core.setFailed("Caught an error: " + error.message);
  }
}

run()
