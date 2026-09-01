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

  // Chapter 1: Introduction
  await page.screencast.showChapter('Empirical Login Flow', {
    description: 'Manual User Authentication Demonstration',
    duration: 2500,
  });

  const baseUrl = ${JSON.stringify(baseUrl)};
  await page.goto(baseUrl);
  await page.waitForTimeout(1000);

  // Chapter 2: Step 1 - Enter Email
  await page.screencast.showChapter('Step 1: Enter Email', {
    description: 'Providing user email address',
    duration: 2000,
  });

  const emailBox = page.getByRole('textbox', { name: 'Email' });
  await emailBox.waitFor({ state: 'visible' });

  const emailBounds = await emailBox.boundingBox();
  let emailOverlay;
  if (emailBounds) {
    emailOverlay = await page.screencast.showOverlay(\`
      <div style="position: absolute; top: \${emailBounds.y - 4}px; left: \${emailBounds.x - 4}px; width: \${emailBounds.width + 8}px; height: \${emailBounds.height + 8}px; border: 2px solid #3b82f6; border-radius: 6px; pointer-events: none;"></div>
      <div style="position: absolute; top: \${emailBounds.y - 35}px; left: \${emailBounds.x}px; background: #3b82f6; color: white; padding: 4px 10px; border-radius: 4px; font-size: 13px; font-family: sans-serif; font-weight: 500; pointer-events: none; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        Enter Email Address
      </div>
    \`);
  }

  await emailBox.click();
  await emailBox.pressSequentially(${JSON.stringify(email)}, { delay: 80 });
  await page.waitForTimeout(600);

  if (emailOverlay) await emailOverlay.dispose();

  const continueBtn = page.getByRole('button', { name: 'Continue' });
  await continueBtn.click();
  await page.waitForTimeout(1500);

  // Chapter 3: Step 2 - Enter Password
  await page.screencast.showChapter('Step 2: Enter Password', {
    description: 'Providing account password',
    duration: 2000,
  });

  const pwdBox = page.getByRole('textbox', { name: 'Password' });
  await pwdBox.waitFor({ state: 'visible' });

  const pwdBounds = await pwdBox.boundingBox();
  let pwdOverlay;
  if (pwdBounds) {
    pwdOverlay = await page.screencast.showOverlay(\`
      <div style="position: absolute; top: \${pwdBounds.y - 4}px; left: \${pwdBounds.x - 4}px; width: \${pwdBounds.width + 8}px; height: \${pwdBounds.height + 8}px; border: 2px solid #3b82f6; border-radius: 6px; pointer-events: none;"></div>
      <div style="position: absolute; top: \${pwdBounds.y - 35}px; left: \${pwdBounds.x}px; background: #3b82f6; color: white; padding: 4px 10px; border-radius: 4px; font-size: 13px; font-family: sans-serif; font-weight: 500; pointer-events: none; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        Enter Password
      </div>
    \`);
  }

  await pwdBox.click();
  await pwdBox.pressSequentially(${JSON.stringify(password)}, { delay: 80 });
  await page.waitForTimeout(600);

  if (pwdOverlay) await pwdOverlay.dispose();

  const submitBtn = page.getByRole('button', { name: 'Submit' });
  await submitBtn.click();
  await page.waitForTimeout(2500);

  // Chapter 4: Access Workspace
  await page.screencast.showChapter('Step 3: Access Workspace', {
    description: 'Authentication successful — loading project workspace',
    duration: 2000,
  });

  const targetUrl = baseUrl + 'lorem-ipsum/test-runs';
  await page.goto(targetUrl);
  await page.waitForTimeout(2000);

  const successOverlay = await page.screencast.showOverlay(\`
    <div style="position: absolute; top: 20px; right: 20px; padding: 12px 20px; background: #10b981; color: white; border-radius: 8px; font-family: sans-serif; font-weight: 600; font-size: 15px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.2); pointer-events: none;">
      ✓ Login Successful — Welcome to Empirical
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
