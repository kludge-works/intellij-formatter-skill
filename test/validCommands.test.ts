import { createContext } from "@atomist/skill/lib/context";
import { Push } from "@atomist/skill/lib/definition/subscription/typings/types";
import { Exec, Project, Spawn } from "@atomist/skill/lib/project";
import { RepositoryProviderType } from "@atomist/skill/lib/repository";
import * as fs from "fs-extra";
import * as assert from "power-assert";
import * as sinon from "sinon";

import { onPush } from "../lib/events";

const gcp = {
	GoogleCloudPlatformProvider: [
		{
			credential: {
				secret: "just text",
			},
			name: "MattsTestGCPProject (Non-Atomist)",
		},
	],
};

describe("on event", function () {
	let sandbox: sinon.SinonSandbox;

	before(() => {
		sandbox = sinon.createSandbox();
		process.env.STORAGE = "iamfake";
	});

	after(() => {
		delete process.env.STORAGE;
		sandbox.reset();
		sandbox.restore();
	});

	it.skip("early return on atomist/ branch", async () => {
		const push: Push = JSON.parse(
			fs.readFileSync("test/data/pushHandlerTest.json").toString(),
		);
		const context = createFakeContext(push, gcp);

		const result = await onPush(context);

		assert(result, "No response from handler!");
	});
});

function createFakeContext(push: any, gqlResponse?: any): any {
	const context = createContext(push, {} as any);
	const graphClient = sinon.stub();
	if (gqlResponse) {
		graphClient.returns(gqlResponse);
	}
	const message = sinon.fake();

	sinon.replace(context.graphql, "query", graphClient);
	sinon.replace(context.message, "send", message);
	sinon.replace(
		context,
		"project",
		createFakeProjectLoader(
			sinon.fake.returns({ status: 0 }),
			sinon.fake.returns({ status: 0 }),
		),
	);
	sinon.stub(context.credential, "resolve").returns("some fake credential");

	return context;
}

function createFakeProjectLoader(spawn: Spawn, exec: Exec): any {
	return {
		name: "load project",
		clone: async (ctx: any, params: { project: Project }) => {
			return createFakeProject(spawn, exec);
		},
		run: async (ctx: any, params: { project: Project }) => {
			params.project = createFakeProject(spawn, exec);
			params.project.spawn = spawn;
			params.project.exec = exec;
			return {
				code: 0,
			};
		},
	};
}

function createFakeProject(spawn: Spawn, exec: Exec): Project {
	return {
		id: {
			credential: "fake",
			cloneUrl: () => "https://fake.project.host.com/fake/project",
			owner: "dummyOwner",
			repo: "dummyRepo",
			sha: "9e48f944bf1aaf41feeea003aa1c96a92cec0c4f",
			type: RepositoryProviderType.GitHubCom,
		},
		spawn,
		exec,
		path: () => "/fake/project/path",
	};
}
