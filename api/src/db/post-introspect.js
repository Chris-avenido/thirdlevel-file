import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const schemaTsPath = path.resolve(__dirname, 'schema.ts');
const schemaJsPath = path.resolve(__dirname, 'schema.js');
const relationsTsPath = path.resolve(__dirname, 'relations.ts');
const relationsJsPath = path.resolve(__dirname, 'relations.js');

if (fs.existsSync(schemaTsPath)) {
  let schemaContent = fs.readFileSync(schemaTsPath, 'utf8');
  // Fix empty string default if present
  schemaContent = schemaContent.replace(/\.default\('\)\./g, ".default('').");
  fs.writeFileSync(schemaTsPath, schemaContent, 'utf8');
  fs.writeFileSync(schemaJsPath, schemaContent, 'utf8');
  console.log('[Drizzle Introspect] Synchronized schema.ts and schema.js');
}

if (fs.existsSync(relationsTsPath)) {
  let relContent = fs.readFileSync(relationsTsPath, 'utf8');
  relContent = relContent.replace(/from\s+["']\.\/schema["']/g, 'from "./schema.js"');
  fs.writeFileSync(relationsJsPath, relContent, 'utf8');
  console.log('[Drizzle Introspect] Synchronized relations.ts and relations.js');
}
