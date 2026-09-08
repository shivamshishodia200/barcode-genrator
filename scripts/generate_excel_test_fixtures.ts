import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

const FIXTURES_DIR = path.join(process.cwd(), 'test-fixtures');
if (!fs.existsSync(FIXTURES_DIR)) {
  fs.mkdirSync(FIXTURES_DIR, { recursive: true });
}

console.log(`[Fixture Generator] Generating real Excel workbooks in: ${FIXTURES_DIR}`);

// 1. normal.xlsx
{
  const wb = XLSX.utils.book_new();
  const data = [
    ['ProductID', 'ProductName', 'Category', 'Price'],
    ['P1001', 'Heavy Duty Stapler', 'Office Supplies', 450],
    ['P1002', 'Gel Ink Pen Blue 0.5mm', 'Stationery', 25],
    ['P1003', 'A4 Copier Paper 75GSM 500 Sheets', 'Paper', 320],
    ['P1004', 'Permanent Marker Black', 'Stationery', 35],
    ['P1005', 'Steel Ruler 30cm', 'Measuring', 50],
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Products');
  XLSX.writeFile(wb, path.join(FIXTURES_DIR, 'normal.xlsx'));
  console.log('✓ Created normal.xlsx');
}

// 2. multiple-sheets.xlsx
{
  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.aoa_to_sheet([
    ['SKU', 'Title', 'Department'],
    ['SKU-A1', 'Thermal Transfer Ribbon', 'Labeling'],
    ['SKU-A2', 'Direct Thermal Label Roll', 'Labeling'],
  ]);
  const ws2 = XLSX.utils.aoa_to_sheet([
    ['LocationID', 'Zone', 'Aisle', 'Bin'],
    ['LOC-1', 'East Wing', 'A-04', 'B-12'],
    ['LOC-2', 'West Wing', 'C-02', 'D-05'],
  ]);
  const ws3 = XLSX.utils.aoa_to_sheet([
    ['SupplierCode', 'SupplierName', 'Rating'],
    ['SUP-01', 'Avery Dennison Partner', 'A+'],
    ['SUP-02', 'Zebra Technologies Distributor', 'Tier-1'],
  ]);

  XLSX.utils.book_append_sheet(wb, ws1, 'Products');
  XLSX.utils.book_append_sheet(wb, ws2, 'StockLocations');
  XLSX.utils.book_append_sheet(wb, ws3, 'Suppliers');

  // Mark Suppliers as hidden
  if (!wb.Workbook) wb.Workbook = { Sheets: [] };
  wb.Workbook.Sheets = [
    { name: 'Products', Hidden: 0 },
    { name: 'StockLocations', Hidden: 0 },
    { name: 'Suppliers', Hidden: 1 }, // Hidden sheet
  ];

  XLSX.writeFile(wb, path.join(FIXTURES_DIR, 'multiple-sheets.xlsx'));
  console.log('✓ Created multiple-sheets.xlsx (with hidden Suppliers sheet)');
}

// 3. leading-zero.xlsx
{
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ['ItemID', 'UPC_Barcode', 'BatchCode', 'SerialNumber'],
    ['1', '001234567890', '00001234', '00001'],
    ['2', '008500065312', '00005678', '00002'],
    ['3', '009876543210', '00009999', '00003'],
    ['4', '000000123456', 'LOT00042', '00100'],
  ]);
  XLSX.utils.book_append_sheet(wb, ws, 'Barcodes');
  XLSX.writeFile(wb, path.join(FIXTURES_DIR, 'leading-zero.xlsx'));
  console.log('✓ Created leading-zero.xlsx (text leading zeros preserved)');
}

// 4. dates.xlsx
{
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ['BatchID', 'ProductionDate', 'ExpiryDate', 'InspectionDate'],
    ['B-101', '2026-01-15', '2028-01-14', 46000],
    ['B-102', '2026-02-20', '2028-02-19', 46036],
    ['B-103', '2026-03-10', '2028-03-09', 46054],
  ]);
  XLSX.utils.book_append_sheet(wb, ws, 'DateRecords');
  XLSX.writeFile(wb, path.join(FIXTURES_DIR, 'dates.xlsx'));
  console.log('✓ Created dates.xlsx');
}

