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
	EventHandler,
	github,
	repository,
	secret,
	status,
	subscription,
} from "@atomist/skill";
import { Commit } from "@atomist/skill/lib/definition/subscription/common_types";
import { debug, info } from "@atomist/skill/lib/log";
import { globFiles, Project } from "@atomist/skill/lib/project";
import * as fs from "fs-extra";
import * as mm from "micromatch";

import { FormatterConfiguration, intellijFormatter } from "./configuration";

export const onPush: EventHandler<
	subscription.types.OnPushSubscription,
	FormatterConfiguration
> = async ctx => {
	const push = ctx.data.Push[0];
	const repo = push.repo;
	const params = ctx.configuration.parameters;

	// Check branch to not be autogenerated
	if (push.branch.startsWith("atomist/")) {
		return status.success(`Ignore generated branch`).hidden().abort();
	}

	const credential = await ctx.credential.resolve(
		secret.gitHubAppToken({
			owner: repo.owner,
			repo: repo.name,
			apiUrl: repo.org.provider.apiUrl,
		}),
	);
	const project = await ctx.project.clone(
		repository.gitHub({
			owner: repo.owner,
			repo: repo.name,
			credential,
			branch: push.branch,
		}),
		{ alwaysDeep: true },
	);

	info(`config: ${JSON.stringify(ctx.configuration.parameters)}`);
	// push.commits
	await formatProject(
		project,
		ctx.configuration.parameters,
		await filesToFormat(
			project,
			ctx.configuration.parameters,
			push.commits as Commit[],
		),
	);

	return github.persistChanges(
		ctx,
		project,
		ctx.configuration.parameters.push,
		{
			branch: push.branch,
			defaultBranch: repo.defaultBranch,
			author: {
				login: push.after.author?.login,
				name: push.after.author?.person.name,
				email: push.after.author?.person.emails?.[0]?.address,
			},
		},
		{
			branch: `atomist/intellij-formatter-${push.branch}`,
			title: "IntelliJ formatter fixes",
			body: "IntelliJ formatter reformatted files",
			labels: params.labels,
		},
		{
			message: params.commitMsg,
		},
	);
};

export async function formatProject(
	project: Project,
	config: FormatterConfiguration,
	allFilesToFormat: string[],
): Promise<void> {
	info(`formatProject: ${JSON.stringify(allFilesToFormat)}`);
	const args: string[] = [];
	if (config.codestyle) {
		fs.writeFileSync("/atm/home/codestyle.xml", config.codestyle);
		args.push("-s", "/atm/home/codestyle.xml");
	}

	while (allFilesToFormat.length) {
		const formatterArgs = args.concat(
			allFilesToFormat.splice(0, config.filesToFormatPerSlice),
		);
		await project.spawn(intellijFormatter, formatterArgs, {
			level: "info",
		});
	}
}

export async function filesToFormat(
	project: Project,
	config: FormatterConfiguration,
	commits: Commit[],
): Promise<string[]> {
	info(
		`filesToFormat( commits: ${JSON.stringify(
			commits,
		)}, config: ${JSON.stringify(config)})`,
	);
	let allFilesToFormat: string[];
	if (config.onlyFormatChangedFiles) {
		allFilesToFormat = await changedFilesFromCommits(project, commits);
	} else {
		allFilesToFormat = await globFiles(project, config.glob);
	}
	return mm.not(allFilesToFormat, config.ignores);
}

export async function changedFilesFromCommits(
	project: Project,
	commits: Commit[],
): Promise<string[]> {
	debug(`changedFilesFromCommit: ${JSON.stringify(commits)}`);
	const set = new Set<string>();

	for (const commit of commits) {
		const result = await project.spawn(
			"git",
			["diff-tree", "--no-commit-id", "--name-only", "-r", commit.sha],
			{
				level: "info",
			},
		);
		info(`diff tree result: ${JSON.stringify(result)}`);
		info(`result.output: ${JSON.stringify(result.output)}`);
		info(`result.stdout: ${JSON.stringify(result.stdout)}`);

		result.output.forEach(item => set.add(item));
	}
	info(`changedFilesFromCommits: ${JSON.stringify(set)}`);
	return Array.from(set).filter(file => fs.existsSync(file));
}
