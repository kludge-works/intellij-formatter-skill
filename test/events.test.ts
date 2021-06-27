import { Commit } from "@atomist/skill/lib/definition/subscription/common_types";
import { Project } from "@atomist/skill/lib/project";
import { RepositoryProviderType } from "@atomist/skill/lib/repository";
import * as fs from "fs-extra";
import * as assert from "power-assert";
import * as sinon from "sinon";
import * as tmp from "tmp";

import { FormatterConfiguration } from "../lib/configuration";
import * as event from "../lib/events";

describe("on event", function () {
	let sandbox: sinon.SinonSandbox;

	beforeEach(() => {
		sandbox = sinon.createSandbox();
	});

	afterEach(() => {
		sandbox.restore();
		tmp.setGracefulCleanup();
	});

	it("only return distinct files that exist", async () => {
		const project = createFakeProject(cmdFunction);

		const commits: Pick<Commit, "sha">[] = [
			{ sha: "first-commit" },
			{ sha: "second-commit" },
		];

		sandbox
			.stub(fs, "existsSync")
			.withArgs("same.java")
			.returns(true)
			.withArgs("distinct-1.java")
			.returns(true)
			.withArgs("distinct-2.java")
			.returns(true);

		const files = await event.changedFilesFromCommits(
			project,
			commits as Commit[],
		);
		assert.deepEqual(files, [
			"same.java",
			"distinct-1.java",
			"distinct-2.java",
		]);
	});

	it("format files from commits", async () => {
		const project = createFakeProject(cmdFunction);

		const commits = [
			{ sha: "first-commit" },
			{ sha: "second-commit" },
		] as Commit[];

		sandbox
			.stub(fs, "existsSync")
			.withArgs("same.java")
			.returns(true)
			.withArgs("distinct-1.java")
			.returns(true)
			.withArgs("distinct-2.java")
			.returns(true);

		const files = await event.filesToFormat(
			project,
			{
				onlyFormatChangedFiles: true,
				ignores: ["distinct-*.java"],
			} as FormatterConfiguration,
			commits,
		);

		assert.deepEqual(files, ["same.java"]);
	});

	it("format all java files that don't match ignore pattern", async () => {
		const project = createFakeProject(cmdFunction);

		fs.closeSync(fs.openSync(`${project.path()}/distinct-blah.java`, "w"));
		fs.closeSync(fs.openSync(`${project.path()}/main.java`, "w"));
		fs.closeSync(fs.openSync(`${project.path()}/ws.java`, "w"));
		fs.closeSync(fs.openSync(`${project.path()}/main.cpp`, "w"));

		const files = await event.filesToFormat(
			project,
			{
				glob: "*.java",
				onlyFormatChangedFiles: false,
				ignores: ["distinct-*.java"],
			} as FormatterConfiguration,
			null,
		);

		assert.deepEqual(files, ["main.java", "ws.java"]);
	});

	it("format all java files with no ignore pattern", async () => {
		const project = createFakeProject(cmdFunction);

		fs.closeSync(fs.openSync(`${project.path()}/distinct-blah.java`, "w"));
		fs.closeSync(fs.openSync(`${project.path()}/main.java`, "w"));
		fs.closeSync(fs.openSync(`${project.path()}/ws.java`, "w"));
		fs.closeSync(fs.openSync(`${project.path()}/main.cpp`, "w"));

		const files = await event.filesToFormat(
			project,
			{
				glob: "*.java",
				onlyFormatChangedFiles: false,
			} as FormatterConfiguration,
			null,
		);

		assert.deepEqual(files, ["distinct-blah.java", "main.java", "ws.java"]);
	});
});

function createFakeProject(
	f: (cmd, args, opts) => { output: string[]; status: number },
): Project {
	const projectDir = tmp.dirSync();
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
		path: () => projectDir.name,
	};
}

const cmdFunction = (cmd, args) => {
	const sha = args[args.length - 1];

	let output: string[];
	if (sha === "first-commit") {
		output = ["same.java", "distinct-1.java", "doesnt-exist.java"];
	} else if (sha === "second-commit") {
		output = ["same.java", "distinct-2.java"];
	}
	return {
		status: 0,
		output,
	};
};
