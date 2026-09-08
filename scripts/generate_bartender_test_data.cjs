const XLSX = require('xlsx');
const path = require('path');

const data = [
  ['ProductID', 'ProductName', 'Barcode', 'Price', 'Batch', 'ExpiryDate', 'Quantity'],
  ['P-101', 'Industrial Heavy Duty Stapler', '8901234000001', '450.00', 'BAT-2026-A1', '2028-06-30', '5'],
  ['P-102', 'High-Speed Thermal Printhead 300DPI', '001234567890', '1250.00', 'BAT-2026-A2', '2029-12-31', '3'],
  ['P-103', 'Direct Thermal Synthetic Label 50x25', '008901001003', '85.50', 'BAT-2026-B1', '2027-04-15', '10'],
  ['P-104', 'Wax-Resin Thermal Ribbon 110mm x 300m', '008901001004', '320.00', 'BAT-2026-B2', '2028-09-20', '2'],
  ['P-105', 'Rugged Barcode Scanner 2D USB', '8901234000005', '2400.00', 'BAT-2026-C1', '2031-01-10', '1'],
  ['P-106', 'Pharma Cleanroom Gloves Pack of 100', '000012345678', '175.00', 'BAT-2026-C2', '2027-11-25', '4'],
  ['P-107', 'Sterile Alcohol Swabs 70% IPA', '008901001007', '65.00', 'BAT-2026-D1', '2028-03-15', '8'],
];

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet(data);
XLSX.utils.book_append_sheet(wb, ws, 'Products');

XLSX.writeFile(wb, path.resolve('BarTender_Test_Data.xlsx'));
XLSX.writeFile(wb, path.resolve('test-fixtures/BarTender_Test_Data.xlsx'));
console.log('Successfully created BarTender_Test_Data.xlsx in root and test-fixtures/');
