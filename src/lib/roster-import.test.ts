import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRoster } from "./roster-import";

const one = (text: string) => {
  const { entries, rejected } = parseRoster(text);
  assert.deepEqual(rejected, []);
  assert.equal(entries.length, 1);
  return entries[0];
};

test("quoted CSV names keep their comma (#19)", () => {
  assert.equal(one('"Doe, Jane",jane@example.com').name, "Doe, Jane");
  assert.equal(one('jane@example.com, "Doe, Jane"').name, "Doe, Jane");
  assert.equal(one('"O""Neil, Pat";pat@example.com').name, 'O"Neil, Pat');
});

test("partial or malformed addresses are rejected with their line, never rewritten (#19)", () => {
  const { entries, rejected } = parseRoster(
    "Name,Email\nJane Doe,jane!tag@example.com\nJane Doe,jane@example.com.invalid123\nOk Person,ok@example.com",
  );
  assert.deepEqual(
    entries.map((e) => e.email),
    ["ok@example.com"],
  );
  assert.deepEqual(
    rejected.map((r) => [r.line, r.text]),
    [
      [2, "Jane Doe,jane!tag@example.com"],
      [3, "Jane Doe,jane@example.com.invalid123"],
    ],
  );
  assert.match(rejected[0].reason, /jane!tag@example\.com/);
});

test("a line with a good address and a bad one is rejected whole", () => {
  const { entries, rejected } = parseRoster("Jane,jane@example.com,see @lunch");
  assert.equal(entries.length, 0);
  assert.equal(rejected.length, 1);
});

test("attendance sheet rows: name and email in separate columns or one cell", () => {
  const { entries, rejected } = parseRoster(
    [
      "Name\tEmail\t9/1\t9/8",
      "Jane Doe\tJane01@Saschina.org\tTRUE\tFALSE",
      '"Sam Lee\tsam02@saschina.org",TRUE,TRUE',
      "12,Kim Park,kim03@saschina.org,P,A",
    ].join("\n"),
  );
  assert.deepEqual(rejected, []);
  assert.deepEqual(
    entries.map((e) => [e.name, e.email, e.nameGiven]),
    [
      ["Jane Doe", "jane01@saschina.org", true],
      ["Sam Lee", "sam02@saschina.org", true],
      ["Kim Park", "kim03@saschina.org", true],
    ],
  );
});

test('"Name <email>", mailto and email-first rows', () => {
  assert.deepEqual(one("Jane Doe <jane@example.com>"), {
    name: "Jane Doe",
    email: "jane@example.com",
    nameGiven: true,
    inactive: false,
  });
  assert.equal(one("Jane Doe<jane@example.com>").name, "Jane Doe");
  assert.equal(one("Jane Doe, mailto:jane@example.com").email, "jane@example.com");
  assert.equal(one("jane@example.com, Jane Doe").name, "Jane Doe");
  // Attendance values after an email-first row are not names.
  assert.equal(one("jane@example.com, TRUE, FALSE").nameGiven, false);
});

test("bare email lists fall back to the local part as the name", () => {
  const { entries } = parseRoster("a@example.com, b@example.com\nc@example.com d@example.com\n");
  assert.deepEqual(
    entries.map((e) => [e.name, e.email, e.nameGiven]),
    [
      ["a", "a@example.com", false],
      ["b", "b@example.com", false],
      ["c", "c@example.com", false],
      ["d", "d@example.com", false],
    ],
  );
});

test("members backup CSV keeps the Inactive flag; headers, notes and BOM are ignored", () => {
  const { entries, rejected } = parseRoster(
    '\uFEFFName,Email,Status,Joined\nJane Doe,jane@example.com,Active,"Oct 3, 2026"\nOld Member,old@example.com,inactive,"Sep 1, 2025"\n\nNotes: updated weekly\n',
  );
  assert.deepEqual(rejected, []);
  assert.deepEqual(
    entries.map((e) => [e.name, e.inactive]),
    [
      ["Jane Doe", false],
      ["Old Member", true],
    ],
  );
});

test("first occurrence of a duplicate wins; names are cleaned and capped", () => {
  const { entries, rejected } = parseRoster(
    `First   Name,dup@example.com\nSecond,DUP@example.com\n${"x".repeat(150)},long@example.com`,
  );
  assert.deepEqual(rejected, []);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].name, "First Name");
  assert.equal(entries[1].name.length, 100);
});
