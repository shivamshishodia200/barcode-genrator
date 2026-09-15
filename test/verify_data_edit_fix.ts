import { INITIAL_TEMPLATES } from '../src/services/initialTemplates';
import { evaluateElementData } from '../src/services/dataSourceEngine';
import { formatValueForSymbology, generateBarcodeSVG } from '../src/services/barcodeEngine';
import { BarcodeElement, LabelElement, DataSourceItem } from '../src/types';

console.log('====================================================');
console.log('🧪 VERIFYING DATA EDIT & BARCODE PIPELINE FIXES');
console.log('====================================================\n');

// Test 1: Code 128 with "10850006531238" (as in user screenshot)
console.log('Test 1: Code 128 with "10850006531238"');
const baseTmpl = JSON.parse(JSON.stringify(INITIAL_TEMPLATES[0]));
let elBarcode = baseTmpl.elements.find((e: any) => e.id === 'el-barcode-1') as BarcodeElement;
elBarcode.value = '10850006531238';

const svg1 = generateBarcodeSVG(elBarcode);
if (svg1.includes('Invalid Barcode')) {
  console.error('❌ Test 1 FAILED: SVG returned Invalid Barcode for 10850006531238');
  process.exit(1);
} else {
  console.log('✅ Test 1 PASSED: Code 128 with "10850006531238" generated successfully (len:', svg1.length, ')');
}

// Test 2: Code 128 direct edit to "001"
console.log('\nTest 2: Code 128 direct edit to "001"');
const newInputValue = '001';
const newDs: DataSourceItem = {
  id: `ds-${Date.now()}`,
  name: 'Embedded Data',
  type: 'embedded',
  value: newInputValue,
  enabled: true,
};

const simulatedEl = { ...elBarcode, dataSources: [newDs] };
const compiled = evaluateElementData(simulatedEl as any);

const updates: Partial<LabelElement> = {
  dataSources: [newDs],
  dataBinding: undefined,
  value: compiled || newInputValue,
  barcodeValue: compiled || newInputValue,
  content: compiled || newInputValue,
};

const updatedEl = { ...elBarcode, ...updates } as BarcodeElement;
const updatedEval = evaluateElementData(updatedEl, { record: baseTmpl.sampleRecords[0] });

console.log('Updated Evaluated Value:', updatedEval);
if (updatedEval === '001' && updatedEl.value === '001') {
  console.log('✅ Test 2 PASSED: Code 128 correctly evaluated to "001"');
} else {
  console.error('❌ Test 2 FAILED:', { updatedEval, val: updatedEl.value });
  process.exit(1);
}

// Test 3: generateBarcodeSVG with "001"
console.log('\nTest 3: SVG generation for "001"');
const svg = generateBarcodeSVG(updatedEl);
if (svg.includes('Invalid Barcode')) {
  console.error('❌ Test 3 FAILED: SVG returned Invalid Barcode');
  process.exit(1);
} else {
  console.log('✅ Test 3 PASSED: SVG successfully generated (length:', svg.length, ')');
}

// Test 4: Interleaved 2 of 5 auto-padding for "001"
console.log('\nTest 4: Interleaved 2 of 5 auto-padding');
const i25Val = formatValueForSymbology('interleaved2of5', '001');
if (i25Val === '0001') {
  console.log('✅ Test 4 PASSED: Interleaved 2 of 5 correctly formatted "001" -> "0001"');
} else {
  console.error('❌ Test 4 FAILED:', i25Val);
  process.exit(1);
}

// Test 5: Serialization persistence through Data Edit
console.log('\nTest 5: Serialization preservation in Data Edit');
const serialDs: DataSourceItem = {
  id: 'ds-serial-1',
  name: 'Serial Data',
  type: 'embedded',
  value: 'SN-100',
  serialization: {
    enabled: true,
    action: 'increment',
    method: 'alphanumeric',
    step: 1,
    currentValue: 'SN-100',
  },
};

const serialEl: BarcodeElement = {
  ...elBarcode,
  dataSources: [serialDs],
};

const editedSerialVal = 'SN-500';
const updatedSerialDsList = serialEl.dataSources!.map((ds, idx) => {
  if (idx === 0) {
    const curSerial = ds.serialization;
    return {
      ...ds,
      value: editedSerialVal,
      type: 'embedded' as const,
      ...(curSerial ? { serialization: { ...curSerial, currentValue: editedSerialVal } } : {}),
    };
  }
  return ds;
});

const updatedSerialEl: BarcodeElement = {
  ...serialEl,
  dataSources: updatedSerialDsList,
  value: editedSerialVal,
};

const evalSerial0 = evaluateElementData(updatedSerialEl, { currentRecordIndex: 0 });
const evalSerial1 = evaluateElementData(updatedSerialEl, { currentRecordIndex: 1 });

if (evalSerial0 === 'SN-500' && evalSerial1 === 'SN-501') {
  console.log('✅ Test 5 PASSED: Serialization preserved and incremented from new base');
} else {
  console.error('❌ Test 5 FAILED:', { evalSerial0, evalSerial1 });
  process.exit(1);
}

console.log('\n====================================================');
console.log('🎉 ALL DATA EDIT & BARCODE VERIFICATIONS PASSED!');
console.log('====================================================');
