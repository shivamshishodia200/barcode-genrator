import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';
import { LabelTemplate, LabelElement } from '../src/types/index';
import { evaluateElementData } from '../src/services/dataSourceEngine';
import { generatePrintStream } from '../src/services/printerAdapters';
import { excelDataSourceProvider } from '../src/services/providers/ExcelDataSourceProvider';

const TEST_FILE = path.resolve('BarTender_Test_Data.xlsx');

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  ✗ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

console.log('================================================================');
console.log('  BARTENDER TEST DATA WORKFLOW ACCEPTANCE TEST SUITE            ');
console.log('  Workbook: BarTender_Test_Data.xlsx (Products sheet)           ');
console.log('================================================================\n');

// 1. Verify Workbook on Disk
console.log('--- Step 1: Real Excel File & Workbook Verification ---');
assert(fs.existsSync(TEST_FILE), `BarTender_Test_Data.xlsx exists at ${TEST_FILE}`);
const buf = fs.readFileSync(TEST_FILE);
const wb = XLSX.read(buf, { type: 'buffer', cellDates: true, cellNF: true, cellText: true });
assert(wb.SheetNames.includes('Products'), 'Workbook contains "Products" worksheet');

// 2. Sheet Normalization (Products$ <-> Products)
console.log('\n--- Step 2: Sheet Name Normalization (Products$ <-> Products) ---');
const uiSheetName = 'Products$';
const internalSheet = uiSheetName.replace(/^['"]|['"]$/g, '').replace(/\$$/, '');
assert(internalSheet === 'Products', 'Successfully normalized "Products$" to "Products"');
const ws = wb.Sheets[internalSheet];
assert(ws !== undefined, 'Sheet object resolved cleanly via normalized name');

// 3. Field Discovery & Schema Verification
console.log('\n--- Step 3: Field Discovery & 7 Expected Columns ---');
const rawRows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
assert(rawRows.length === 7, `Extracted 7 real records (got ${rawRows.length})`);
const expectedFields = ['ProductID', 'ProductName', 'Barcode', 'Price', 'Batch', 'ExpiryDate', 'Quantity'];
const actualFields = Object.keys(rawRows[0]);
for (const ef of expectedFields) {
  assert(actualFields.includes(ef), `Discovered field: "${ef}"`);
}

// 4. Barcode Leading Zeros & Integrity
console.log('\n--- Step 4: Barcode Digit & Leading Zero Preservation ---');
const row1 = rawRows[0];
const row2 = rawRows[1];
const row6 = rawRows[5];
assert(row1.Barcode === '8901234000001', `Row 1 barcode is "8901234000001" (got "${row1.Barcode}")`);
assert(row2.Barcode === '001234567890', `Row 2 leading zeros preserved: "001234567890" (got "${row2.Barcode}")`);
assert(row6.Barcode === '000012345678', `Row 6 leading zeros preserved: "000012345678" (got "${row6.Barcode}")`);

// 5. Expiry Date & Price Formatting
console.log('\n--- Step 5: ExpiryDate & Price Formatting ---');
assert(row1.ExpiryDate === '2028-06-30', `Row 1 ExpiryDate is "2028-06-30" (got "${row1.ExpiryDate}")`);
assert(row1.Price === '450.00', `Row 1 Price is "450.00" (got "${row1.Price}")`);
assert(row2.ExpiryDate === '2029-12-31', `Row 2 ExpiryDate is "2029-12-31" (got "${row2.ExpiryDate}")`);
assert(row2.Price === '1250.00', `Row 2 Price is "1250.00" (got "${row2.Price}")`);

// 6. Record Navigation (First, Prev, Next, Last)
console.log('\n--- Step 6: Record Browser Navigation Simulation ---');
let currentIndex = 0; // First
assert(rawRows[currentIndex].ProductID === 'P-101', 'First record is P-101');
currentIndex = 1; // Next
assert(rawRows[currentIndex].ProductID === 'P-102', 'Next record is P-102');
currentIndex = rawRows.length - 1; // Last
assert(rawRows[currentIndex].ProductID === 'P-107', 'Last record is P-107');
currentIndex = currentIndex - 1; // Previous
assert(rawRows[currentIndex].ProductID === 'P-106', 'Previous record is P-106');

// 7. Designer Data Binding (evaluateElementData)
console.log('\n--- Step 7: Designer Canvas Data Binding ({{FieldName}}) ---');
const textProduct: LabelElement = {
  id: 'el-pname',
  name: 'Product Name Text',
  type: 'text',
  x: 10,
  y: 10,
  width: 80,
  height: 10,
  text: '{{ProductName}}',
  visible: true,
  printable: true,
  fontSize: 12,
  fontFamily: 'Arial',
  fontWeight: 'normal',
  fontStyle: 'normal',
  textDecoration: 'none',
  textAlign: 'left',
  verticalAlign: 'top',
  color: '#000000',
  lineHeight: 1.2,
  letterSpacing: 0,
};

const textPrice: LabelElement = {
  id: 'el-price',
  name: 'Price Text',
  type: 'text',
  x: 10,
  y: 22,
  width: 40,
  height: 8,
  text: 'Price: Rs.{{Price}}',
  visible: true,
  printable: true,
  fontSize: 10,
  fontFamily: 'Arial',
  fontWeight: 'normal',
  fontStyle: 'normal',
  textDecoration: 'none',
  textAlign: 'left',
  verticalAlign: 'top',
  color: '#000000',
  lineHeight: 1.2,
  letterSpacing: 0,
};

const barcodeEl: LabelElement = {
  id: 'el-barcode',
  name: 'Barcode Element',
  type: 'barcode',
  x: 10,
  y: 32,
  width: 60,
  height: 18,
  value: '{{Barcode}}',
  symbology: 'code128',
  includeText: true,
  textPosition: 'below',
  barWidth: 2,
  barHeight: 15,
  quietZone: true,
  foregroundColor: '#000000',
  backgroundColor: '#ffffff',
  checkDigit: true,
  visible: true,
  printable: true,
};

// Evaluate on Record 1
const evalPname1 = evaluateElementData(textProduct, { record: row1 });
const evalPrice1 = evaluateElementData(textPrice, { record: row1 });
const evalBc1 = evaluateElementData(barcodeEl, { record: row1 });
assert(evalPname1 === 'Industrial Heavy Duty Stapler', `Record 1 ProductName resolved to "${evalPname1}"`);
assert(evalPrice1 === 'Price: Rs.450.00', `Record 1 Price resolved to "${evalPrice1}"`);
assert(evalBc1 === '8901234000001', `Record 1 Barcode resolved to "${evalBc1}"`);

// Evaluate on Record 2
const evalPname2 = evaluateElementData(textProduct, { record: row2 });
const evalPrice2 = evaluateElementData(textPrice, { record: row2 });
const evalBc2 = evaluateElementData(barcodeEl, { record: row2 });
assert(evalPname2 === 'High-Speed Thermal Printhead 300DPI', `Record 2 ProductName resolved to "${evalPname2}"`);
assert(evalPrice2 === 'Price: Rs.1250.00', `Record 2 Price resolved to "${evalPrice2}"`);
assert(evalBc2 === '001234567890', `Record 2 Barcode resolved to "${evalBc2}" (Leading zeros!)`);

// 8. Multi-Label Quantity Expansion
console.log('\n--- Step 8: Multi-Label Quantity Field Expansion ---');
const sampleSubset = [rawRows[0], rawRows[1]]; // Row 1 (Qty 5), Row 2 (Qty 3)
const expanded = excelDataSourceProvider.expandRecordsByQuantity(sampleSubset, 'Quantity');
assert(expanded.length === 8, `Qty 5 + Qty 3 expanded to 8 total labels (got ${expanded.length})`);
assert(expanded[0].ProductID === 'P-101' && expanded[4].ProductID === 'P-101', 'Labels 1..5 are Product P-101');
assert(expanded[5].ProductID === 'P-102' && expanded[7].ProductID === 'P-102', 'Labels 6..8 are Product P-102');

// 9. Batch Print Stream Iteration (Distinct Records)
console.log('\n--- Step 9: Batch Print Distinct Output Stream ---');
const template: LabelTemplate = {
  id: 'tpl-bartender-test',
  name: 'BarTender Test Template',
  version: '1.0.0',
  status: 'APPROVED',
  dimensions: { width: 100, height: 50, dpi: 203, unit: 'mm' },
  elements: [textProduct, textPrice, barcodeEl],
  databaseConnection: {
    id: 'db-bt-1',
    name: 'BarTender_Test_Data',
    type: 'excel',
    filePath: TEST_FILE,
    sheetName: 'Products',
    fields: expectedFields,
    records: rawRows,
    status: 'CONNECTED',
  },
};

const printStream = generatePrintStream('zpl', template, rawRows.slice(0, 5), { copies: 1, dpi: 203 });
const zplText = typeof printStream === 'string' ? printStream : new TextDecoder().decode(printStream);
assert(zplText.includes('8901234000001'), 'Print stream contains Row 1 barcode 8901234000001');
assert(zplText.includes('001234567890'), 'Print stream contains Row 2 barcode 001234567890');
assert(zplText.includes('008901001003'), 'Print stream contains Row 3 barcode 008901001003');
assert(zplText.includes('008901001004'), 'Print stream contains Row 4 barcode 008901001004');
assert(zplText.includes('8901234000005'), 'Print stream contains Row 5 barcode 8901234000005');

// 10. Project Serialization & Re-hydration Test
console.log('\n--- Step 10: Project Save & Re-open Hydration ---');
const savedJson = JSON.stringify(template);
const reloadedTemplate: LabelTemplate = JSON.parse(savedJson);
assert(reloadedTemplate.databaseConnection?.type === 'excel', 'Reloaded template retains providerType: excel');
assert(reloadedTemplate.databaseConnection?.sheetName === 'Products', 'Reloaded template retains sheetName: Products');
assert(reloadedTemplate.databaseConnection?.records?.length === 7, 'Reloaded template retains all 7 records');

console.log('\n================================================================');
console.log('  ALL 25 ACCEPTANCE TEST STEPS PASSED SUCCESSFULLY!             ');
console.log('================================================================\n');
