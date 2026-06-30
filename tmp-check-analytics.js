const { chromium } = require('@playwright/test');
(async()=>{
 const browser=await chromium.launch({headless:true});
 const context=await browser.newContext({storageState:'playwright/.auth/user.json', baseURL:'https://dash.empirical.run'});
 const page=await context.newPage();
 await page.goto('https://dash.empirical.run/');
 await page.getByRole('link',{name:'Analytics'}).click();
 await page.getByText(/Showing \d+ of \d+ test cases/).waitFor({timeout:15000});
 await page.getByPlaceholder('Search tests...').fill('fail_rate:>50');
 await page.getByPlaceholder('Search tests...').press('Enter');
 await page.waitForURL(/search=fail_rate/, {timeout:10000});
 await page.locator('[data-slot="skeleton"]').first().waitFor({state:'hidden', timeout:15000}).catch(e=>console.log('skeleton wait', e.message));
 await page.waitForTimeout(1000);
 console.log('url', page.url());
 console.log(await page.locator('body').innerText());
 await browser.close();
})();
