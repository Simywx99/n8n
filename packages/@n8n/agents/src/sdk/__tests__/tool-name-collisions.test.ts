import { z } from 'zod';

import {
	createDelegateSubAgentTool,
	DELEGATE_SUB_AGENT_TOOL_NAME,
} from '../../runtime/tools/delegate-sub-agent-tool';
import { isSdkOwnedBuiltInTool } from '../../runtime/tools/sdk-owned-tool';
import { createWriteTodosTool, WRITE_TODOS_TOOL_NAME } from '../../runtime/tools/write-todos-tool';
import { Agent } from '../agent';
import { Tool } from '../tool';

function makeCustomTool(name: string) {
	return new Tool(name)
		.description('Custom tool')
		.input(z.object({}))
		.handler(async () => await Promise.resolve({ ok: true }))
		.build();
}

function makeAgent() {
	return new Agent('parent').model('openai', 'gpt-4o-mini').instructions('Test agent.');
}

describe('SDK reserved built-in tool names', () => {
	it.each([DELEGATE_SUB_AGENT_TOOL_NAME, WRITE_TODOS_TOOL_NAME])(
		'rejects a custom static tool named %s',
		(toolName) => {
			expect(() => makeAgent().tool(makeCustomTool(toolName))).toThrow(
				`Tool name "${toolName}" is reserved for SDK built-in tools`,
			);
		},
	);

	it.each([DELEGATE_SUB_AGENT_TOOL_NAME, WRITE_TODOS_TOOL_NAME])(
		'rejects a deferred tool named %s',
		(toolName) => {
			expect(() => makeAgent().deferredTool(makeCustomTool(toolName))).toThrow(
				`Tool name "${toolName}" is reserved for SDK built-in tools`,
			);
		},
	);

	it.each([DELEGATE_SUB_AGENT_TOOL_NAME, WRITE_TODOS_TOOL_NAME])(
		'rejects a custom tool with a legacy name of %s',
		(toolName) => {
			const tool = new Tool('custom')
				.description('Custom tool')
				.legacyNames(toolName)
				.input(z.object({}))
				.handler(async () => await Promise.resolve({ ok: true }))
				.build();

			expect(() => makeAgent().tool(tool)).toThrow(
				`Tool name "${toolName}" is reserved for SDK built-in tools`,
			);
		},
	);

	it('rejects a static tool whose legacy name collides with another tool name', () => {
		const first = makeCustomTool('first');
		const second = new Tool('second')
			.description('Custom tool')
			.legacyNames('first')
			.input(z.object({}))
			.handler(async () => await Promise.resolve({ ok: true }))
			.build();

		expect(() => makeAgent().tool([first, second])).toThrow(
			'Static tool name collision — the following tool names resolve to duplicates: first',
		);
	});

	it('allows official SDK built-in tools to be registered', () => {
		const agent = makeAgent().tool(createDelegateSubAgentTool()).tool(createWriteTodosTool());

		expect(agent.declaredTools.map((tool) => tool.name)).toEqual([
			DELEGATE_SUB_AGENT_TOOL_NAME,
			WRITE_TODOS_TOOL_NAME,
		]);
		expect(agent.declaredTools.every((tool) => isSdkOwnedBuiltInTool(tool))).toBe(true);
	});

	it('allows a delegate tool renamed to a non-reserved name', () => {
		const agent = makeAgent().tool(createDelegateSubAgentTool({ name: 'agent' }));

		expect(agent.declaredTools.map((tool) => tool.name)).toEqual(['agent']);
	});

	it('rejects a delegate tool renamed to another reserved built-in name', () => {
		expect(() =>
			makeAgent().tool(createDelegateSubAgentTool({ name: WRITE_TODOS_TOOL_NAME })),
		).toThrow(`Tool name "${WRITE_TODOS_TOOL_NAME}" is reserved for SDK built-in tools`);
	});
});
