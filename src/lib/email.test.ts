import { test } from "node:test";
import assert from "node:assert/strict";
import { htmlToText } from "./email";

test("links keep their address; a link showing its own address is written once", () => {
  assert.equal(
    htmlToText('<p>Claim it: <a href="https://site.app/claim/abc">Claim session</a></p>'),
    "Claim it: Claim session: https://site.app/claim/abc",
  );
  assert.equal(htmlToText('<a href="https://site.app/member">site.app/member</a>'), "https://site.app/member");
});

test("mailto links show their text only", () => {
  assert.equal(htmlToText('Email <a href="mailto:club@example.com">the officers</a>.'), "Email the officers.");
});

test("entities are decoded and block tags become line breaks", () => {
  assert.equal(
    htmlToText("<head><title>x</title></head><h1>Hi&nbsp;there</h1><p>Tom&rsquo;s &quot;A&amp;B&quot; &lt;3</p>line<br/>two"),
    "Hi there\nTom's \"A&B\" <3\nline\ntwo",
  );
});
