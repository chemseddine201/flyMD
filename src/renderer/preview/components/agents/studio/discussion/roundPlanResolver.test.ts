import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// @ts-ignore TS5097 allow extension for Node 22 native type-stripping test runner
import { resolveRoundPlan } from './roundPlanResolver.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Expectation {
  round: number;
  expectedTitle: string;
  expectedObjective: string | null;
  expectedSlotAgentIds: string[];
  expectedDirectives: (string | null)[];
}

interface TestCase {
  scenario: string;
  config: any;
  expectations: Expectation[];
}

test('roundPlanResolver parity with Rust resolve_round_plan across shared fixture cases', () => {
  const fixturePath = path.resolve(
    __dirname,
    '../../../../../../../src-tauri/src/discussion/fixtures/round_plan_cases.json'
  );
  assert.ok(fs.existsSync(fixturePath), `Fixture must exist at ${fixturePath}`);

  const raw = fs.readFileSync(fixturePath, 'utf8');
  const testCases: TestCase[] = JSON.parse(raw);

  for (const tc of testCases) {
    for (const exp of tc.expectations) {
      const resolved = resolveRoundPlan(tc.config, exp.round);

      assert.equal(
        resolved.title,
        exp.expectedTitle,
        `Scenario ${tc.scenario} round ${exp.round} title mismatch`
      );

      assert.equal(
        resolved.objective ?? null,
        exp.expectedObjective,
        `Scenario ${tc.scenario} round ${exp.round} objective mismatch`
      );

      const agentIds = resolved.slots.map((s) => s.participant.agentId);
      assert.deepEqual(
        agentIds,
        exp.expectedSlotAgentIds,
        `Scenario ${tc.scenario} round ${exp.round} agent IDs mismatch`
      );

      const directives = resolved.slots.map((s) => s.roundDirective || null);
      assert.deepEqual(
        directives,
        exp.expectedDirectives,
        `Scenario ${tc.scenario} round ${exp.round} directives mismatch`
      );
    }
  }
});
