import { Page } from '@playwright/test';
import { createServer, Server } from 'http';
import { URL } from 'url';

export class CliAuthPage {
  private mockServer: Server | null = null;
  private receivedCallback: { code?: string; state?: string; error?: string } | null = null;
  private callbackPromise: Promise<any> | null = null;
  private callbackResolve: ((value: any) => void) | null = null;

  constructor(private page: Page) {}

  /**
   * Starts a mock CLI callback server on localhost:8080
   */
  async startMockCliServer(): Promise<void> {
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

      this.mockServer.listen(8080, 'localhost', () => {
        console.log('Mock CLI server started on http://localhost:8080');
        resolve();
      });

      this.mockServer.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Navigates to the CLI auth page with the callback redirect URI
   */
  async navigateToCliAuth(): Promise<void> {
    const redirectUri = 'http://localhost:8080/callback';
    await this.page.goto(`/auth/cli?redirect_uri=${encodeURIComponent(redirectUri)}`);
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
          console.log('Mock CLI server stopped');
          this.mockServer = null;
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