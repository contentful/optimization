import { readFileSync } from 'node:fs'
import ts from 'typescript'

/**
 * Collects every named declaration in a TypeScript file so a knowledge-base pointer can be resolved
 * to a real symbol. Uses the compiler's PARSER only — no type-checking, no tsconfig graph — so it is
 * fast and self-contained. Recognizes:
 *   - top-level declarations: function / class / interface / type / enum, and `const`/`let` names
 *   - members: enum members, interface/type-literal property & method signatures, and class
 *     members/methods (so a pointer can name a config key or an SDK method like `fetchContentfulEntry`)
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

function addDeclaredName(node: ts.Node, symbols: Set<string>): void {
  if (isNamedDeclaration(node) && node.name !== undefined && ts.isIdentifier(node.name)) {
    symbols.add(node.name.text)
  }
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
    symbols.add(node.name.text)
  }
}

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

function scriptKindFor(filePath: string): ts.ScriptKind {
  return filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
}
