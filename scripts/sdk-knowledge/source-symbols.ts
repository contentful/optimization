/**
 * Symbol collection for the knowledge-base validator.
 *
 * A `<sdk>#file#symbol` pointer is only trustworthy if the named symbol actually exists in the file.
 * This module answers "what names does this file declare?" by parsing the source with the TypeScript
 * compiler API and walking the AST.
 *
 * Design choices:
 *   - PARSER ONLY. We use `ts.createSourceFile` (syntax) — not a Program/TypeChecker (types). We only
 *     need to know a name is declared, not resolve its type, so we avoid the cost and the tsconfig /
 *     module-resolution graph a checker would require. This keeps the validator fast and hermetic.
 *   - DECLARATIONS, NOT RE-EXPORTS. We match declaration nodes, so `export { foo } from './x'` does
 *     NOT make `foo` count as declared here — it is declared in `./x`. This is intentional: a pointer
 *     should name the file that actually declares the symbol, not a barrel that re-exports it (a
 *     recurring source of drift the migration caught).
 *   - EXPORTED OR NOT. A pointer may name an internal symbol as evidence, so we do not require the
 *     `export` modifier — only that the name is declared somewhere in the file.
 */

import { readFileSync } from 'node:fs'
import ts from 'typescript'

/**
 * Returns every name declared anywhere in the file: top-level function / class / interface / type /
 * enum and `const`/`let`/`var` names, plus members (enum members, interface & type-literal property/
 * method signatures, and class members/methods — so a pointer can name a config key or an SDK method
 * like `fetchContentfulEntry`). The whole tree is walked (not just top level) so nested members are
 * reached.
 */
export function collectDeclaredSymbols(filePath: string): Set<string> {
  const sourceFile = ts.createSourceFile(
    filePath,
    readFileSync(filePath, 'utf8'),
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    scriptKindFor(filePath),
  )

  const symbols = new Set<string>()
  const visit = (node: ts.Node): void => {
    addDeclaredName(node, symbols)
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return symbols
}

/**
 * Adds `node`'s declared name to the set, if it has one. Variable declarations are handled separately
 * from the isNamedDeclaration group because a `VariableDeclaration`'s binding may be a destructuring
 * pattern rather than a plain identifier; we only record the simple-identifier case (`const x = …`).
 */
function addDeclaredName(node: ts.Node, symbols: Set<string>): void {
  if (isNamedDeclaration(node) && node.name !== undefined && ts.isIdentifier(node.name)) {
    symbols.add(node.name.text)
  }
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
    symbols.add(node.name.text)
  }
}

/** True for declaration nodes that expose a `name` — either a top-level declaration or a member. */
function isNamedDeclaration(node: ts.Node): node is ts.Declaration & { name: ts.Node | undefined } {
  return isTopLevelDeclaration(node) || isMemberDeclaration(node)
}

/** Top-level named declarations: function / class / interface / type / enum. */
function isTopLevelDeclaration(node: ts.Node): boolean {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isClassDeclaration(node) ||
    ts.isInterfaceDeclaration(node) ||
    ts.isTypeAliasDeclaration(node) ||
    ts.isEnumDeclaration(node)
  )
}

/** Named members of interfaces, type literals, enums, and classes. */
function isMemberDeclaration(node: ts.Node): boolean {
  return (
    ts.isEnumMember(node) ||
    ts.isPropertySignature(node) ||
    ts.isMethodSignature(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isPropertyDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node)
  )
}

/** Parse as TSX for `.tsx` files (JSX changes the grammar), otherwise plain TS. */
function scriptKindFor(filePath: string): ts.ScriptKind {
  return filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
}
