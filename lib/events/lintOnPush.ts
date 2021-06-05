/*
 * Copyright © 2021 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
	EventContext,
	EventHandler,
	github,
	log,
	project,
	repository,
	runSteps,
	secret,
	status,
	Step,
} from "@atomist/skill";

import { LintConfiguration } from "../configuration";
import { LintOnPushSubscription } from "../typings/types";

interface LintParameters {
	project: project.Project;
	credential: secret.GitHubCredential | secret.GitHubAppCredential;
	start: string;
	check: github.Check;
}

type LintStep = Step<
	EventContext<LintOnPushSubscription, LintConfiguration>,
	LintParameters
>;

const SetupStep: LintStep = {
	name: "clone repository",
	run: async (ctx, params) => {
		const push = ctx.data.Push[0];
		const repo = push.repo;

		if (push.branch.startsWith("atomist/")) {
			return status.success(`Ignore generated branch`).hidden().abort();
		}

		log.info(`Starting Prettier on ${repo.owner}/${repo.name}`);

		params.credential = await ctx.credential.resolve(
			secret.gitHubAppToken({
				owner: repo.owner,
				repo: repo.name,
				apiUrl: repo.org.provider.apiUrl,
			}),
		);

		params.project = await ctx.project.clone(
			repository.gitHub({
				owner: repo.owner,
				repo: repo.name,
				credential: params.credential,
				branch: push.branch,
				sha: push.after.sha,
			}),
			{ alwaysDeep: false, detachHead: false },
		);
		log.info(
			`Cloned repository ${repo.owner}/${
				repo.name
			} at sha ${push.after.sha.slice(0, 7)}`,
		);

		params.check = await github.createCheck(ctx, params.project.id, {
			sha: push.after.sha,
			name: "prettier-skill",
			title: "Prettier",
			body: `Running \`prettier\``,
		});

		return status.success();
	},
};

export const handler: EventHandler<LintOnPushSubscription, LintConfiguration> =
	async ctx =>
		runSteps({
			context: ctx,
			steps: [SetupStep],
		});
