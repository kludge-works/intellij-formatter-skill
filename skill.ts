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
	Category,
	LineStyle,
	parameter,
	ParameterType,
	ParameterVisibility,
	resourceProvider,
	skill,
} from "@atomist/skill";

import { FormatterConfiguration } from "./lib/configuration";

export const Skill = skill<FormatterConfiguration & { repos: any }>({
	name: "intellij-formatter-skill",
	namespace: "kludge-works",
	displayName: "intellij formatter",
	author: "kludge-works",
	categories: [Category.CodeMaintenance],
	iconUrl:
		"https://intellij-icons.jetbrains.design/icons/ProductLogosIcons/generated/idea_com/idea_com.svg",
	license: "Apache-2.0",

	subscriptions: ["@atomist/skill/github/onPush"],

	containers: {
		formatter: {
			image: "docker.io/kludgeworks/intellij-formatter-skill:1.0.5",
			resources: {
				limit: {
					cpu: 2,
					memory: 2000,
				},
				request: {
					cpu: 2,
					memory: 2000,
				},
			},
		},
	},

	resourceProviders: {
		github: resourceProvider.gitHub({ minRequired: 1 }),
	},

	parameters: {
		glob: {
			type: ParameterType.String,
			displayName: "Files",
			description: "glob pattern to format, defaults to **/*.java",
			required: false,
			defaultValue: "**/*.java",
		},
		ignores: {
			type: ParameterType.StringArray,
			displayName: "Ignore pattern",
			description:
				"Pattern of files or folders to ignore during formatting",
			required: false,
			defaultValue: [],
		},
		codestyle: {
			type: ParameterType.String,
			displayName: "Configuration",
			description:
				"IntelliJ code style to use. If not specified the default Intellij code style will be used",
			lineStyle: LineStyle.Multiple,
			required: false,
		},
		onlyFormatChangedFiles: {
			type: ParameterType.Boolean,
			displayName: "Only format modified files",
			description:
				"If checked then only format files that were modified in the commit",
			required: true,
		},
		push: parameter.pushStrategy({
			displayName: "Fix problems",
			description:
				"Determine how and when fixes should be committed back into the repository",
			options: [
				{
					text: "Do not apply fixes",
					value: "none",
				},
			],
		}),
		commitMsg: {
			type: ParameterType.String,
			displayName: "Commit message",
			description:
				"Commit message to use when committing fixes back into the repository",
			placeHolder: "IntelliJ formatter fixes",
			required: false,
			visibility: ParameterVisibility.Hidden,
		},
		labels: {
			type: ParameterType.StringArray,
			displayName: "Pull request labels",
			description:
				"Add additional labels to pull requests raised by this skill, e.g. to configure the [auto-merge](https://go.atomist.com/catalog/skills/atomist/github-auto-merge-skill) behavior.",
			required: false,
		},
		repos: parameter.repoFilter(),
		filesToFormatPerSlice: {
			type: ParameterType.Int,
			visibility: ParameterVisibility.Hidden,
			defaultValue: 100,
			required: true,
			description: "Number of files to format per execution",
		},
	},
});
