import { Page } from '@playwright/test';

export type OS = 'mac' | 'windows' | 'linux' | 'unknown';
export type ShortcutAction = 'send' | 'queue' | 'stop' | 'stopAndSend' | 'clearQueue';

/** Browser-side OS detection (runs in the page) */
export async function detectOSBrowser(page: Page): Promise<OS> {
  return page.evaluate<OS>(() => {
    const plat = (navigator.platform || '').toLowerCase();
    const ua = (navigator.userAgent || '').toLowerCase();

    const isMac = plat.includes('mac') || ua.includes('mac os x');
    const isWin = plat.includes('win') || ua.includes('windows');
    const isLinux = plat.includes('linux') || (!isMac && !isWin && (ua.includes('linux') || ua.includes('x11')));

    if (isMac) return 'mac';
    if (isWin) return 'windows';
    if (isLinux) return 'linux';
    return 'unknown';
  });
}

/** Map action → chord for a given OS */
export function chordFor(action: ShortcutAction, os: OS): string {
  const isMac = os === 'mac';

  console.log(`perform action ${action} on os ${os}`);

  switch (action) {
    case 'send':
      return isMac ? 'Meta+Enter' : 'Control+Enter';
    case 'queue':
      return isMac ? 'Meta+Shift+Enter' : 'Control+Shift+Enter';
    case 'stop':
      // SIGINT-style stop; stays Control+C everywhere
      return 'Control+C';
    case 'stopAndSend':
      return isMac ? 'Meta+Enter' : 'Control+Enter';
    case 'clearQueue':
      return 'Control+X';
    default:
      // Sensible default if unknown
      return isMac ? 'Meta+Enter' : 'Control+Enter';
  }
}