import type { Request } from "@playwright/test";
import {
  mcpFixtures,
  type McpSession,
} from "@empiricalrun/playwright-utils/mcp";
import { test as base, expect } from "../lib/fixtures";
import { MCP_URL } from "../pages/mcp";
import { isPreviewEnvironment } from "../pages/urls";

// mcpFixtures closes every MCP client after the test; this fixture adds the
// revocation of the OAuth grant the browser authorization creates.
const test = base.extend(mcpFixtures).extend<{ mcpSession: McpSession }>({
  mcpSession: async ({ page, mcp }, use) => {
    const mcpSession = mcp({ url: MCP_URL });
    let userRequest: Request | undefined;
    const captureUserRequest = (request: Request) => {
      if (new URL(request.url()).pathname === "/auth/v1/user") {
        userRequest = request;
      }
    };
    page.on("request", captureUserRequest);
    await use(mcpSession);
    page.off("request", captureUserRequest);

    // Revoke only this client's grant and refresh tokens, never other clients or
    // the dashboard login. DCR client metadata itself is retained by Supabase;
    // deleting a registration requires admin credentials, unavailable to clients.
    // A skipped test or a failure before registration cannot have a user grant.
    const clientId = mcpSession.clientId;
    if (clientId) {
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
        params: { client_id: clientId },
      });
      expect(revoke.ok()).toBeTruthy();
      const grants = await page.request.get(grantsUrl, { headers });
      expect(grants.ok()).toBeTruthy();
      expect(JSON.stringify(await grants.json())).not.toContain(clientId);
    }
  },
});

test("logged-in user authorizes an MCP client and calls the API as themselves", async ({
  page,
  mcpSession,
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

  await test.step("Existing dashboard login authorizes a real MCP client through consent", async () => {
    // playwright-utils discovers the server metadata, dynamically registers a
    // public client, runs PKCE against a loopback callback, checks the callback
    // state and exchanges the code. Authorization, consent, token exchange and
    // every MCP/API request go to the real services.
    const client = await mcpSession.connect({
      browser: {
        page,
        scope: "email profile",
        consent: async (page, { authorizationUrl, clientName }) => {
          expect(
            authorizationUrl.searchParams.get("code_challenge_method"),
          ).toBe("S256");
          expect(authorizationUrl.searchParams.get("state")).toBeTruthy();
          await expect(page).toHaveURL(
            /^https:\/\/empirical\.run\/oauth\/consent\?authorization_id=.+/,
          );
          await expect(
            page.getByText(clientName, { exact: true }),
          ).toBeVisible();
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
          await page
            .getByRole("button", { name: "Authorize", exact: true })
            .click();
        },
      },
    });
    await expect(
      page.getByRole("heading", { name: "MCP client callback received" }),
    ).toBeVisible();
    expect(mcpSession.clientId).toBeTruthy();
    expect(client.getServerVersion()).toMatchObject({ name: "empirical" });
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining(["search_api", "describe_api", "call_api"]),
    );
  });

  await test.step("An authenticated tool call identifies the original logged-in user", async () => {
    expect(process.env.AUTOMATED_USER_EMAIL).toBeTruthy();
    const result = await mcpSession.client.callTool({
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
