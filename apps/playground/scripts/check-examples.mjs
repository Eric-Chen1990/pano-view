import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const src = fileURLToPath(new URL("../src/", import.meta.url));

function parse(file) {
  return ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
}

function* visit(node) {
  yield node;
  for (const child of node.getChildren()) yield* visit(child);
}

function property(object, name) {
  return object.properties.find((item) => item.name?.getText() === name);
}

function string(node) {
  return node && ts.isStringLiteral(node) ? node.text : undefined;
}

function imports(source, name) {
  return source.statements.find((node) => {
    if (!ts.isImportDeclaration(node)) return false;
    const bindings = node.importClause?.namedBindings;
    return bindings && ts.isNamedImports(bindings) && bindings.elements.some((item) => item.name.text === name);
  });
}

const routesFile = parse(resolve(src, "routes.tsx"));
const declarations = [...visit(routesFile)].filter(ts.isVariableDeclaration);
const routes = declarations.find(({ name }) => name.getText() === "PLAYGROUND_ROUTES")?.initializer;
if (!routes || !ts.isArrayLiteralExpression(routes)) throw new Error("Expected PLAYGROUND_ROUTES to be an array.");

for (const route of routes.elements) {
  if (!ts.isObjectLiteralExpression(route)) throw new Error("Expected an explicit Playground route.");
  const path = string(property(route, "path")?.initializer);
  const format = string(property(route, "jsonExample")?.initializer);
  const component = property(route, "Component")?.initializer?.getText();
  if (!path || !format || !component) throw new Error(`${path ?? "Playground route"}: declare Component and jsonExample.`);

  const imported = imports(routesFile, component);
  const lazy = declarations.find(({ name }) => name.getText() === component)?.initializer;
  const dynamicImport = lazy && [...visit(lazy)].find(
    (node) => ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword,
  );
  const module = string(imported?.moduleSpecifier ?? dynamicImport?.arguments[0]);
  if (!module?.startsWith("./")) throw new Error(`${path}: could not resolve ${component}.`);

  const page = parse(resolve(src, `${module}.tsx`));
  const snippetImport = imports(page, "ExampleCode");
  const snippets = [...visit(page)].filter(
    (node) => ts.isJsxSelfClosingElement(node) && node.tagName.getText() === "ExampleCode",
  );
  if (string(snippetImport?.moduleSpecifier) !== "../ExampleCode" || snippets.length !== 1) {
    throw new Error(`${path}: render one shared ExampleCode in the route module.`);
  }

  const { attributes } = snippets[0];
  if (!property(attributes, "react")?.initializer) throw new Error(`${path}: provide a React example.`);
  const json = property(attributes, "json")?.initializer;
  const value = json && ts.isJsxExpression(json) ? json.expression : undefined;
  const actualFormat = value && ts.isObjectLiteralExpression(value)
    ? string(property(value, "format")?.initializer)
    : undefined;
  if (format === "none" ? json : actualFormat !== format) {
    throw new Error(`${path}: ExampleCode JSON format must match jsonExample (${format}).`);
  }
}

console.log(`Checked example code for ${routes.elements.length} Playground routes.`);
