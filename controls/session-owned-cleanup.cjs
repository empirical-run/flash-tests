// Cheap transport controls only: no browsers, agents, remote APIs, or real refs.
// Run: node --test controls/session-owned-cleanup.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const sourcePath = path.resolve(__dirname, '../tests/pages/session-owned-cleanup.ts');
const compiled = ts.transpileModule(fs.readFileSync(sourcePath, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const helperModule = new Module(sourcePath, module);
helperModule.paths = module.paths;
helperModule.require = id => {
  if (id === './github') return { getBranchSha: async () => '0'.repeat(40) };
  if (id === './urls') return { getDashboardBaseUrl: () => 'https://isolated-control.invalid' };
  return module.require(id);
};
helperModule._compile(compiled, sourcePath);
const { cleanupOwnedSessionPrHeads, createOwnedTwoPrBase, observeOwnedSessionCreation } = helperModule.exports;
const sha = n => n.repeat(40);
const base = 'two-prs-test-control';
const repo = 'empirical-run/lorem-ipsum-tests';

function fixture(overrides = {}) {
  const session = { id: 101, project_id: 3, created_by: 'owned-actor', created_at: '2026-01-01T00:00:00Z', source_identifier: 'owned-source', source: 'dashboard', mode: 'chat', purpose: null };
  const heads = [{ number: 11, branch: `${base}-delete`, sha: sha('a') }, { number: 12, branch: `${base}-restore`, sha: sha('b') }];
  const state = { is_closed: false, refs: { [base]: sha('c'), [`${base}-restore`]: sha('b'), main: sha('d'), staging: sha('e'), [`${base}-restore-other`]: sha('f') }, protected: ['main', 'manager-owned', base], calls: [], unprotect: 0, deleted: false };
  const response = (data, status = 200, contentType = 'application/json') => ({ status: () => status, headers: () => ({ 'content-type': contentType }), json: async () => structuredClone(data) });
  const prs = Object.fromEntries(heads.map(h => [h.number, { number: h.number, state: h.number === 11 ? 'closed' : 'open', head: { ref: h.branch, sha: h.sha, repo: { full_name: repo } }, base: { ref: base, repo: { full_name: repo } } }]));
  const ledger = heads.map(h => ({ branch_name: h.branch, repo_host: 'github', repo_owner: 'empirical-run', repo_name: 'lorem-ipsum-tests', pull_requests: [{ number: h.number, base_branch: base }] }));
  const request = {
    get: async url => {
      const route = new URL(url).pathname; state.calls.push(['GET', route]);
      if (overrides.auth401) return response({ error: 'unauthorized' }, 401);
      if (route === '/api/projects/3') return response({ data: { id: 3, repo_host: 'github', repo_owner: 'empirical-run', repo_name: overrides.foreignProject ? 'shared-repo' : 'lorem-ipsum-tests', protected_branches: state.protected } });
      if (route === '/api/chat-sessions/101') return response({ data: { chat_session: { ...session, ...overrides.liveIdentity, is_closed: state.is_closed } } });
      if (route === '/api/chat-sessions/101/branches') return response({ data: overrides.foreignLedger ? [{ ...ledger[1], repo_owner: 'other' }] : ledger });
      throw Error(`Unexpected GET ${route}`);
    },
    post: async (url, { data }) => {
      const route = new URL(url).pathname;
      if (route === '/api/chat-sessions/101/close') { state.calls.push(['CLOSE', route]); state.is_closed = !overrides.closeNotEffective; return response({}); }
      assert.equal(route, '/api/github/proxy');
      const relative = data.url.replace(`/repos/${repo}`, ''); state.calls.push([data.method, relative]);
      if (data.method === 'GET' && relative.startsWith('/git/matching-refs/heads/')) {
        const name = decodeURIComponent(relative.split('/heads/')[1]);
        if (overrides.htmlRead || (overrides.htmlAfterDelete && state.deleted)) return response('<html>provider404</html>', 404, 'text/html');
        if (overrides.html200) return response('<html>not JSON</html>', 200, 'text/html');
        const refs = Object.entries(state.refs).filter(([ref]) => ref.startsWith(name)).map(([ref, value]) => ({ ref: `refs/heads/${ref}`, object: { sha: value } }));
        if (overrides.changedHead && name.endsWith('-restore')) refs.find(r => r.ref === `refs/heads/${name}`).object.sha = sha('9');
        if (overrides.changedBase && name === base) refs.find(r => r.ref === `refs/heads/${name}`).object.sha = sha('9');
        return response(refs);
      }
      if (relative.startsWith('/pulls/')) {
        const pr = prs[Number(relative.split('/').pop())];
        if (overrides.foreignPr) pr.base.ref = 'main';
        if (overrides.changedPr) pr.head.sha = sha('9');
        if (data.method === 'PATCH') {
          pr.state = 'closed';
          if (overrides.changedAfterClose) state.refs[`${base}-restore`] = sha('9');
        }
        return response(pr);
      }
      if (data.method === 'DELETE' && relative.startsWith('/git/refs/heads/')) {
        if (overrides.unsupportedDelete) return response({ error: 'unsupported' }, 405);
        const name = decodeURIComponent(relative.split('/heads/')[1]);
        if (!overrides.deleteNotEffective) delete state.refs[name];
        state.deleted = true; return response({});
      }
      throw Error(`Unexpected proxy ${data.method} ${relative}`);
    },
  };
  const options = {
    request, apiBaseUrl: 'https://isolated-control.invalid', branch: base,
    headers: { 'x-project-id': '3', Authorization: `Bearer x.${Buffer.from(JSON.stringify({ sub: 'owned-actor' })).toString('base64url')}.x` },
    baseCreation: { ref: `refs/heads/${base}`, object: { sha: sha('0') } }, expectedBaseSha: sha('c'),
    session, heads,
    unprotectBase: async () => { state.unprotect++; state.protected = state.protected.filter(ref => ref !== base); },
  };
  return { state, options };
}
const sharedUntouched = state => {
  assert.equal(state.refs.main, sha('d')); assert.equal(state.refs.staging, sha('e'));
  assert.equal(state.refs[`${base}-restore-other`], sha('f'));
  assert(state.protected.includes('main')); assert(state.protected.includes('manager-owned'));
  assert(!state.calls.some(([method, route]) => ['DELETE', 'PATCH'].includes(method) && /heads\/(?:main|staging)|restore-other/.test(route)));
};

test('owned session + open restore PR: guarded deletion and healthy exact readbacks; auto-deleted first head/prefix neighbor preserved', async () => {
  const { state, options } = fixture(); await cleanupOwnedSessionPrHeads(options);
  assert(state.is_closed); assert(!state.refs[base]); assert(!state.refs[`${base}-restore`]); assert.equal(state.unprotect, 1);
  assert.equal(state.calls.filter(([m]) => m === 'DELETE').length, 2);
  for (const name of [base, `${base}-restore`]) {
    const index = state.calls.findIndex(([m, p]) => m === 'DELETE' && p.endsWith(`/heads/${name}`));
    assert(state.calls.slice(index + 1).some(([m, p]) => m === 'GET' && p === `/git/matching-refs/heads/${name}`));
  }
  sharedUntouched(state);
});

test('early failure before session creation: only positively acknowledged base is cleaned', async () => {
  const { state, options } = fixture(); delete state.refs[`${base}-restore`]; delete options.session; options.heads = [];
  await cleanupOwnedSessionPrHeads(options); assert(!state.calls.some(([m]) => m === 'CLOSE')); sharedUntouched(state);
});

for (const [name, override] of [
  ['changed head SHA', { changedHead: true }], ['changed PR SHA', { changedPr: true }],
  ['head changed after PR close', { changedAfterClose: true }],
  ['foreign PR base', { foreignPr: true }], ['foreign registered repo', { foreignLedger: true }],
  ['wrong creator', { liveIdentity: { created_by: 'shared-actor' } }],
  ['wrong session creation identity', { liveIdentity: { source_identifier: 'other-session' } }],
  ['Manager-purpose identity', { liveIdentity: { purpose: 'manager' } }],
  ['foreign project repo', { foreignProject: true }], ['auth401', { auth401: true }],
  ['provider HTML404', { htmlRead: true }], ['provider HTML200', { html200: true }],
  ['close not effective', { closeNotEffective: true }],
]) test(`${name}: refuse mutation of unverified refs`, async () => {
  const { state, options } = fixture(override); await assert.rejects(() => cleanupOwnedSessionPrHeads(options));
  assert(!state.calls.some(([m]) => m === 'DELETE')); assert.equal(state.unprotect, 0); sharedUntouched(state);
});

test('unobserved pushed head on partial failure is preserved, not guessed from current SHA', async () => {
  const { state, options } = fixture(); options.heads = [options.heads[0]];
  await assert.rejects(() => cleanupOwnedSessionPrHeads(options)); assert(!state.calls.some(([m]) => m === 'DELETE')); sharedUntouched(state);
});
test('unsupported DELETE405 remains a cleanup failure; base/shared refs preserved', async () => {
  const { state, options } = fixture({ unsupportedDelete: true });
  await assert.rejects(() => cleanupOwnedSessionPrHeads(options)); assert.equal(state.refs[`${base}-restore`], sha('b')); assert.equal(state.unprotect, 0); sharedUntouched(state);
});
test('changed base SHA is preserved even after owned head cleanup', async () => {
  const { state, options } = fixture({ changedBase: true });
  await assert.rejects(() => cleanupOwnedSessionPrHeads(options)); assert(state.refs[base]); assert.equal(state.unprotect, 0); sharedUntouched(state);
});
test('HTML404 after DELETE is never accepted as healthy absence', async () => {
  const { state, options } = fixture({ htmlAfterDelete: true });
  await assert.rejects(() => cleanupOwnedSessionPrHeads(options)); assert.equal(state.unprotect, 0); assert(state.refs[base]); sharedUntouched(state);
});

test('same positive creation ACK setup; wrong SHA ACK rejected', async () => {
  const calls = [];
  const page = { request: { post: async (url, { data }) => { calls.push({ url, data }); return { status: () => 200, headers: () => ({ 'content-type': 'application/json' }), json: async () => ({ ref: `refs/heads/${base}`, object: { sha: sha('0') } }) }; } } };
  const ack = await createOwnedTwoPrBase(page, base); assert.equal(ack.object.sha, sha('0'));
  assert.equal(calls.length, 1); assert.equal(calls[0].data.body.ref, `refs/heads/${base}`); assert.equal(calls[0].data.body.sha, sha('0'));
  page.request.post = async () => ({ status: () => 200, headers: () => ({ 'content-type': 'application/json' }), json: async () => ({ ref: `refs/heads/${base}`, object: { sha: sha('9') } }) });
  await assert.rejects(() => createOwnedTwoPrBase(page, base));
});
test('native creation observer ignores GET, captures sole real201, removes listener; duplicates/refusals never guessed', async () => {
  const { EventEmitter } = require('node:events'); const page = new EventEmitter();
  const make = (method, status) => ({ request: () => ({ method: () => method }), url: () => 'https://isolated-control.invalid/api/chat-sessions', status: () => status, headers: () => ({ 'content-type': 'application/json' }), json: async () => ({ data: { chat_session: fixture().options.session } }) });
  const read = observeOwnedSessionCreation(page); page.emit('response', make('GET', 200)); page.emit('response', make('POST', 201));
  assert.equal((await read()).id, 101); assert.equal(page.listenerCount('response'), 0);
  const duplicate = observeOwnedSessionCreation(page); page.emit('response', make('POST', 201)); page.emit('response', make('POST', 201)); await assert.rejects(duplicate);
  const refused = observeOwnedSessionCreation(page); page.emit('response', make('POST', 403)); await assert.rejects(refused);
});
test('idempotent already-closed fixture + absent heads/base: healthy reads, no DELETE/close', async () => {
  const { state, options } = fixture(); state.is_closed = true; delete state.refs[base]; delete state.refs[`${base}-restore`];
  await cleanupOwnedSessionPrHeads(options); assert(!state.calls.some(([m]) => m === 'DELETE' || m === 'CLOSE')); sharedUntouched(state);
});
test('unrelated ref or unacknowledged base input refused before any mutation', async () => {
  const { state, options } = fixture(); options.baseCreation.ref = 'refs/heads/main';
  await assert.rejects(() => cleanupOwnedSessionPrHeads(options)); assert.equal(state.calls.length, 0); sharedUntouched(state);
  const other = fixture(); other.options.heads[1].branch = 'staging';
  await assert.rejects(() => cleanupOwnedSessionPrHeads(other.options)); assert(!other.state.calls.some(([m]) => ['DELETE', 'CLOSE', 'PATCH'].includes(m))); sharedUntouched(other.state);
});
