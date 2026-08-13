import fs from 'fs';
import path from 'path';
import { reconcileGstPeriod } from '../services/gst-reconciliation.js';
import { buildB2bCsv, buildB2csCsv, buildHsnCsv, buildDocsCsv } from '../services/gst-export-templates.js';

const [gstin, period, b2bPath, b2cPath, flipkartPath, outDir] = process.argv.slice(2);

const amazonB2bBuffer = b2bPath ? fs.readFileSync(b2bPath) : undefined;
const amazonB2cBuffer = b2cPath ? fs.readFileSync(b2cPath) : undefined;
const flipkartBuffer = flipkartPath ? fs.readFileSync(flipkartPath) : undefined;

const result = reconcileGstPeriod({ gstin, period, amazonB2bBuffer, amazonB2cBuffer, flipkartBuffer });

console.log('── Flags ──');
for (const f of result.flags) {
  console.log(`[${f.severity.toUpperCase()}] ${f.code}: ${f.message}`);
}
console.log('\n── Summary ──');
console.log(JSON.stringify(result.summary, null, 2));

const blockers = result.flags.filter((f) => f.severity === 'blocker');
if (blockers.length) {
  console.log(`\n${blockers.length} blocker(s) present. Not writing export CSVs.`);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'B2B.csv'), buildB2bCsv(result.tables.b2b));
fs.writeFileSync(path.join(outDir, 'B2CS.csv'), buildB2csCsv(result.tables.b2cs));
fs.writeFileSync(path.join(outDir, 'HSN.csv'), buildHsnCsv(result.tables.hsn));
fs.writeFileSync(path.join(outDir, 'DOC.csv'), buildDocsCsv(result.tables.docs));
console.log(`\nExport CSVs written to ${outDir}`);
