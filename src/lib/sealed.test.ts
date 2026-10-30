import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { open, openJson, seal, sealJson, sealingReady } from "./sealed";

const KEY = randomBytes(32).toString("base64");

describe("sealed config", () => {
  test("refuses to seal without a key", () => {
    const previous = process.env.DONATIONALERTS_TOKEN_KEY;
    delete process.env.DONATIONALERTS_TOKEN_KEY;
    try {
      assert.equal(sealingReady(), false);
      assert.throws(() => seal("secret"), /DONATIONALERTS_TOKEN_KEY/);
    } finally {
      if (previous === undefined) delete process.env.DONATIONALERTS_TOKEN_KEY;
      else process.env.DONATIONALERTS_TOKEN_KEY = previous;
    }
  });

  test("rejects keys of the wrong length", () => {
    const previous = process.env.DONATIONALERTS_TOKEN_KEY;
    process.env.DONATIONALERTS_TOKEN_KEY = Buffer.alloc(16).toString("base64");
    try {
      assert.equal(sealingReady(), false);
    } finally {
      if (previous === undefined) delete process.env.DONATIONALERTS_TOKEN_KEY;
      else process.env.DONATIONALERTS_TOKEN_KEY = previous;
    }
  });

  test("round-trips text and JSON with a 32-byte key", () => {
    const previous = process.env.DONATIONALERTS_TOKEN_KEY;
    process.env.DONATIONALERTS_TOKEN_KEY = KEY;
    try {
      const sealed = seal("access-token");
      assert.match(sealed, /^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
      assert.notEqual(sealed, seal("access-token"));
      assert.equal(open(sealed), "access-token");

      const sealedJson = sealJson({ refreshToken: "abc", expiresAt: 1 });
      assert.deepEqual(openJson(sealedJson), { refreshToken: "abc", expiresAt: 1 });
    } finally {
      if (previous === undefined) delete process.env.DONATIONALERTS_TOKEN_KEY;
      else process.env.DONATIONALERTS_TOKEN_KEY = previous;
    }
  });

  test("detects tampering and rejects malformed payloads", () => {
    const previous = process.env.DONATIONALERTS_TOKEN_KEY;
    process.env.DONATIONALERTS_TOKEN_KEY = KEY;
    try {
      const sealed = seal("access-token");
      const parts = sealed.split(".");
      const tampered = [parts[0], parts[1], parts[2], Buffer.from("evil").toString("base64url")].join(".");
      assert.throws(() => open(tampered));
      assert.throws(() => open("v2.a.b.c"), /Unsupported/);
      assert.throws(() => open("nope"), /Unsupported/);

      process.env.DONATIONALERTS_TOKEN_KEY = randomBytes(32).toString("hex");
      assert.throws(() => open(sealed));
    } finally {
      if (previous === undefined) delete process.env.DONATIONALERTS_TOKEN_KEY;
      else process.env.DONATIONALERTS_TOKEN_KEY = previous;
    }
  });
});
