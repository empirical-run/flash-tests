import { Page } from '@playwright/test';
import { createServer, Server } from 'http';
import { URL } from 'url';
import detect from 'detect-port';

export class CliAuthPage {
  private mockServer: Server | null = null;
  private receivedCallback: { code?: string; state?: string; error?: string } | null = null;
  private callbackPromise: Promise<any> | null = null;
  private callbackResolve: ((value: any) => void) | null = null;
  private serverPort: number | null = null;

  constructor(private page: Page) {}

  /**
   * Starts a mock CLI callback server on a dynamically available port
   */
  async startMockCliServer(): Promise<void> {
    // Find an available port starting from 8080
    const availablePort = await detect(8080);
    this.serverPort = availablePort;

    return new Promise((resolve, reject) => {
      this.mockServer = createServer((req, res) => {
        const url = new URL(req.url!, `http://${req.headers.host}`);
        
        if (url.pathname === '/callback') {
          // Extract query parameters from the callback
          const code = url.searchParams.get('code');
          const state = url.searchParams.get('state');
          const error = url.searchParams.get('error');
          
          this.receivedCallback = { code, state, error };
          
          // Respond to the callback
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body>
                <h1>CLI Authentication Callback Received</h1>
                <p>Code: ${code || 'Not provided'}</p>
                <p>State: ${state || 'Not provided'}</p>
                <p>Error: ${error || 'None'}</p>
              </body>
            </html>
          `);
          
          // Resolve the callback promise if waiting
          if (this.callbackResolve) {
            this.callbackResolve(this.receivedCallback);
            this.callbackResolve = null;
            this.callbackPromise = null;
          }
        } else {
          res.writeHead(404);
          res.end('Not found');
        }
      });

      this.mockServer.listen(availablePort, 'localhost', () => {
        console.log(`Mock CLI server started on http://localhost:${availablePort}`);
        resolve();
      });

      this.mockServer.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Gets the CLI auth URL with the callback redirect URI using the dynamic port
   */
  getCliAuthUrl(): string {
    if (!this.serverPort) {
      throw new Error('Mock CLI server must be started first to determine the port');
    }
    const redirectUri = `http://localhost:${this.serverPort}/callback`;
    return `/auth/cli?redirect_uri=${encodeURIComponent(redirectUri)}`;
  }

  /**
   * Waits for the CLI callback to be received by the mock server
   */
  async waitForCallback(timeoutMs: number = 10000): Promise<{ code?: string; state?: string; error?: string }> {
    // If we already received a callback, return it
    if (this.receivedCallback) {
      return this.receivedCallback;
    }

    // Create a promise that resolves when the callback is received
    this.callbackPromise = new Promise((resolve) => {
      this.callbackResolve = resolve;
    });

    // Race the callback promise with a timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Callback not received within ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      return await Promise.race([this.callbackPromise, timeoutPromise]) as { code?: string; state?: string; error?: string };
    } catch (error) {
      // Clean up if timeout occurs
      this.callbackResolve = null;
      this.callbackPromise = null;
      throw error;
    }
  }

  /**
   * Gets the last received callback data
   */
  getReceivedCallback(): { code?: string; state?: string; error?: string } | null {
    return this.receivedCallback;
  }

  /**
   * Stops the mock CLI server
   */
  async stopMockCliServer(): Promise<void> {
    if (this.mockServer) {
      return new Promise((resolve) => {
        this.mockServer!.close(() => {
          console.log(`Mock CLI server stopped (was on port ${this.serverPort})`);
          this.mockServer = null;
          this.serverPort = null;
          resolve();
        });
      });
    }
  }

  /**
   * Cleans up all resources
   */
  async cleanup(): Promise<void> {
    await this.stopMockCliServer();
    this.receivedCallback = null;
    this.callbackPromise = null;
    this.callbackResolve = null;
  }
}