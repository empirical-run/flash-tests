import { Page } from '@playwright/test';
import { createServer, Server } from 'http';
import { URL } from 'url';
import detect from 'detect-port';

/**
 * State for managing CLI authentication mock server
 */
export interface CliAuthServerState {
  mockServer: Server | null;
  receivedCallback: { code?: string; state?: string; error?: string } | null;
  callbackPromise: Promise<any> | null;
  callbackResolve: ((value: any) => void) | null;
  serverPort: number | null;
}

/**
 * Creates a new CLI auth server state
 */
export function createCliAuthState(): CliAuthServerState {
  return {
    mockServer: null,
    receivedCallback: null,
    callbackPromise: null,
    callbackResolve: null,
    serverPort: null,
  };
}

/**
 * Starts a mock CLI callback server on an available port
 */
export async function startMockCliServer(state: CliAuthServerState): Promise<void> {
  // Find an available port starting from 8080
  const availablePort = await detect(8080);
  state.serverPort = availablePort;

  return new Promise((resolve, reject) => {
    state.mockServer = createServer((req, res) => {
      const url = new URL(req.url!, `http://${req.headers.host}`);
      
      if (url.pathname === '/callback') {
        // Extract query parameters from the callback
        const code = url.searchParams.get('code');
        const stateParam = url.searchParams.get('state');
        const error = url.searchParams.get('error');
        
        state.receivedCallback = { code, state: stateParam, error };
        
        // Respond to the callback
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <body>
              <h1>CLI Authentication Callback Received</h1>
              <p>Code: ${code || 'Not provided'}</p>
              <p>State: ${stateParam || 'Not provided'}</p>
              <p>Error: ${error || 'None'}</p>
            </body>
          </html>
        `);
        
        // Resolve the callback promise if waiting
        if (state.callbackResolve) {
          state.callbackResolve(state.receivedCallback);
          state.callbackResolve = null;
          state.callbackPromise = null;
        }
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    state.mockServer.listen(availablePort, 'localhost', () => {
      console.log(`Mock CLI server started on http://localhost:${availablePort}`);
      resolve();
    });

    state.mockServer.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Gets the CLI auth URL with the callback redirect URI using the dynamic port
 */
export function getCliAuthUrl(state: CliAuthServerState): string {
  if (!state.serverPort) {
    throw new Error('Mock server must be started before getting CLI auth URL');
  }
  const redirectUri = `http://localhost:${state.serverPort}/callback`;
  return `/auth/cli?redirect_uri=${encodeURIComponent(redirectUri)}`;
}

/**
 * Waits for the CLI callback to be received by the mock server
 */
export async function waitForCallback(
  state: CliAuthServerState,
  timeoutMs: number = 10000
): Promise<{ code?: string; state?: string; error?: string }> {
  // If we already received a callback, return it
  if (state.receivedCallback) {
    return state.receivedCallback;
  }

  // Create a promise that resolves when the callback is received
  state.callbackPromise = new Promise((resolve) => {
    state.callbackResolve = resolve;
  });

  // Race the callback promise with a timeout
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Callback not received within ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([state.callbackPromise, timeoutPromise]) as { code?: string; state?: string; error?: string };
  } catch (error) {
    // Clean up if timeout occurs
    state.callbackResolve = null;
    state.callbackPromise = null;
    throw error;
  }
}

/**
 * Gets the last received callback data
 */
export function getReceivedCallback(state: CliAuthServerState): { code?: string; state?: string; error?: string } | null {
  return state.receivedCallback;
}

/**
 * Stops the mock CLI server
 */
export async function stopMockCliServer(state: CliAuthServerState): Promise<void> {
  if (state.mockServer) {
    return new Promise((resolve) => {
      state.mockServer!.close(() => {
        console.log(`Mock CLI server stopped (was on port ${state.serverPort})`);
        state.mockServer = null;
        state.serverPort = null;
        resolve();
      });
    });
  }
}

/**
 * Cleans up all resources
 */
export async function cleanupCliAuth(state: CliAuthServerState): Promise<void> {
  await stopMockCliServer(state);
  state.receivedCallback = null;
  state.callbackPromise = null;
  state.callbackResolve = null;
  state.serverPort = null;
}