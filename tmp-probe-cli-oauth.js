const { chromium } = require('@playwright/test');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

function run(cmd, args, opts={}) { return new Promise((resolve, reject) => { const p=spawn(cmd,args,{...opts,stdio:['ignore','pipe','pipe']}); let out=''; p.stdout.on('data',d=>{out+=d}); p.stderr.on('data',d=>{out+=d}); p.on('close',c=> c===0?resolve(out):reject(new Error('code '+c+'\n'+out))); }); }
function waitUrl(proc) { return new Promise((resolve,reject)=>{ let out=''; const t=setTimeout(()=>reject(new Error('timeout\n'+out)),20000); const on=(d)=>{ out+=d; console.log(String(d)); const m=out.match(/https?:\/\/\S+/); if(m){ clearTimeout(t); resolve(m[0]); }}; proc.stdout.on('data',on); proc.stderr.on('data',on); proc.on('exit',c=>reject(new Error('exited '+c+'\n'+out))); }); }
(async()=>{
 const home=fs.mkdtempSync(path.join(os.tmpdir(),'cli-home-'));
 const env={...process.env, HOME:home, CI:'true', EMPIRICAL_ADD_TO_PATH:'no', EMPIRICAL_CONFIGURE_SKILL:'no', EMPIRICAL_ENV:'prod'};
 console.log(await run('sh',['-c','curl -fsSL https://cli.empirical.run/install | sh'],{env}));
 const bin=path.join(home,'.empirical/bin/empirical');
 const login=spawn(bin,['login'],{env,stdio:['ignore','pipe','pipe']});
 const url=await waitUrl(login); console.log('URL',url);
 const browser=await chromium.launch({headless:true});
 const context=await browser.newContext();
 const page=await context.newPage();
 await page.goto(url);
 console.log('after goto', page.url(), await page.title());
 console.log(await page.locator('body').innerText({timeout:10000}).catch(e=>'BODYERR '+e.message));
 await page.getByRole('textbox', { name: /email/i }).fill(process.env.AUTOMATED_USER_EMAIL);
 await page.getByRole('button', { name: 'Continue' }).click();
 await page.getByRole('textbox', { name: 'Password' }).fill(process.env.AUTOMATED_USER_PASSWORD);
 await page.getByRole('button', { name: 'Submit' }).click();
 await page.waitForTimeout(3000);
 console.log('after login', page.url(), await page.title());
 console.log(await page.locator('body').innerText({timeout:10000}).catch(e=>'BODYERR '+e.message));
 await page.screenshot({path:'/tmp/oauth-after-login.png', fullPage:true});
 console.log('buttons', await page.getByRole('button').evaluateAll(bs=>bs.map(b=>b.textContent)));
 await browser.close();
 login.kill();
})();
