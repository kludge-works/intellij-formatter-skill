import { Commit } from "@atomist/skill/lib/definition/subscription/common_types";
import { Project } from "@atomist/skill/lib/project";
import { RepositoryProviderType } from "@atomist/skill/lib/repository";
import * as fs from "fs-extra";
import * as assert from "power-assert";
import * as sinon from "sinon";
import { SinonSandbox } from "sinon";
import * as tmp from "tmp";

import { FormatterConfiguration } from "../lib/configuration";
import * as event from "../lib/events";

describe("on event", function () {
	let sandbox: SinonSandbox;

	beforeEach(() => {
		sandbox = sinon.createSandbox();
	});

	afterEach(() => {
		sandbox.restore();
		tmp.setGracefulCleanup();
	});

	it("only return distinct files that exist", async () => {
		const project = createFakeProject(
			sandbox.fake(shaToFilenamesCmdFunction),
		);

		const commits: Pick<Commit, "sha">[] = [
			{ sha: "same.java,distinct-1.java,doesnt-exist.java" },
			{ sha: "same.java,distinct-2.java" },
		];

		sandbox
			.stub(fs, "existsSync")
			.withArgs(
				sinon
					.match("same.java")
					.or(sinon.match("distinct-1.java"))
					.or(sinon.match("distinct-2.java")),
			)
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
		const project = createFakeProject(
			sandbox.fake(shaToFilenamesCmdFunction),
		);

		const commits: Pick<Commit, "sha">[] = [
			{ sha: "same.java,distinct-1.java,doesnt-exist.java" },
			{ sha: "same.java,distinct-2.java" },
		];

		sandbox
			.stub(fs, "existsSync")
			.withArgs(
				sinon
					.match("same.java")
					.or(sinon.match("distinct-1.java"))
					.or(sinon.match("distinct-2.java")),
			)
			.returns(true);

		const files = await event.filesToFormat(
			project,
			{
				onlyFormatChangedFiles: true,
				ignores: ["distinct-*.java"],
			} as FormatterConfiguration,
			commits as Commit[],
		);

		assert.deepEqual(files, ["same.java"]);
	});

	it("format all java files that don't match ignore pattern", async () => {
		const project = createFakeProject(
			sandbox.fake(shaToFilenamesCmdFunction),
		);

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
		const project = createFakeProject(
			sandbox.fake(shaToFilenamesCmdFunction),
		);

		fs.closeSync(fs.openSync(`${project.path()}/distinct-blab.java`, "w"));
		fs.closeSync(fs.openSync(`${project.path()}/min.java`, "w"));
		fs.closeSync(fs.openSync(`${project.path()}/ws.java`, "w"));
		fs.closeSync(fs.openSync(`${project.path()}/min.cpp`, "w"));

		const files = await event.filesToFormat(
			project,
			{
				glob: "*.java",
				onlyFormatChangedFiles: false,
			} as FormatterConfiguration,
			null,
		);

		assert.deepEqual(files, ["distinct-blab.java", "min.java", "ws.java"]);
	});

	it("format all java files with empty ignore pattern", async () => {
		const project = createFakeProject(
			sandbox.fake(shaToFilenamesCmdFunction),
		);

		fs.closeSync(fs.openSync(`${project.path()}/distinct-blab.java`, "w"));
		fs.closeSync(fs.openSync(`${project.path()}/min.java`, "w"));
		fs.closeSync(fs.openSync(`${project.path()}/ws.java`, "w"));
		fs.closeSync(fs.openSync(`${project.path()}/min.cpp`, "w"));

		const files = await event.filesToFormat(
			project,
			{
				glob: "*.java",
				onlyFormatChangedFiles: false,
				ignores: [],
			} as FormatterConfiguration,
			null,
		);

		assert.deepEqual(files, ["distinct-blab.java", "min.java", "ws.java"]);
	});

	it("formatProject slicing", async () => {
		const fake = sandbox.fake(shaToFilenamesCmdFunction);
		const project = createFakeProject(sinon.fake(), fake);

		await event.formatProject(
			project,
			{ filesToFormatPerSlice: 2 } as FormatterConfiguration,
			["1.java", "2.java", "3.java"],
		);

		assert.ok(fake.calledTwice, "project.exec(..) should be called twice");
	});

	it("formatProject custom codestyle", async () => {
		const fake = sandbox.fake();
		const project = createFakeProject(sinon.fake(), fake);

		const writeFileSyncStub = sandbox
			.stub(fs, "writeFileSync")
			.withArgs("/atm/home/codestyle.xml", "<codeFormatting/>");

		await event.formatProject(
			project,
			{
				filesToFormatPerSlice: 2,
				codestyle: "<codeFormatting/>",
			} as FormatterConfiguration,
			["1.java"],
		);

		assert.ok(writeFileSyncStub.calledOnce);
		assert.ok(fake.calledOnce);
		assert.deepEqual(fake.args, [
			[
				"/opt/intellij/bin/format.sh",
				["-s", "/atm/home/codestyle.xml", "1.java"],
				{
					level: "info",
				},
			],
		]);
	});

	it("formatProject default codestyle", async () => {
		const fake = sandbox.fake();
		const project = createFakeProject(sinon.fake(), fake);

		const writeFileSyncStub = sandbox
			.stub(fs, "writeFileSync")
			.withArgs("/atm/home/codestyle.xml", "<codeFormatting/>");

		await event.formatProject(
			project,
			{ filesToFormatPerSlice: 2 } as FormatterConfiguration,
			["1.java"],
		);

		assert.ok(writeFileSyncStub.notCalled);
		assert.ok(fake.calledOnce);
		assert.deepEqual(fake.args, [
			[
				"/opt/intellij/bin/format.sh",
				["1.java"],
				{
					level: "info",
				},
			],
		]);
	});

	function createFakeProject(
		exec: sinon.SinonSpy,
		spawn = sandbox.fake(),
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
			exec,
			spawn,
			path: () => projectDir.name,
		};
	}
});

const shaToFilenamesCmdFunction = (cmd, args) => {
	return {
		status: 0,
		stdout: args[args.length - 1].split(",").join("\n"),
	};
};