// 5. formulas.xlsx
{
  const wb = XLSX.utils.book_new();
  const ws: XLSX.WorkSheet = {
    '!ref': 'A1:E4',
    A1: { t: 's', v: 'Item' },
    B1: { t: 's', v: 'Qty' },
    C1: { t: 's', v: 'UnitPrice' },
    D1: { t: 's', v: 'Total' },
    E1: { t: 's', v: 'DiscountLabel' },

    A2: { t: 's', v: 'Widget A' },
    B2: { t: 'n', v: 5 },
    C2: { t: 'n', v: 100 },
    D2: { t: 'n', f: 'B2*C2', v: 500, w: '500' }, // Cached calculated result 500
    E2: { t: 's', f: 'CONCATENATE("Save ", 10, "%")', v: 'Save 10%', w: 'Save 10%' },

    A3: { t: 's', v: 'Widget B' },
    B3: { t: 'n', v: 2 },
    C3: { t: 'n', v: 250 },
    D3: { t: 'n', f: 'B3*C3', v: 500, w: '500' },
    E3: { t: 's', f: 'CONCATENATE("Save ", 15, "%")', v: 'Save 15%', w: 'Save 15%' },

    A4: { t: 's', v: 'Widget C' },
    B4: { t: 'n', v: 10 },
    C4: { t: 'n', v: 80 },
    D4: { t: 'n', f: 'B4*C4', v: 800, w: '800' },
    E4: { t: 's', f: 'CONCATENATE("Save ", 5, "%")', v: 'Save 5%', w: 'Save 5%' },
  };
  XLSX.utils.book_append_sheet(wb, ws, 'Formulas');
  XLSX.writeFile(wb, path.join(FIXTURES_DIR, 'formulas.xlsx'));
  console.log('✓ Created formulas.xlsx (with cached calculated values)');
}

