import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEmailList } from "./email-list";

test("decorated setting values are cleaned up to plain addresses", () => {
  assert.deepEqual(parseEmailList('"Officer@Example.com"'), ["officer@example.com"]);
  assert.deepEqual(parseEmailList("<a@example.com>, 'b@example.com',"), ["a@example.com", "b@example.com"]);
  assert.deepEqual(parseEmailList("a@example.com.\nb@example.com;\r\n  c@example.com  "), [
    "a@example.com",
    "b@example.com",
    "c@example.com",
  ]);
});

test("duplicates and invalid entries are dropped", () => {
  assert.deepEqual(parseEmailList("a@example.com, A@EXAMPLE.COM, not-an-email, x@nodot, @example.com"), [
    "a@example.com",
  ]);
  assert.deepEqual(parseEmailList(undefined), []);
  assert.deepEqual(parseEmailList(""), []);
});
