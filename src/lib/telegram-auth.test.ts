import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac } from "crypto";
import { verifyTelegramLoginWidget, verifyTelegramInitData } from "./telegram-auth";

const TOKEN = "123456:ABC-TEST-TOKEN";

function widgetHash(fields: Record<string, string>, token = TOKEN) {
  const secret = createHash("sha256").update(token).digest();
  const check = Object.keys(fields)
    .filter((k) => k !== "hash")
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join("\n");
  return createHmac("sha256", secret).update(check).digest("hex");
}

describe("telegram HMAC", () => {
  test("login widget accepts valid hash", () => {
    const now = String(Math.floor(Date.now() / 1000));
    const fields: Record<string, string> = { id: "42", first_name: "Ada", auth_date: now };
    fields.hash = widgetHash(fields);
    assert.equal(verifyTelegramLoginWidget(fields, TOKEN), true);
  });

  test("login widget rejects tampered hash", () => {
    const now = String(Math.floor(Date.now() / 1000));
    const fields: Record<string, string> = { id: "42", auth_date: now, hash: "00".repeat(32) };
    assert.equal(verifyTelegramLoginWidget(fields, TOKEN), false);
  });

  test("login widget rejects stale auth_date", () => {
    const fields: Record<string, string> = { id: "1", auth_date: "1000" };
    fields.hash = widgetHash(fields);
    assert.equal(verifyTelegramLoginWidget(fields, TOKEN), false);
  });

  test("initData WebAppData secret", () => {
    const now = String(Math.floor(Date.now() / 1000));
    const user = JSON.stringify({ id: 7, username: "ada" });
    const fields: Record<string, string> = { auth_date: now, user };
    const check = Object.keys(fields)
      .sort()
      .map((k) => `${k}=${fields[k]}`)
      .join("\n");
    const secret = createHmac("sha256", "WebAppData").update(TOKEN).digest();
    const hash = createHmac("sha256", secret).update(check).digest("hex");
    const init = `auth_date=${now}&user=${encodeURIComponent(user)}&hash=${hash}`;
    assert.equal(verifyTelegramInitData(init, TOKEN), true);
  });
});