// 6. unicode-hindi.xlsx
{
  const wb = XLSX.utils.book_new();
  const data = [
    ['ItemCode', 'ProductNameHindi', 'EnglishDescription', 'PriceTag'],
    ['IND-001', 'प्रीमियम चावल 5kg', 'Premium Basmati Rice 5kg', '₹450.00'],
    ['IND-002', 'शुद्ध दाल तूर 1kg', 'Pure Toor Dal 1kg', '₹165.00'],
    ['IND-003', 'चक्की फ्रेश आटा 10kg', 'Chakki Fresh Atta 10kg', '₹380.00'],
    ['IND-004', 'हल्दी पाउडर 200g', 'Turmeric Powder 200g', '₹55.00'],
    ['IND-005', 'लाल मिर्च पाउडर 500g', 'Red Chilli Powder 500g', '₹140.00'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'IndianProducts');
  XLSX.writeFile(wb, path.join(FIXTURES_DIR, 'unicode-hindi.xlsx'));
  console.log('✓ Created unicode-hindi.xlsx (Hindi text & ₹ symbols)');
}

// 7. blank-cells.xlsx
{
  const wb = XLSX.utils.book_new();
  const data = [
    ['Product', 'MRP', 'Batch', 'Notes'],
    ['Product Alpha', '', 'B001', 'Discounted'],
    ['Product Beta', '120', '', 'New Arrival'],
    ['Product Gamma', '', '', 'Clearance'],
    ['Product Delta', '350', 'B004', ''],
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'SparseData');
  XLSX.writeFile(wb, path.join(FIXTURES_DIR, 'blank-cells.xlsx'));
  console.log('✓ Created blank-cells.xlsx (empty cells preserved in row schema)');
}

// 8. duplicate-headers.xlsx
{
  const wb = XLSX.utils.book_new();
  const data = [
    ['Price', 'Price', 'SKU', 'SKU', 'Description'],
    ['100', '120', 'SKU-001', 'ALT-001', 'Product with dual prices'],
    ['200', '240', 'SKU-002', 'ALT-002', 'Product 2 with dual prices'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Duplicates');
  XLSX.writeFile(wb, path.join(FIXTURES_DIR, 'duplicate-headers.xlsx'));
  console.log('✓ Created duplicate-headers.xlsx (Price, Price duplicate headers)');
}

// 9. large-10k.xlsx (10,000 real rows)
{
  const wb = XLSX.utils.book_new();
  const rows: any[][] = [['Index', 'SKU', 'ProductName', 'Category', 'MRP', 'Stock', 'Barcode']];
  for (let i = 1; i <= 10000; i++) {
    const pad = String(i).padStart(6, '0');
    rows.push([
      i,
      `SKU-10K-${pad}`,
      `Warehouse Item #${i}`,
      i % 2 === 0 ? 'Industrial Parts' : 'Consumer Goods',
      (10 + (i % 500) * 1.5).toFixed(2),
      (i * 3) % 250,
      `890${pad}123`,
    ]);
  }
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, '10K_Records');
  XLSX.writeFile(wb, path.join(FIXTURES_DIR, 'large-10k.xlsx'));
  console.log('✓ Created large-10k.xlsx (10,000 rows)');
}

// 10. large-50k.xlsx (50,000 real rows)
{
  const wb = XLSX.utils.book_new();
  const rows: any[][] = [['ID', 'Barcode', 'Batch', 'WeightKg', 'Location']];
  for (let i = 1; i <= 50000; i++) {
    const pad = String(i).padStart(7, '0');
    rows.push([
      i,
      `00890${pad}`,
      `LOT-${(i % 100) + 1}`,
      (0.5 + (i % 50) * 0.1).toFixed(2),
      `Aisle-${(i % 20) + 1}-Shelf-${(i % 10) + 1}`,
    ]);
  }
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, '50K_Records');
  XLSX.writeFile(wb, path.join(FIXTURES_DIR, 'large-50k.xlsx'));
  console.log('✓ Created large-50k.xlsx (50,000 rows)');
}

// 11. products.xlsx (Requirement 41: At least 20 DIFFERENT enterprise records)
{
  const wb = XLSX.utils.book_new();
  const products = [
    ['ProductName', 'SKU', 'MRP', 'BatchNo', 'MfgDate', 'ExpiryDate', 'Barcode', 'QRCode', 'Quantity'],
    ['Paracetamol 500mg Tablets', 'MED-PCM-500', '45.00', 'LOT-901', '2026-01-10', '2028-01-09', '008901001001', 'https://udi.pharma.org/MED-PCM-500/LOT-901', '2'],
    ['Amoxicillin 250mg Capsules', 'MED-AMX-250', '85.50', 'LOT-902', '2026-01-12', '2028-01-11', '008901001002', 'https://udi.pharma.org/MED-AMX-250/LOT-902', '3'],
    ['Cough Syrup 100ml Mint', 'MED-CS-100', '110.00', 'LOT-903', '2026-01-15', '2027-07-14', '008901001003', 'https://udi.pharma.org/MED-CS-100/LOT-903', '1'],
    ['Vitamin C 1000mg Chewable', 'MED-VTC-100', '150.00', 'LOT-904', '2026-01-20', '2028-01-19', '008901001004', 'https://udi.pharma.org/MED-VTC-100/LOT-904', '4'],
    ['Antiseptic Liquid 250ml', 'MED-ASL-250', '95.00', 'LOT-905', '2026-02-01', '2028-01-31', '008901001005', 'https://udi.pharma.org/MED-ASL-250/LOT-905', '2'],
    ['Adhesive Bandages Pack of 50', 'MED-BND-050', '65.00', 'LOT-906', '2026-02-05', '2029-02-04', '008901001006', 'https://udi.pharma.org/MED-BND-050/LOT-906', '5'],
    ['Digital Thermometer Pro', 'DEV-THM-001', '350.00', 'LOT-907', '2026-02-10', '2031-02-09', '008901001007', 'https://udi.pharma.org/DEV-THM-001/LOT-907', '1'],
    ['Surgical Face Mask 3-Ply', 'MED-MSK-050', '120.00', 'LOT-908', '2026-02-15', '2029-02-14', '008901001008', 'https://udi.pharma.org/MED-MSK-050/LOT-908', '3'],
    ['Hand Sanitizer Gel 500ml', 'SAN-GEL-500', '180.00', 'LOT-909', '2026-02-20', '2028-02-19', '008901001009', 'https://udi.pharma.org/SAN-GEL-500/LOT-909', '2'],
    ['Eye Drops Lubricant 10ml', 'MED-EYD-010', '135.00', 'LOT-910', '2026-02-25', '2027-08-24', '008901001010', 'https://udi.pharma.org/MED-EYD-010/LOT-910', '2'],
    ['Ibuprofen 400mg Tablets', 'MED-IBU-400', '55.00', 'LOT-911', '2026-03-01', '2028-02-28', '008901001011', 'https://udi.pharma.org/MED-IBU-400/LOT-911', '1'],
    ['Pain Relief Gel 30g', 'MED-PRG-030', '75.00', 'LOT-912', '2026-03-05', '2028-03-04', '008901001012', 'https://udi.pharma.org/MED-PRG-030/LOT-912', '2'],
    ['Zincovit Multivitamin 30s', 'MED-ZNC-030', '115.00', 'LOT-913', '2026-03-10', '2028-03-09', '008901001013', 'https://udi.pharma.org/MED-ZNC-030/LOT-913', '3'],
    ['Omeprazole 20mg Capsules', 'MED-OMP-020', '68.00', 'LOT-914', '2026-03-15', '2028-03-14', '008901001014', 'https://udi.pharma.org/MED-OMP-020/LOT-914', '4'],
    ['Cetirizine 10mg Tablets', 'MED-CTZ-010', '42.00', 'LOT-915', '2026-03-20', '2028-03-19', '008901001015', 'https://udi.pharma.org/MED-CTZ-010/LOT-915', '2'],
    ['Cotton Gauze Swab 10x10', 'MED-GZ-1010', '85.00', 'LOT-916', '2026-03-25', '2030-03-24', '008901001016', 'https://udi.pharma.org/MED-GZ-1010/LOT-916', '5'],
    ['Hydrogen Peroxide 3% 100ml', 'MED-H2O-100', '38.00', 'LOT-917', '2026-04-01', '2028-03-31', '008901001017', 'https://udi.pharma.org/MED-H2O-100/LOT-917', '2'],
    ['Nasal Decongestant Spray 15ml', 'MED-NS-015', '125.00', 'LOT-918', '2026-04-05', '2027-10-04', '008901001018', 'https://udi.pharma.org/MED-NS-015/LOT-918', '1'],
    ['Calcium + D3 Tablets 60s', 'MED-CAL-060', '220.00', 'LOT-919', '2026-04-10', '2028-04-09', '008901001019', 'https://udi.pharma.org/MED-CAL-060/LOT-919', '3'],
    ['Blood Glucose Test Strips 50s', 'DEV-GLU-050', '850.00', 'LOT-920', '2026-04-15', '2027-10-14', '008901001020', 'https://udi.pharma.org/DEV-GLU-050/LOT-920', '2'],
    ['Latex Examination Gloves M', 'DEV-GLV-100', '420.00', 'LOT-921', '2026-04-20', '2031-04-19', '008901001021', 'https://udi.pharma.org/DEV-GLV-100/LOT-921', '4'],
    ['Sterile Crepe Bandage 15cm', 'MED-CRB-015', '90.00', 'LOT-922', '2026-04-25', '2030-04-24', '008901001022', 'https://udi.pharma.org/MED-CRB-015/LOT-922', '2'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(products);
  XLSX.utils.book_append_sheet(wb, ws, 'Products');
  XLSX.writeFile(wb, path.join(FIXTURES_DIR, 'products.xlsx'));
  console.log('✓ Created products.xlsx (22 distinct products with all required columns)');
}

console.log('[Fixture Generator] All 11 real Excel test workbooks generated successfully.');
