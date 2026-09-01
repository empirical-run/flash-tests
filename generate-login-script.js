const fs = require('fs');
require('dotenv').config({ path: '.env.production' });

const email = process.env.AUTOMATED_USER_EMAIL;
const password = process.env.AUTOMATED_USER_PASSWORD;
let baseUrl = process.env.BUILD_URL || 'https://dash.empirical.run/';
if (!baseUrl.endsWith('/')) baseUrl += '/';

const scriptContent = `async page => {
  try {
    await page.screencast.stop();
  } catch (e) {}

  // Start screencast recording
  await page.screencast.start({
    path: 'login-flow.webm',
    size: { width: 1280, height: 800 }
  });

  // Chapter 1: Navigating to Login Page
  await page.screencast.showChapter('User Flow: Empirical Login', {
    description: 'Navigating to login page',
    duration: 2000,
  });

  const baseUrl = ${JSON.stringify(baseUrl)};
  await page.goto(baseUrl);
  await page.waitForTimeout(1000);

  // Chapter 2: Step 1 - Email
  await page.screencast.showChapter('Step 1: Enter Email', {
    description: 'Entering user email address',
    duration: 1500,
  });

  const emailBox = page.getByRole('textbox', { name: /email/i });
  await emailBox.waitFor({ state: 'visible' });

  const emailBounds = await emailBox.boundingBox();
  let emailOverlay;
  if (emailBounds) {
    emailOverlay = await page.screencast.showOverlay(\`
      <div style="position: absolute; top: \${emailBounds.y - 4}px; left: \${emailBounds.x - 4}px; width: \${emailBounds.width + 8}px; height: \${emailBounds.height + 8}px; border: 2px solid #3b82f6; border-radius: 6px; pointer-events: none;"></div>
      <div style="position: absolute; top: \${emailBounds.y - 35}px; left: \${emailBounds.x}px; background: #3b82f6; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-family: sans-serif; pointer-events: none;">
        Enter Email
      </div>
    \`);
  }

  await emailBox.click();
  await emailBox.pressSequentially(${JSON.stringify(email)}, { delay: 70 });
  await page.waitForTimeout(500);

  if (emailOverlay) await emailOverlay.dispose();

  const continueBtn = page.getByRole('button', { name: 'Continue' });
  await continueBtn.click();
  await page.waitForTimeout(1000);

  // Chapter 3: Step 2 - Password
  await page.screencast.showChapter('Step 2: Enter Password', {
    description: 'Entering password',
    duration: 1500,
  });

  const passwordBox = page.getByRole('textbox', { name: 'Password' });
  await passwordBox.waitFor({ state: 'visible' });

  const pwdBounds = await passwordBox.boundingBox();
  let pwdOverlay;
  if (pwdBounds) {
    pwdOverlay = await page.screencast.showOverlay(\`
      <div style="position: absolute; top: \${pwdBounds.y - 4}px; left: \${pwdBounds.x - 4}px; width: \${pwdBounds.width + 8}px; height: \${pwdBounds.height + 8}px; border: 2px solid #3b82f6; border-radius: 6px; pointer-events: none;"></div>
      <div style="position: absolute; top: \${pwdBounds.y - 35}px; left: \${pwdBounds.x}px; background: #3b82f6; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-family: sans-serif; pointer-events: none;">
        Enter Password
      </div>
    \`);
  }

  await passwordBox.click();
  await passwordBox.pressSequentially(${JSON.stringify(password)}, { delay: 70 });
  await page.waitForTimeout(500);

  if (pwdOverlay) await pwdOverlay.dispose();

  const submitBtn = page.getByRole('button', { name: 'Submit' });
  await submitBtn.click();
  await page.waitForTimeout(2000);

  // Chapter 4: Logged In & Project Dashboard
  await page.screencast.showChapter('Step 3: Authentication Success', {
    description: 'Logged in successfully, loading test runs',
    duration: 2000,
  });

  const targetUrl = baseUrl + 'lorem-ipsum/test-runs';
  await page.goto(targetUrl);
  await page.waitForTimeout(2000);

  const successOverlay = await page.screencast.showOverlay(\`
    <div style="position: absolute; top: 16px; right: 16px; padding: 10px 16px; background: rgba(16, 185, 129, 0.9); color: white; border-radius: 8px; font-family: sans-serif; font-weight: bold; font-size: 14px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); pointer-events: none;">
      ✓ Successfully Logged In
    </div>
  \`);

  await page.waitForTimeout(3000);
  if (successOverlay) await successOverlay.dispose();

  await page.screencast.stop();
  return "Login flow recorded successfully";
}
`;

fs.writeFileSync('run-login-generated.js', scriptContent);
console.log('Generated run-login-generated.js');
