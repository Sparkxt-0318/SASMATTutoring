import { test } from "node:test";
import assert from "node:assert/strict";
import { csvCell, csvRow } from "./csv";

test("spreadsheet formulas are defused", () => {
  assert.equal(csvCell("=1+1"), "'=1+1");
  assert.equal(csvCell("+1"), "'+1");
  assert.equal(csvCell("-1"), "'-1");
  assert.equal(csvCell("@SUM(A1)"), "'@SUM(A1)");
  assert.equal(csvCell('=HYPERLINK("http://x","y")'), `"'=HYPERLINK(""http://x"",""y"")"`);
});

test("commas, quotes and line breaks are quoted; plain values are not", () => {
  assert.equal(csvCell("Doe, Jane"), '"Doe, Jane"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell("line1\nline2"), '"line1\nline2"');
  assert.equal(csvCell("Jane Doe"), "Jane Doe");
  assert.equal(csvRow(["a", 2, null, undefined]), "a,2,,");
});
