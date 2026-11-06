// Every chat session a test creates must be closed or registered for cleanup in
// the same test (or in an afterEach/afterAll of an enclosing scope), otherwise
// sandboxes leak on the shared test projects.
//
// Helpers declare their effect with JSDoc tags, resolved with the TypeScript
// type checker (so renamed imports and re-exports still work):
//   @createsSession        calling it creates a session the caller must clean up
//   @closesSession         calling it closes, or registers for cleanup, a session
//   @opensSessionComposer  opens a new-session dialog/dock; a later click on a
//                          "Create"/"Start" button in the same scope creates one
//   @sessionCleanupHandled creates a session but owns its cleanup (do not recurse)
// Untagged helpers in this repo are analysed transitively, so a wrapper around
// a tagged helper inherits its effect without needing its own tag.
// Direct API calls are recognised too: POST /api/chat-sessions creates and
// POST /api/chat-sessions/:id/close closes.
import ts from "typescript";

const TAG_CREATES = "createsSession";
const TAG_CLOSES = "closesSession";
const TAG_OPENS = "opensSessionComposer";
const TAG_HANDLED = "sessionCleanupHandled";

const CREATE_BUTTON_NAMES = new Set(["Create", "Start", "Start Session"]);
const CREATE_PATH = /\/api\/chat-sessions\/?(\?.*)?$/;
const CLOSE_PATH = /\/api\/chat-sessions\/(\$\{\}|\d+)\/close\/?$/;

const TEST_CALL = /^test(\.(only|skip|fixme|fail|slow))?$/;
const SETUP_HOOK = /^test\.(beforeEach|beforeAll)$/;
const TEARDOWN_HOOK = /^test\.(afterEach|afterAll)$/;
const DESCRIBE_CALL = /^test\.describe(\.(only|skip|fixme|serial|parallel))*$/;

const emptyEffects = () => ({
  createsVia: null,
  closes: false,
  opens: false,
  clicksCreate: false,
});

function esCalleeName(node) {
  if (node.type === "Identifier") return node.name;
  if (node.type === "MemberExpression" && !node.computed) {
    const object = esCalleeName(node.object);
    return object && `${object}.${node.property.name}`;
  }
  return null;
}

function isFunction(node) {
  return (
    node &&
    (node.type === "ArrowFunctionExpression" ||
      node.type === "FunctionExpression")
  );
}

/** Static text of a string/template literal, with `${}` for substitutions. */
function staticText(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  if (ts.isTemplateExpression(node)) {
    return (
      node.head.text +
      node.templateSpans.map((span) => "${}" + span.literal.text).join("")
    );
  }
  return null;
}

function calleeLabel(call) {
  const callee = call.expression;
  if (ts.isIdentifier(callee)) return callee.text;
  if (ts.isPropertyAccessExpression(callee)) return callee.name.text;
  return "call";
}

/** page.getByRole("button", { name: "Create" }).click() and scoped variants. */
function isCreateButtonClick(call) {
  const callee = call.expression;
  if (!ts.isPropertyAccessExpression(callee) || callee.name.text !== "click") {
    return false;
  }
  for (let node = callee.expression; node;) {
    if (ts.isCallExpression(node)) {
      const inner = node.expression;
      if (
        ts.isPropertyAccessExpression(inner) &&
        inner.name.text === "getByRole" &&
        node.arguments.length >= 2 &&
        staticText(node.arguments[0]) === "button" &&
        ts.isObjectLiteralExpression(node.arguments[1])
      ) {
        const nameProp = node.arguments[1].properties.find(
          (p) =>
            ts.isPropertyAssignment(p) &&
            ts.isIdentifier(p.name) &&
            p.name.text === "name",
        );
        const name = nameProp && staticText(nameProp.initializer);
        if (name && CREATE_BUTTON_NAMES.has(name)) return true;
      }
      node = ts.isPropertyAccessExpression(inner) ? inner.expression : null;
    } else if (ts.isPropertyAccessExpression(node)) {
      node = node.expression;
    } else {
      node = null;
    }
  }
  return false;
}

function rawApiEffect(call) {
  const callee = call.expression;
  const method = ts.isPropertyAccessExpression(callee)
    ? callee.name.text
    : ts.isIdentifier(callee)
      ? callee.text
      : null;
  // page.request.post(path) or an api(page, path, body) style helper with a body
  const isPost = method === "post";
  if (!isPost && call.arguments.length < 3) return null;
  for (const arg of call.arguments.slice(0, 2)) {
    const text = staticText(arg);
    if (text === null) continue;
    if (CLOSE_PATH.test(text)) return "closes";
    if (CREATE_PATH.test(text)) return "creates";
  }
  return null;
}

