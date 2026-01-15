import ts from 'typescript';
import fs from 'fs';
import { glob } from 'glob';
import path from 'path';

async function analyzeComplexity() {
    const files = await glob('src/**/*.{ts,tsx}', { ignore: ['**/*.d.ts'] });

    const results = [];

    for (const file of files) {
        const code = fs.readFileSync(file, 'utf-8');
        const sourceFile = ts.createSourceFile(
            file,
            code,
            ts.ScriptTarget.Latest,
            true
        );

        function getComplexity(node) {
            let complexity = 0;
            ts.forEachChild(node, (child) => {
                switch (child.kind) {
                    case ts.SyntaxKind.IfStatement:
                    case ts.SyntaxKind.WhileStatement:
                    case ts.SyntaxKind.DoStatement:
                    case ts.SyntaxKind.ForStatement:
                    case ts.SyntaxKind.ForInStatement:
                    case ts.SyntaxKind.ForOfStatement:
                    case ts.SyntaxKind.CaseClause:
                    case ts.SyntaxKind.CatchClause:
                    case ts.SyntaxKind.ConditionalExpression: // Ternary
                        complexity++;
                        complexity += getComplexity(child);
                        break;
                    case ts.SyntaxKind.BinaryExpression: {
                        const binaryExpr = child;
                        if (
                            binaryExpr.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
                            binaryExpr.operatorToken.kind === ts.SyntaxKind.BarBarToken
                        ) {
                            complexity++;
                        }
                        complexity += getComplexity(child);
                        break;
                    }
                    default:
                        complexity += getComplexity(child);
                }
            });
            return complexity;
        }

        function visit(node) {
            if (
                ts.isFunctionDeclaration(node) ||
                ts.isMethodDeclaration(node) ||
                ts.isArrowFunction(node) ||
                ts.isFunctionExpression(node)
            ) {
                const name = node.name ? node.name.getText() : '<anonymous>';
                // Base complexity is 1
                const complexity = 1 + getComplexity(node.body || node);

                const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;

                results.push({
                    file,
                    functionName: name,
                    line,
                    complexity
                });
            }
            ts.forEachChild(node, visit);
        }

        visit(sourceFile);
    }

    // Sort by complexity descending
    results.sort((a, b) => b.complexity - a.complexity);

    console.log('--- Cyclomatic Complexity Report ---');
    console.log(formatRow('Complexity', 'File', 'Line', 'Function'));
    console.log('-'.repeat(80));

    results.slice(0, 20).forEach(r => {
        console.log(formatRow(r.complexity.toString(), r.file, r.line.toString(), r.functionName));
    });
}

function formatRow(col1, col2, col3, col4) {
    return `${col1.padEnd(12)} ${col2.padEnd(40)} ${col3.padEnd(6)} ${col4}`;
}

analyzeComplexity().catch(console.error);
