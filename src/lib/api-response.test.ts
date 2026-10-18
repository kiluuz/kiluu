import assert from "node:assert/strict";
import { test } from "node:test";
import { readApiJson } from "@/lib/api-response";

test("readApiJson reports an empty server response with its status", async () => {
  await assert.rejects(
    readApiJson(new Response("", { status: 500 })),
    { message: "Server returned an empty response (HTTP 500)" },
  );
});

test("readApiJson reports a non-JSON server response with its status", async () => {
  await assert.rejects(
    readApiJson(new Response("<html>error</html>", { status: 500 })),
    { message: "Server returned an invalid response (HTTP 500)" },
  );
});

test("readApiJson returns a JSON object", async () => {
  assert.deepEqual(
    await readApiJson(Response.json({ imageUrl: "/images/test.jpg" })),
    { imageUrl: "/images/test.jpg" },
  );
});
