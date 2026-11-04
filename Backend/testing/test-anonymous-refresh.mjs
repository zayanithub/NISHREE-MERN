import test from "node:test";
import assert from "node:assert/strict";
import app from "../app.js";

test("customer and admin refresh endpoints treat missing cookies as anonymous sessions", async (t) => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  t.after(
    () =>
      new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      })
  );

  const { port } = server.address();
  for (const route of ["/api/v1/auth/refresh", "/api/v1/admin/auth/refresh"]) {
    const response = await fetch(`http://127.0.0.1:${port}${route}`, {
      method: "POST",
    });

    assert.equal(response.status, 204, `${route} should return no session`);
    assert.equal(await response.text(), "");
  }
});
