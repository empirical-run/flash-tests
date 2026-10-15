import type { Request } from "@playwright/test";
import { test as base, expect } from "./fixtures";
import { createMcpClient, MCP_CALLBACK_URL, MCP_URL } from "./pages/mcp";
import { isPreviewEnvironment } from "./pages/urls";

const test = base.extend<{ mcp: ReturnType<typeof createMcpClient> }>({
  mcp: async ({ page }, use) => {
    const mcp = createMcpClient();
    let userRequest: Request | undefined;
    const captureUserRequest = (request: Request) => {
      if (new URL(request.url()).pathname === "/auth/v1/user") {
        userRequest = request;
      }
    };
    page.on("request", captureUserRequest);
    await use(mcp);
    await mcp.client.close();
    page.off("request", captureUserRequest);

    // Revoke only this client's grant and refresh tokens, never other clients or
    // the dashboard login. DCR client metadata itself is retained by Supabase;
    // deleting a registration requires admin credentials, unavailable to clients.
    // A skipped test or a failure before registration cannot have a user grant.
    if (mcp.clientId()) {
      expect(
        userRequest,
        "Consent must load the signed-in Supabase user",
      ).toBeDefined();
      const requestHeaders = await userRequest!.allHeaders();
      const headers = {
        apikey: requestHeaders.apikey,
        Authorization: requestHeaders.authorization,
      };
      const grantsUrl = `${userRequest!.url()}/oauth/grants`;
      const revoke = await page.request.delete(grantsUrl, {
        headers,
        params: { client_id: mcp.clientId()! },
      });
      expect(revoke.ok()).toBeTruthy();
      const grants = await page.request.get(grantsUrl, { headers });
      expect(grants.ok()).toBeTruthy();
      expect(JSON.stringify(await grants.json())).not.toContain(mcp.clientId());
    }
  },
});

test("logged-in user authorizes an MCP client and calls the API as themselves", async ({
  page,
  mcp,
}, testInfo) => {
  test.skip(
    isPreviewEnvironment(),
    "The public empirical.run/mcp endpoint and its consent flow use production auth",
  );

  await test.step("MCP requires a bearer token, even for a signed-in browser", async () => {
    // The APIRequestContext carries the logged-in browser's cookies, but no MCP
    // bearer token: the dashboard session alone must not authorize MCP requests.
    const response = await page.request.get(MCP_URL);
    expect(response.status()).toBe(401);
    expect(response.headers()["www-authenticate"]).toContain(
      'resource_metadata="https://empirical.run/.well-known/oauth-protected-resource/mcp"',
    );
  });

  const authorizationUrl = await mcp.startAuthorization();
  expect(authorizationUrl.searchParams.get("code_challenge_method")).toBe(
    "S256",
  );
  expect(authorizationUrl.searchParams.get("state")).toBe(mcp.state);

  // This is the MCP client's callback receiver only. Authorization, consent,
  // token exchange and every MCP/API request go to the real services.
  await page.route(`${MCP_CALLBACK_URL}?*`, async (route) => {
    await route.fulfill({
      contentType: "text/html",
      body: "<h1>MCP client callback received</h1>",
    });
  });

  await test.step("Existing dashboard login reaches consent without signing in again", async () => {
    await page.goto(authorizationUrl.href);
    await expect(page).toHaveURL(
      /^https:\/\/empirical\.run\/oauth\/consent\?authorization_id=.+/,
    );
    await expect(page.getByText(mcp.clientName, { exact: true })).toBeVisible();
    await expect(
      page.getByText("Unverified app", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("listitem").filter({ hasText: /^127\.0\.0\.1$/ }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Use Empirical as you, including your projects, test runs and sessions",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Deny", exact: true }),
    ).toBeVisible();
    const consentScreenshot = testInfo.outputPath("mcp-consent.png");
    await page.screenshot({ path: consentScreenshot });
    await testInfo.attach("MCP consent for the signed-in user", {
      path: consentScreenshot,
      contentType: "image/png",
    });
    await page.getByRole("button", { name: "Authorize", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "MCP client callback received" }),
    ).toBeVisible();
  });

  await test.step("Exchange the state-bound code using PKCE and connect a real MCP client", async () => {
    const callback = new URL(page.url());
    expect(`${callback.origin}${callback.pathname}`).toBe(MCP_CALLBACK_URL);
    expect(callback.searchParams.get("state")).toBe(mcp.state);
    expect(callback.searchParams.has("error")).toBe(false);
    const code = callback.searchParams.get("code");
    expect(code).toBeTruthy();
    await mcp.transport.finishAuth(code!);
    await mcp.client.connect(mcp.transport);
    expect(mcp.client.getServerVersion()).toMatchObject({ name: "empirical" });
    const { tools } = await mcp.client.listTools();
    expect(tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining(["search_api", "describe_api", "call_api"]),
    );
  });

  await test.step("An authenticated tool call identifies the original logged-in user", async () => {
    expect(process.env.AUTOMATED_USER_EMAIL).toBeTruthy();
    const result = await mcp.client.callTool({
      name: "call_api",
      arguments: { method: "GET", path: "/api/users/me" },
    });
    expect(result.isError).toBe(false);
    expect(result.content).toEqual([
      {
        type: "text",
        text: expect.stringContaining("HTTP 200 (application/json)"),
      },
    ]);
    const content = result.content as { type: "text"; text: string }[];
    const user = JSON.parse(
      content[0].text.slice(content[0].text.indexOf("\n") + 1),
    );
    expect(user.data.email).toBe(process.env.AUTOMATED_USER_EMAIL);
  });
});
