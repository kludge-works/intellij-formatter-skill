import { Commit } from "@atomist/skill/lib/definition/subscription/common_types";
import { Project } from "@atomist/skill/lib/project";
import { RepositoryProviderType } from "@atomist/skill/lib/repository";
import * as fs from "fs-extra";
import * as assert from "power-assert";
import * as sinon from "sinon";

import { changedFilesFromCommits } from "../lib/events";

describe("on event", function () {
	let sandbox: sinon.SinonSandbox;

	before(() => {
		sandbox = sinon.createSandbox();
	});

	after(() => {
		sandbox.reset();
		sandbox.restore();
	});

	it("only return distinct files that exist", async () => {
		const f = (cmd, args) => {
			const sha = args[args.length - 1];

			let output: string[];
			if (sha === "first-commit") {
				output = ["same.java", "distinct-1.java"];
			} else if (sha === "second-commit") {
				output = ["same.java", "distinct-2.java"];
			}
			return {
				status: 0,
				output,
			};
		};
		const p = createFakeProject(f);

		const commits: Pick<Commit, "sha">[] = [
			{ sha: "first-commit" },
			{ sha: "second-commit" },
		];

		sinon
			.stub(fs, "existsSync")
			.withArgs("same.java")
			.returns(true)
			.withArgs("distinct-1.java")
			.returns(true)
			.withArgs("distinct-2.java")
			.returns(true);

		const files = await changedFilesFromCommits(p, commits as Commit[]);
		assert.deepEqual(files, [
			"same.java",
			"distinct-1.java",
			"distinct-2.java",
		]);
	});
});

function createFakeProject(
	f: (cmd, args, opts) => { output: string[]; status: number },
): Project {
	return {
		id: {
			credential: "fake",
			cloneUrl: () => "https://fake.project.host.com/fake/project",
			owner: "dummyOwner",
			repo: "dummyRepo",
			sha: "9e48f944bf1aaf41feeea003aa1c96a92cec0c4f",
			type: RepositoryProviderType.GitHubCom,
		},
		spawn: sinon.fake(f),
		exec: sinon.fake.throws(new Error("Should not be called")),
		path: () => "/fake/project/path",
	};
}
