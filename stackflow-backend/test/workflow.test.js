import test from "node:test";
import assert from "node:assert/strict";
import {
  progress,
  validateTransition,
  transitions,
} from "../src/lib/workflow.js";
import { dueDate } from "../src/lib/errors.js";
const owner = { id: "owner", role: "teammate" };
const lead = { id: "lead", role: "techlead" };
const milestone = { assignedTo: "lead" };
test("progress uses only verified work and actual denominator", () => {
  assert.deepEqual(progress([]), {
    taskCount: 0,
    verifiedCount: 0,
    progress: 0,
  });
  assert.equal(
    progress([
      { status: "completed" },
      { status: "verified" },
      { status: "pending" },
    ]).progress,
    33,
  );
  assert.equal(
    progress([{ status: "verified" }, { status: "verified" }]).progress,
    100,
  );
});
for (const [action, rule] of Object.entries(transitions)) {
  test(action + " permits valid states and rejects all other states", () => {
    for (const status of [
      "pending",
      "in_progress",
      "completed",
      "verified",
      "changes_requested",
    ]) {
      const check = () =>
        validateTransition(
          action,
          { status, assignedTo: "owner" },
          milestone,
          rule.owner ? owner : lead,
          "Needs correction",
        );
      if (rule.from.includes(status)) assert.equal(check().to, rule.to);
      else assert.throws(check, { status: 409 });
    }
  });
}
test("only the assignee may submit work; only the owning lead may review", () => {
  assert.throws(
    () =>
      validateTransition(
        "complete",
        { status: "pending", assignedTo: "someone" },
        milestone,
        owner,
      ),
    { status: 403 },
  );
  assert.throws(
    () =>
      validateTransition("verify", { status: "completed" }, milestone, {
        ...lead,
        id: "other",
      }),
    { status: 403 },
  );
  assert.equal(
    validateTransition("verify", { status: "completed" }, milestone, {
      role: "admin",
    }).to,
    "verified",
  );
});
test("review reasons cannot be blank", () => {
  assert.throws(
    () =>
      validateTransition(
        "reject",
        { status: "completed" },
        milestone,
        lead,
        "  ",
      ),
    { status: 400 },
  );
  assert.throws(
    () =>
      validateTransition(
        "unverify",
        { status: "verified" },
        milestone,
        lead,
        "",
      ),
    { status: 400 },
  );
});
test("due dates reject invalid calendar dates", () => {
  assert.throws(() => dueDate("2026-02-31"), { status: 400 });
  assert.throws(() => dueDate({ $gt: "" }), { status: 400 });
  assert.equal(dueDate("2026-10-23").toISOString(), "2026-10-23T23:59:59.999Z");
});
