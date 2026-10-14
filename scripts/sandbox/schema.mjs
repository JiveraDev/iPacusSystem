export function extractSchema(dump) {
    const tables = [...dump.matchAll(/^CREATE TABLE `([^`]+)` \([\s\S]*?^\)[^\r\n;]*;/gm)];
    const names = tables.map(match => match[1]);
    const declared = [...dump.matchAll(/^CREATE TABLE `([^`]+)`/gm)];
    if (tables.length !== declared.length) throw new Error('Some table definitions could not be extracted safely.');
    if (!names.includes('users') || !names.includes('bookings') || names.length !== new Set(names).size) {
        throw new Error('Dump must contain unique application table definitions.');
    }
    const alters = [...dump.matchAll(/^ALTER TABLE `([^`]+)`[\s\S]*?;/gm)];
    if (alters.some(match => !names.includes(match[1]))) throw new Error('Dump alters a table outside its schema.');
    const statements = [...tables, ...alters].map(match => match[0]
        .replace(/AUTO_INCREMENT=\d+/g, 'AUTO_INCREMENT=1')
        .replace(/^\)\s*;/m, ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;'));
    if (statements.some(statement => /(?:CREATE DATABASE|\bUSE\s+`|\bDEFINER\s*=|\bINTO OUTFILE\b)/i.test(statement))) {
        throw new Error('Schema contains unsupported database or filesystem directives.');
    }
    return { tableNames: names, sql: `SET FOREIGN_KEY_CHECKS=0;\n${statements.join('\n\n')}\nSET FOREIGN_KEY_CHECKS=1;\n` };
}
