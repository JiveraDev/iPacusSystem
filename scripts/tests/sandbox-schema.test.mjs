import test from 'node:test';
import assert from 'node:assert/strict';
import { extractSchema } from '../sandbox/schema.mjs';

test('schema-only extraction supports omitted engine clauses and excludes source records/routines', () => {
    const dump = "CREATE TABLE `users` (\n `user_id` int NOT NULL\n) ;\nINSERT INTO `users` VALUES (42);\nCREATE DEFINER=`source`@`host` PROCEDURE cleanup() DELETE FROM users;\nCREATE TABLE `bookings` (\n `booking_id` int NOT NULL\n) ENGINE=InnoDB AUTO_INCREMENT=900;\nALTER TABLE `users`\n ADD PRIMARY KEY (`user_id`);\n";
    const schema = extractSchema(dump);
    assert.deepEqual(schema.tableNames, ['users','bookings']);
    assert.match(schema.sql, /ADD PRIMARY KEY/);
    assert.match(schema.sql, /AUTO_INCREMENT=1;/);
    assert.match(schema.sql, /DEFAULT CHARSET=utf8mb4/);
    assert.doesNotMatch(schema.sql, /INSERT INTO|CREATE DEFINER|DELETE FROM|VALUES \(42\)/);
});

test('incomplete table extraction and external table changes fail closed', () => {
    assert.throws(() => extractSchema('CREATE TABLE `users` (\n broken'), /extracted safely/);
    const valid = 'CREATE TABLE `users` (\n id int\n) ;\nCREATE TABLE `bookings` (\n id int\n) ;\n';
    assert.throws(() => extractSchema(valid + 'ALTER TABLE `other_database` ADD id int;'), /outside its schema/);
});
