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

import { EventHandler, status, subscription } from "@atomist/skill";
import { info } from "@atomist/skill/lib/log";

import { LintConfiguration } from "../configuration";

export const onPush: EventHandler<
	subscription.types.OnPushSubscription,
	LintConfiguration
> = async ctx => {
	const push = ctx.data.Push[0];
	// const repo = push.repo;
	// const cfg = ctx.configuration.parameters;

	// Check branch to not be autogenerated
	if (push.branch.startsWith("atomist/")) {
		return status.success(`Ignore generated branch`).hidden().abort();
	}

	// Load repository
	// const credential = await ctx.credential.resolve(
	// 	secret.gitHubAppToken({
	// 		owner: repo.owner,
	// 		repo: repo.name,
	// 		apiUrl: repo.org.provider.apiUrl,
	// 	}),
	// );
	// const p = await ctx.project.clone(
	// 	repository.gitHub({
	// 		owner: repo.owner,
	// 		repo: repo.name,
	// 		credential,
	// 		branch: push.branch,
	// 	}),
	// );

	await info(`ctx.data: ${ctx.data}`);
	return status.success();
};
