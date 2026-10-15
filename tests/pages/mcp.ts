import { randomUUID } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  auth,
  type OAuthClientProvider,
} from "@modelcontextprotocol/sdk/client/auth.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type {
  OAuthClientInformationMixed,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";

export const MCP_URL = "https://empirical.run/mcp";
export const MCP_CALLBACK_URL = "http://127.0.0.1:19876/callback";

/** An isolated public MCP client; all credentials stay in memory for this test. */
export function createMcpClient() {
  const state = randomUUID();
  const clientName = `Empirical Playwright MCP ${randomUUID()}`;
  let clientInformation: OAuthClientInformationMixed | undefined;
  let tokens: OAuthTokens | undefined;
  let verifier = "";
  let authorizationUrl: URL | undefined;

  const provider: OAuthClientProvider = {
    redirectUrl: MCP_CALLBACK_URL,
    clientMetadata: {
      client_name: clientName,
      redirect_uris: [MCP_CALLBACK_URL],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      scope: "email profile",
    },
    state: () => state,
    clientInformation: () => clientInformation,
    saveClientInformation: (information) => {
      clientInformation = information;
    },
    tokens: () => tokens,
    saveTokens: (newTokens) => {
      tokens = newTokens;
    },
    saveCodeVerifier: (codeVerifier) => {
      verifier = codeVerifier;
    },
    codeVerifier: () => verifier,
    redirectToAuthorization: (url) => {
      authorizationUrl = url;
    },
  };
  const client = new Client({ name: "empirical-playwright", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), {
    authProvider: provider,
  });

  return {
    client,
    transport,
    state,
    clientName,
    clientId: () => clientInformation?.client_id,
    async startAuthorization() {
      // The official SDK discovers resource/issuer metadata, dynamically registers
      // a public client and generates the PKCE challenge and authorization URL.
      const result = await auth(provider, { serverUrl: MCP_URL });
      if (result !== "REDIRECT" || !authorizationUrl) {
        throw new Error(
          "A fresh MCP client must request browser authorization",
        );
      }
      return authorizationUrl;
    },
  };
}
