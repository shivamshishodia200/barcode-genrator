import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { evaluateElementData } from '../src/services/dataSourceEngine';
import { LabelElement } from '../src/types';

const FIXTURES_DIR = path.join(process.cwd(), 'test-fixtures');

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: any) {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`, detail !== undefined ? detail : '');
    failed++;
  }
}

// Extraction logic identical to main process
function parseWorksheetDirect(sheet: XLSX.WorkSheet, headerRow = 1, hasHeaders = true) {
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
  const headerIdx = hasHeaders ? Math.max(0, headerRow - 1) : -1;
  const headerCounts: Record<string, number> = {};
  const columns: { name: string; originalName: string; index: number }[] = [];

  for (let c = range.s.c; c <= range.e.c; c++) {
    let orig = `Column_${c + 1}`;
    if (hasHeaders && headerIdx >= 0) {
      const cell = sheet[XLSX.utils.encode_cell({ r: headerIdx, c })];
      if (cell && cell.v !== undefined && cell.v !== null && String(cell.v).trim() !== '') {
        orig = String(cell.w || cell.v).trim();
      }
    }
    headerCounts[orig] = (headerCounts[orig] || 0) + 1;
    const unique = headerCounts[orig] === 1 ? orig : `${orig}_${headerCounts[orig]}`;
    columns.push({ name: unique, originalName: orig, index: c });
  }

  const startRow = hasHeaders ? headerIdx + 1 : range.s.r;
  const rows: Record<string, string>[] = [];
  const normalized: Record<string, any>[] = [];

  for (let r = startRow; r <= range.e.r; r++) {
    let hasVal = false;
    const rowObj: Record<string, string> = {};
    const normObj: Record<string, any> = {};

    for (const col of columns) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c: col.index })];
      if (!cell || cell.v === undefined || cell.v === null) {
        rowObj[col.name] = '';
        normObj[col.name] = { rawValue: null, displayValue: '', dataType: 'empty' };
      } else {
        const formula = cell.f ? String(cell.f) : undefined;
        let disp = cell.w !== undefined ? String(cell.w) : String(cell.v);
        let dt = 'text';

        if (cell.t === 's' || typeof cell.v === 'string') {
          dt = 'text';
          disp = cell.w !== undefined ? String(cell.w) : String(cell.v);
        } else if (cell.t === 'n' || typeof cell.v === 'number') {
          dt = 'number';
          // Check date serial
          if (cell.v > 30000 && cell.v < 70000 && cell.z && /([ymdhs])/i.test(cell.z)) {
            dt = 'date';
            const excelEpoch = new Date(Date.UTC(1899, 11, 30));
            const d = new Date(excelEpoch.getTime() + cell.v * 86400000);
            disp = d.toISOString().slice(0, 10);
          } else {
            disp = cell.w !== undefined ? String(cell.w) : String(cell.v);
          }
        } else if (cell.t === 'd' || cell.v instanceof Date) {
          dt = 'date';
          disp = (cell.v instanceof Date ? cell.v : new Date(cell.v)).toISOString().slice(0, 10);
        }

        rowObj[col.name] = disp;
        normObj[col.name] = { rawValue: cell.v, displayValue: disp, formula, dataType: dt };
        if (disp.trim() !== '') hasVal = true;
      }
    }
    if (hasVal) {
      rows.push(rowObj);
      normalized.push(normObj);
    }
  }

  return { columns, rows, normalized };
}

async function runAllTests() {
  console.log('\n======================================================');
  console.log('  BARCODEFLOW ENTERPRISE — EXCEL AUTOMATED TEST SUITE  ');
  console.log('======================================================\n');

  // Test 1: Workbook Opening
  console.log('--- 1. Workbook Opening & Parsing (normal.xlsx) ---');
  const normalBuf = fs.readFileSync(path.join(FIXTURES_DIR, 'normal.xlsx'));
  const normalWb = XLSX.read(normalBuf, { type: 'buffer', cellDates: true, cellNF: true, cellText: true });
  assert(normalWb.SheetNames.length === 1, 'Found exactly 1 sheet in normal.xlsx');
  assert(normalWb.SheetNames[0] === 'Products', 'Sheet name is "Products"');

  const normalData = parseWorksheetDirect(normalWb.Sheets['Products'], 1, true);
  assert(normalData.rows.length === 5, `Parsed 5 data rows (got ${normalData.rows.length})`);
  assert(normalData.columns.some((c) => c.name === 'ProductName'), 'Has "ProductName" column');
  assert(normalData.rows[0].ProductName === 'Heavy Duty Stapler', 'Row 1 ProductName is "Heavy Duty Stapler"');

  // Test 2: Multiple Sheets & Visibility
  console.log('\n--- 2. Sheet Discovery & Visibility (multiple-sheets.xlsx) ---');
  const multiBuf = fs.readFileSync(path.join(FIXTURES_DIR, 'multiple-sheets.xlsx'));
  const multiWb = XLSX.read(multiBuf, { type: 'buffer' });
  assert(multiWb.SheetNames.length === 3, 'Discovered all 3 sheets');
  assert(multiWb.SheetNames.includes('Products'), 'Contains "Products" sheet');
  assert(multiWb.SheetNames.includes('StockLocations'), 'Contains "StockLocations" sheet');
  assert(multiWb.SheetNames.includes('Suppliers'), 'Contains "Suppliers" sheet');
  const suppMeta = multiWb.Workbook?.Sheets?.find((s: any) => s.name === 'Suppliers');
  assert(suppMeta?.Hidden === 1, 'Suppliers sheet is correctly identified as Hidden');

  // Test 3: Leading Zeros Preservation (CRITICAL)
  console.log('\n--- 3. Leading Zeros Preservation (leading-zero.xlsx) ---');
  const lzBuf = fs.readFileSync(path.join(FIXTURES_DIR, 'leading-zero.xlsx'));
  const lzWb = XLSX.read(lzBuf, { type: 'buffer', cellNF: true, cellText: true });
  const lzData = parseWorksheetDirect(lzWb.Sheets['Barcodes'], 1, true);
  const row1 = lzData.rows[0];
  assert(row1.UPC_Barcode === '001234567890', `UPC '001234567890' preserved with leading zeros (got '${row1.UPC_Barcode}')`);
  assert(row1.BatchCode === '00001234', `BatchCode '00001234' preserved with leading zeros (got '${row1.BatchCode}')`);
  assert(row1.SerialNumber === '00001', `SerialNumber '00001' preserved with leading zeros (got '${row1.SerialNumber}')`);
  const row4 = lzData.rows[3];
  assert(row4.UPC_Barcode === '000000123456', `UPC '000000123456' preserved (got '${row4.UPC_Barcode}')`);

  // Test 4: Excel Date Support
  console.log('\n--- 4. Excel Date Conversion (dates.xlsx) ---');
  const dateBuf = fs.readFileSync(path.join(FIXTURES_DIR, 'dates.xlsx'));
  const dateWb = XLSX.read(dateBuf, { type: 'buffer', cellDates: true, cellNF: true, cellText: true });
  const dateData = parseWorksheetDirect(dateWb.Sheets['DateRecords'], 1, true);
  assert(dateData.rows[0].ProductionDate === '2026-01-15', `ISO Date '2026-01-15' parsed (got '${dateData.rows[0].ProductionDate}')`);
  assert(dateData.rows[0].ExpiryDate === '2028-01-14', `ISO Date '2028-01-14' parsed (got '${dateData.rows[0].ExpiryDate}')`);

  // Test 5: Formula Cells with Cached Results
  console.log('\n--- 5. Formula Cells with Cached Results (formulas.xlsx) ---');
  const formBuf = fs.readFileSync(path.join(FIXTURES_DIR, 'formulas.xlsx'));
  const formWb = XLSX.read(formBuf, { type: 'buffer', cellFormula: true, cellText: true, cellNF: true });
  const formData = parseWorksheetDirect(formWb.Sheets['Formulas'], 1, true);
  assert(formData.rows[0].Total === '500', `Formula cell Total evaluated to cached result '500' (got '${formData.rows[0].Total}')`);
  assert(formData.rows[0].DiscountLabel === 'Save 10%', `Formula cell DiscountLabel evaluated to 'Save 10%' (got '${formData.rows[0].DiscountLabel}')`);
  assert(formData.normalized[0].Total.formula === 'B2*C2', `Formula expression 'B2*C2' retained`);

  // Test 6: Multi-byte Unicode & Hindi
  console.log('\n--- 6. Unicode & Hindi Characters (unicode-hindi.xlsx) ---');
  const uniBuf = fs.readFileSync(path.join(FIXTURES_DIR, 'unicode-hindi.xlsx'));
  const uniWb = XLSX.read(uniBuf, { type: 'buffer' });
  const uniData = parseWorksheetDirect(uniWb.Sheets['IndianProducts'], 1, true);
  assert(uniData.rows[0].ProductNameHindi === 'प्रीमियम चावल 5kg', `Hindi string 'प्रीमियम चावल 5kg' preserved intact (got '${uniData.rows[0].ProductNameHindi}')`);
  assert(uniData.rows[0].PriceTag === '₹450.00', `Indian Rupee currency symbol '₹450.00' preserved (got '${uniData.rows[0].PriceTag}')`);
  assert(uniData.rows[1].ProductNameHindi === 'शुद्ध दाल तूर 1kg', `Hindi string 'शुद्ध दाल तूर 1kg' preserved`);

  // Test 7: Blank Cells Alignment
  console.log('\n--- 7. Blank Cells Structure (blank-cells.xlsx) ---');
  const blankBuf = fs.readFileSync(path.join(FIXTURES_DIR, 'blank-cells.xlsx'));
  const blankWb = XLSX.read(blankBuf, { type: 'buffer' });
  const blankData = parseWorksheetDirect(blankWb.Sheets['SparseData'], 1, true);
  assert(blankData.rows.length === 4, `All 4 rows parsed`);
  assert(blankData.rows[0].MRP === '', 'Blank MRP in Row 1 preserved as empty string');
  assert(blankData.rows[0].Batch === 'B001', 'Batch in Row 1 is B001');
  assert(blankData.rows[1].Batch === '', 'Blank Batch in Row 2 preserved as empty string');
  assert(Object.keys(blankData.rows[0]).length === 4, 'Row 1 has all 4 columns despite blank MRP');

  // Test 8: Duplicate Headers Disambiguation
  console.log('\n--- 8. Duplicate Column Disambiguation (duplicate-headers.xlsx) ---');
  const dupBuf = fs.readFileSync(path.join(FIXTURES_DIR, 'duplicate-headers.xlsx'));
  const dupWb = XLSX.read(dupBuf, { type: 'buffer' });
  const dupData = parseWorksheetDirect(dupWb.Sheets['Duplicates'], 1, true);
  const colNames = dupData.columns.map((c) => c.name);
  assert(colNames.includes('Price'), 'Has first Price column');
  assert(colNames.includes('Price_2'), 'Has deduplicated Price_2 column');
  assert(colNames.includes('SKU'), 'Has first SKU column');
  assert(colNames.includes('SKU_2'), 'Has deduplicated SKU_2 column');
  assert(dupData.rows[0].Price === '100' && dupData.rows[0].Price_2 === '120', 'Row 1 values match respective Price and Price_2');

  // Test 9: Large 10K Rows Paging & Streaming Performance
  console.log('\n--- 9. Large Dataset Paging (large-10k.xlsx) ---');
  const t0 = Date.now();
  const l10Buf = fs.readFileSync(path.join(FIXTURES_DIR, 'large-10k.xlsx'));
  const l10Wb = XLSX.read(l10Buf, { type: 'buffer' });
  const l10Data = parseWorksheetDirect(l10Wb.Sheets['10K_Records'], 1, true);
  const elapsed10k = Date.now() - t0;
  assert(l10Data.rows.length === 10000, `Successfully parsed 10,000 rows (got ${l10Data.rows.length})`);
  assert(elapsed10k < 3000, `10,000 rows parsed in ${elapsed10k}ms (< 3000ms target)`);

  // Simulate IPC Pagination (page 1, size 200)
  const pageSize = 200;
  const page1 = l10Data.rows.slice(0, pageSize);
  assert(page1.length === 200, `Page 1 contains 200 rows`);
  assert(page1[0].SKU === 'SKU-10K-000001', `Page 1 first item is SKU-10K-000001`);
  const page50 = l10Data.rows.slice(49 * pageSize, 50 * pageSize);
  assert(page50.length === 200, `Page 50 contains 200 rows`);
  assert(page50[199].SKU === 'SKU-10K-010000', `Page 50 last item is SKU-10K-010000`);

  // Test 9b: Large 50K Rows Paging & Streaming Performance
  console.log('\n--- 9b. 50K Records Benchmark (large-50k.xlsx) ---');
  const t50_0 = Date.now();
  const l50Buf = fs.readFileSync(path.join(FIXTURES_DIR, 'large-50k.xlsx'));
  const l50Wb = XLSX.read(l50Buf, { type: 'buffer' });
  const l50Data = parseWorksheetDirect(l50Wb.Sheets['50K_Records'], 1, true);
  const elapsed50k = Date.now() - t50_0;
  assert(l50Data.rows.length === 50000, `Successfully parsed 50,000 rows (got ${l50Data.rows.length})`);
  assert(elapsed50k < 15000, `50,000 rows parsed in ${elapsed50k}ms (< 15000ms target)`);
  const page250 = l50Data.rows.slice(249 * pageSize, 250 * pageSize);
  assert(page250.length === 200, `Page 250 contains 200 rows`);
  assert(page250[199].ID === '50000', `Page 250 last item ID is 50000 (got ${page250[199].ID})`);
  assert(page250[199].Barcode === '008900050000', `Page 250 last item Barcode is 008900050000`);

  // Test 10: products.xlsx 22 Enterprise Records
  console.log('\n--- 10. Enterprise Products Master (products.xlsx) ---');
  const prodBuf = fs.readFileSync(path.join(FIXTURES_DIR, 'products.xlsx'));
  const prodWb = XLSX.read(prodBuf, { type: 'buffer' });
  const prodData = parseWorksheetDirect(prodWb.Sheets['Products'], 1, true);
  assert(prodData.rows.length === 22, `Parsed exactly 22 distinct enterprise products (got ${prodData.rows.length})`);
  const requiredCols = ['ProductName', 'SKU', 'MRP', 'BatchNo', 'MfgDate', 'ExpiryDate', 'Barcode', 'QRCode', 'Quantity'];
  for (const rc of requiredCols) {
    assert(prodData.columns.some((c) => c.name === rc), `Column "${rc}" is present`);
  }

  // Test 11: Dynamic Template Binding & Evaluation with evaluateElementData
  console.log('\n--- 11. Designer Data Binding Regression (evaluateElementData) ---');
  const record1 = prodData.rows[0];
  const record2 = prodData.rows[1];

  const textElement: LabelElement = {
    id: 'el-text-1',
    name: 'Product Text',
    type: 'text',
    x: 10,
    y: 10,
    width: 80,
    height: 10,
    text: '{{ProductName}} - MRP: Rs.{{MRP}}',
  };

  const barcodeElement: LabelElement = {
    id: 'el-bc-1',
    name: 'Product Barcode',
    type: 'barcode',
    x: 10,
    y: 25,
    width: 80,
    height: 20,
    value: '{{Barcode}}',
    barcodeType: 'code128',
  };

  const qrElement: LabelElement = {
    id: 'el-qr-1',
    name: 'Product QR',
    type: 'barcode',
    x: 10,
    y: 50,
    width: 25,
    height: 25,
    value: '{{QRCode}}',
    barcodeType: 'qrcode',
  };

  // Evaluate Record 1
  const textVal1 = evaluateElementData(textElement, { record: record1 });
  const bcVal1 = evaluateElementData(barcodeElement, { record: record1 });
  const qrVal1 = evaluateElementData(qrElement, { record: record1 });

  assert(textVal1 === 'Paracetamol 500mg Tablets - MRP: Rs.45.00', `Record 1 Text evaluated: "${textVal1}"`);
  assert(bcVal1 === '008901001001', `Record 1 Barcode evaluated: "${bcVal1}" (leading zeros preserved!)`);
  assert(qrVal1.includes('MED-PCM-500/LOT-901'), `Record 1 QR evaluated: "${qrVal1}"`);

  // Evaluate Record 2
  const textVal2 = evaluateElementData(textElement, { record: record2 });
  const bcVal2 = evaluateElementData(barcodeElement, { record: record2 });
  const qrVal2 = evaluateElementData(qrElement, { record: record2 });

  assert(textVal2 === 'Amoxicillin 250mg Capsules - MRP: Rs.85.50', `Record 2 Text evaluated: "${textVal2}"`);
  assert(bcVal2 === '008901001002', `Record 2 Barcode evaluated: "${bcVal2}"`);
  assert(qrVal2.includes('MED-AMX-250/LOT-902'), `Record 2 QR evaluated: "${qrVal2}"`);
  assert(bcVal1 !== bcVal2, 'Record 1 and Record 2 Barcodes are distinct');

  // Test 12: Quantity Expansion
  console.log('\n--- 12. Quantity Field Multi-Label Expansion ---');
  function expandQty(records: Record<string, string>[], qtyCol: string) {
    const out: Record<string, string>[] = [];
    for (const r of records) {
      const q = parseInt(r[qtyCol] || '1', 10);
      const count = isNaN(q) || q <= 0 ? 1 : q;
      for (let i = 0; i < count; i++) out.push({ ...r });
    }
    return out;
  }
  const sampleSubset = [prodData.rows[0], prodData.rows[1]]; // Row 0 has Qty 2, Row 1 has Qty 3
  const expanded = expandQty(sampleSubset, 'Quantity');
  assert(expanded.length === 5, `2 records with Qty 2 and 3 expanded to 5 labels (got ${expanded.length})`);
  assert(expanded[0].SKU === 'MED-PCM-500' && expanded[1].SKU === 'MED-PCM-500', 'Label 1 & 2 are MED-PCM-500');
  assert(expanded[2].SKU === 'MED-AMX-250' && expanded[4].SKU === 'MED-AMX-250', 'Label 3, 4, 5 are MED-AMX-250');

  // Test 13: Batch Printing Pipeline Distinct Row Iteration
  console.log('\n--- 13. Batch Print Distinct Row Iteration ---');
  const batchPrintedRows: string[] = [];
  for (let i = 0; i < 5; i++) {
    const rec = prodData.rows[i];
    const evaluated = evaluateElementData(barcodeElement, { record: rec, currentRecordIndex: i });
    batchPrintedRows.push(evaluated);
  }
  const uniquePrinted = new Set(batchPrintedRows);
  assert(uniquePrinted.size === 5, `Printed 5 distinct records without duplication (got ${uniquePrinted.size} unique values)`);

  console.log('\n======================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch((e) => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