function createAnalyzer(program) {
  const checker = program.getTypeChecker();
  const memo = new Map();

  function resolveDeclaration(call) {
    let target = call.expression;
    if (ts.isPropertyAccessExpression(target)) target = target.name;
    if (!ts.isIdentifier(target)) return null;
    let symbol = checker.getSymbolAtLocation(target);
    if (!symbol) return null;
    if (symbol.flags & ts.SymbolFlags.Alias) {
      symbol = checker.getAliasedSymbol(symbol);
    }
    let decl = symbol.valueDeclaration ?? symbol.declarations?.[0];
    // Destructured fixture parameters ({ trackCurrentSession }) resolve to the
    // fixture type's property, which carries the JSDoc tags.
    if (
      decl &&
      ts.isBindingElement(decl) &&
      ts.isObjectBindingPattern(decl.parent)
    ) {
      const propName =
        decl.propertyName && ts.isIdentifier(decl.propertyName)
          ? decl.propertyName.text
          : ts.isIdentifier(decl.name)
            ? decl.name.text
            : null;
      const prop =
        propName &&
        checker.getTypeAtLocation(decl.parent).getProperty(propName);
      const propDecl = prop?.valueDeclaration ?? prop?.declarations?.[0];
      if (propDecl) decl = propDecl;
    }
    return decl ?? null;
  }

  function tagsOf(decl) {
    const tags = new Set(ts.getJSDocTags(decl).map((t) => t.tagName.text));
    if (ts.isVariableDeclaration(decl) && decl.parent?.parent) {
      for (const t of ts.getJSDocTags(decl.parent.parent))
        tags.add(t.tagName.text);
    }
    return tags;
  }

  function functionBody(decl) {
    const source = decl.getSourceFile();
    if (
      source.isDeclarationFile ||
      source.fileName.includes("/node_modules/")
    ) {
      return null;
    }
    if (
      ts.isFunctionDeclaration(decl) ||
      ts.isMethodDeclaration(decl) ||
      ts.isFunctionExpression(decl) ||
      ts.isArrowFunction(decl)
    ) {
      return decl.body ?? null;
    }
    if (
      ts.isVariableDeclaration(decl) &&
      decl.initializer &&
      (ts.isArrowFunction(decl.initializer) ||
        ts.isFunctionExpression(decl.initializer))
    ) {
      return decl.initializer.body;
    }
    return null;
  }

  function effectsOfDeclaration(decl) {
    if (memo.has(decl)) return memo.get(decl);
    const effects = emptyEffects();
    memo.set(decl, effects); // cycle guard
    const tags = tagsOf(decl);
    const name =
      decl.name && ts.isIdentifier(decl.name) ? decl.name.text : "helper";
    if (tags.has(TAG_HANDLED)) return effects;
    if (tags.has(TAG_CREATES)) effects.createsVia = `${name}()`;
    if (tags.has(TAG_CLOSES)) effects.closes = true;
    if (tags.has(TAG_OPENS)) effects.opens = true;
    if (effects.createsVia || effects.closes || effects.opens) return effects;
    const body = functionBody(decl);
    if (!body) return effects;
    const inner = scan(body);
    if (inner.creates.length) {
      effects.createsVia = `${name}() → ${inner.creates[0].via}`;
    } else if (inner.opens && inner.clicksCreate) {
      effects.createsVia = `${name}() (opens the new-session dialog and clicks Create)`;
    }
    effects.closes = inner.closes;
    effects.opens = inner.opens;
    effects.clicksCreate = inner.clicksCreate;
    return effects;
  }

  /**
   * Walks a function body (including nested callbacks such as test.step) and
   * returns { creates: [{ node, via }], closes, opens, clicksCreate }.
   */
  function scan(root) {
    const result = {
      creates: [],
      closes: false,
      opens: false,
      clicksCreate: false,
      clickNode: null,
    };
    const visit = (node) => {
      if (ts.isCallExpression(node)) {
        const raw = rawApiEffect(node);
        if (raw === "creates") {
          result.creates.push({ node, via: "POST /api/chat-sessions" });
        } else if (raw === "closes") {
          result.closes = true;
        }
        if (isCreateButtonClick(node)) {
          result.clicksCreate = true;
          result.clickNode ??= node;
        }
        const decl = resolveDeclaration(node);
        if (decl) {
          const effects = effectsOfDeclaration(decl);
          if (effects.createsVia) {
            const label = calleeLabel(node);
            const via = effects.createsVia.startsWith(`${label}()`)
              ? effects.createsVia
              : `${label}() → ${effects.createsVia}`;
            result.creates.push({ node, via });
          }
          result.closes ||= effects.closes;
          if (effects.opens) result.opens = true;
          if (effects.clicksCreate) {
            result.clicksCreate = true;
            result.clickNode ??= node;
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(root);
    if (!result.creates.length && result.opens && result.clicksCreate) {
      result.creates.push({
        node: result.clickNode,
        via: "a Create/Start click after opening the new-session dialog",
      });
    }
    return result;
  }

  return { scan };
}

/** @type {import("eslint").Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require tests that create a chat session to close it or register it for cleanup",
    },
    messages: {
      missingCleanup:
        "This {{scope}} creates a session via {{via}} but never closes or tracks it. Call trackCurrentSession(page) once the session URL is ready (or closeSession/closeSeededSession, or POST /api/chat-sessions/:id/close).",
    },
    schema: [],
  },
  create(context) {
    const services = context.sourceCode.parserServices;
    if (!services?.program || !services.esTreeNodeToTSNodeMap) return {};
    const { scan } = createAnalyzer(services.program);
    const scanCache = new Map();
    const scanEs = (fnNode) => {
      if (!scanCache.has(fnNode)) {
        scanCache.set(fnNode, scan(services.esTreeNodeToTSNodeMap.get(fnNode)));
      }
      return scanCache.get(fnNode);
    };

    /** Hook callbacks declared directly in a Program or describe body. */
    function hooksIn(statements, pattern) {
      const fns = [];
      for (const statement of statements) {
        const expr =
          statement.type === "ExpressionStatement"
            ? statement.expression
            : null;
        if (expr?.type !== "CallExpression") continue;
        const name = esCalleeName(expr.callee);
        if (!name || !pattern.test(name)) continue;
        const fn = expr.arguments.find(isFunction);
        if (fn) fns.push(fn);
      }
      return fns;
    }

    /** Statement lists of the enclosing describe bodies and the file. */
    function enclosingScopes(node) {
      const scopes = [];
      for (let current = node.parent; current; current = current.parent) {
        if (current.type === "Program") scopes.push(current.body);
        if (
          isFunction(current) &&
          current.body.type === "BlockStatement" &&
          current.parent?.type === "CallExpression" &&
          DESCRIBE_CALL.test(esCalleeName(current.parent.callee) ?? "")
        ) {
          scopes.push(current.body.body);
        }
      }
      return scopes;
    }

    function teardownCloses(node) {
      return enclosingScopes(node).some((statements) =>
        hooksIn(statements, TEARDOWN_HOOK).some((fn) => scanEs(fn).closes),
      );
    }

    function check(fn, scopeLabel, hookNode) {
      const result = scanEs(fn);
      if (!result.creates.length || result.closes) return;
      if (teardownCloses(hookNode)) return;
      const first = result.creates[0];
      context.report({
        node: services.tsNodeToESTreeNodeMap.get(first.node) ?? hookNode,
        messageId: "missingCleanup",
        data: { scope: scopeLabel, via: first.via },
      });
    }

    return {
      CallExpression(node) {
        const name = esCalleeName(node.callee);
        if (!name) return;
        const fn = node.arguments.find(isFunction);
        if (!fn && !name.endsWith(".extend")) return;
        if (TEST_CALL.test(name)) {
          // test.skip(() => cond, reason) is a condition, not a test body
          const title = node.arguments[0];
          if (title === fn) return;
          check(fn, "test", node);
        } else if (SETUP_HOOK.test(name)) {
          check(fn, "hook", node);
        } else if (name.endsWith(".extend")) {
          // Custom fixtures: base.extend({ name: async ({ page }, use) => { ... } })
          const fixtures = node.arguments[0];
          if (fixtures?.type !== "ObjectExpression") return;
          for (const prop of fixtures.properties) {
            const value =
              prop.type === "Property" && Array.isArray(prop.value?.elements)
                ? prop.value.elements[0]
                : prop.value;
            if (isFunction(value)) check(value, "fixture", value);
          }
        }
      },
    };
  },
};
