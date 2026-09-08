import {
  stepNumeric,
  stepAlphabetic,
  stepAlphanumeric,
  evaluateSerializedValue,
  generatePreviewSequence,
  AtomicSerialReservationService,
} from '../src/services/serializationEngine';
import {
  executeEnterpriseTransformPipeline,
  applyDataTypeFormatting,
  applyCharacterTemplate,
} from '../src/services/transformEngine';
import { evaluateTextElement, evaluateElementData } from '../src/services/dataSourceEngine';
import { TextElement, SerializationConfig, TransformConfig } from '../src/types/index';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  ✗ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

console.log('================================================================');
console.log('  ENTERPRISE TEXT PROPERTIES, TRANSFORMS & SERIALIZATION SUITE  ');
console.log('================================================================\n');

// 1. Numeric Serialization Tests
console.log('--- Test 1: Numeric Serialization ---');
assert(stepNumeric('0001', 1) === '0002', '0001 -> 0002 (Preserves leading zeros)');
assert(stepNumeric('0009', 1) === '0010', '0009 -> 0010 (Carry with padding)');
assert(stepNumeric('100', 5) === '105', 'Step 5 increment: 100 -> 105');
assert(stepNumeric('105', 5) === '110', 'Step 5 increment: 105 -> 110');
assert(stepNumeric('100', -5) === '95', 'Decrement: 100 -> 95');
assert(stepNumeric('95', -5) === '90', 'Decrement: 95 -> 90');

// 2. Alphabetic Serialization Tests
console.log('\n--- Test 2: Alphabetic Serialization ---');
assert(stepAlphabetic('A', 1) === 'B', 'A -> B');
assert(stepAlphabetic('Z', 1) === 'AA', 'Z -> AA (Base-26 carry)');
assert(stepAlphabetic('AA', 1) === 'AB', 'AA -> AB');
assert(stepAlphabetic('AZ', 1) === 'BA', 'AZ -> BA');
assert(stepAlphabetic('z', 1, true) === 'aa', 'z -> aa (Lowercase base-26 carry)');

// 3. Alphanumeric Serialization Tests
console.log('\n--- Test 3: Alphanumeric Serialization ---');
assert(stepAlphanumeric('A009', 1) === 'A010', 'A009 -> A010');
assert(stepAlphanumeric('A999', 1) === 'B000', 'A999 -> B000 (Alphanumeric carry into prefix)');

// 4. When to Increment (Event Type & Intervals)
console.log('\n--- Test 4: Event Interval & Modes ---');
const intervalConfig: SerializationConfig = {
  action: 'increment',
  method: 'numeric',
  preserveCharacters: true,
  incrementBy: 1,
  event: 'interval',
  eventInterval: 2,
  copies: 1,
};
assert(evaluateSerializedValue('001', intervalConfig, { printIndex: 0 }) === '001', 'Interval 2, Item 0 => 001');
assert(evaluateSerializedValue('001', intervalConfig, { printIndex: 1 }) === '001', 'Interval 2, Item 1 => 001');
assert(evaluateSerializedValue('001', intervalConfig, { printIndex: 2 }) === '002', 'Interval 2, Item 2 => 002');
assert(evaluateSerializedValue('001', intervalConfig, { printIndex: 3 }) === '002', 'Interval 2, Item 3 => 002');
assert(evaluateSerializedValue('001', intervalConfig, { printIndex: 4 }) === '003', 'Interval 2, Item 4 => 003');

const recordConfig: SerializationConfig = {
  action: 'increment',
  method: 'numeric',
  preserveCharacters: true,
  incrementBy: 1,
  event: 'record',
  eventInterval: 1,
  copies: 3,
};
assert(evaluateSerializedValue('001', recordConfig, { recordIndex: 0, copyIndex: 0 }) === '001', 'Record 0 Copy 0 => 001');
assert(evaluateSerializedValue('001', recordConfig, { recordIndex: 0, copyIndex: 1 }) === '001', 'Record 0 Copy 1 => 001');
assert(evaluateSerializedValue('001', recordConfig, { recordIndex: 0, copyIndex: 2 }) === '001', 'Record 0 Copy 2 => 001');
assert(evaluateSerializedValue('001', recordConfig, { recordIndex: 1, copyIndex: 0 }) === '002', 'Record 1 Copy 0 => 002');
assert(evaluateSerializedValue('001', recordConfig, { recordIndex: 2, copyIndex: 0 }) === '003', 'Record 2 Copy 0 => 003');

// 5. Transform Pipeline Tests
console.log('\n--- Test 5: Enterprise Transform Pipeline ---');
// Template Masking
assert(applyCharacterTemplate('ABC1234', 'AAA-9999') === 'ABC-1234', 'Template AAA-9999 on ABC1234 -> ABC-1234');
// Data Type Formatting
assert(applyDataTypeFormatting('12.5', { dataType: 'number', decimalPlaces: 2, leadingZeros: 5 }) === '00012.50', 'Format 12.5 -> 00012.50');
assert(applyDataTypeFormatting('450', { dataType: 'currency', currencySymbol: 'Rs.', currencySymbolPosition: 'prefix' }) === 'Rs.450.00', 'Format Currency Rs.450.00');

// Full deterministic pipeline
const transConfig: TransformConfig = {
  characterFilter: { type: 'alphanumeric' },
  searchReplace: [{ find: 'test', replace: 'PROD', caseSensitive: false }],
  prefixSuffix: { prefix: 'SN-', suffix: '/26' },
};
const transResult = executeEnterpriseTransformPipeline('test#123', transConfig);
assert(transResult === 'SN-PROD123/26', 'Full Transform Pipeline: test#123 -> SN-PROD123/26');

// 6. Multi-Data Source Concatenation
console.log('\n--- Test 6: Multi-Data Source Concatenation ---');
const multiSourceElement: TextElement = {
  id: 'txt-multi',
  name: 'Multi Source Text',
  type: 'text',
  text: '',
  x: 10,
  y: 10,
  width: 50,
  height: 10,
  rotation: 0,
  locked: false,
  visible: true,
  opacity: 1,
  zIndex: 1,
  fontFamily: 'Arial',
  fontSize: 12,
  fontWeight: 'bold',
  fontStyle: 'normal',
  textDecoration: 'none',
  textAlign: 'left',
  verticalAlign: 'top',
  color: '#000000',
  lineHeight: 1.15,
  letterSpacing: 0,
  dataSources: [
    { id: 'ds1', name: 'Prefix', type: 'embedded', value: 'LOT: ', enabled: true },
    { id: 'ds2', name: 'BatchField', type: 'database-field', field: 'Batch', value: '', enabled: true },
    { id: 'ds3', name: 'Divider', type: 'embedded', value: ' / EXP: ', enabled: true },
    { id: 'ds4', name: 'ExpField', type: 'database-field', field: 'ExpiryDate', value: '', enabled: true },
  ],
};
const evalMulti = evaluateTextElement(multiSourceElement, {
  record: { Batch: 'B202609', ExpiryDate: '2027-09-01' },
});
assert(evalMulti === 'LOT: B202609 / EXP: 2027-09-01', 'Concatenation: LOT: B202609 / EXP: 2027-09-01');

// 7. Non-Destructive Preview Sequence
console.log('\n--- Test 7: Non-Destructive Preview Sequence ---');
const serialCfg: SerializationConfig = {
  action: 'increment',
  method: 'alphanumeric',
  preserveCharacters: true,
  incrementBy: 1,
  event: 'item',
  eventInterval: 1,
  copies: 10,
};
const previewSeq = generatePreviewSequence('000001', serialCfg, { prefix: 'SN-', copies: 10 });
assert(previewSeq.length === 10, 'Preview sequence generated 10 items');
assert(previewSeq[0].finalValue === 'SN-000001', 'Item 1 is SN-000001');
assert(previewSeq[4].finalValue === 'SN-000005', 'Item 5 is SN-000005');
assert(previewSeq[9].finalValue === 'SN-000010', 'Item 10 is SN-000010');

// Re-run to verify non-destructive nature
const previewSeq2 = generatePreviewSequence('000001', serialCfg, { prefix: 'SN-', copies: 10 });
assert(previewSeq2[0].finalValue === 'SN-000001', 'Re-opened preview still starts at SN-000001 (Non-destructive)');

// 8. Phase 29 End-to-End Test Workflow
console.log('\n--- Phase 29 End-to-End Workflow Verification ---');
const e2eTextElement: TextElement = {
  id: 'e2e-text',
  name: 'Serial Label Text',
  type: 'text',
  text: '000001',
  x: 12.3,
  y: 11.3,
  width: 50,
  height: 25,
  rotation: 25,
  locked: false,
  visible: true,
  opacity: 1,
  zIndex: 1,
  fontFamily: 'Arial',
  fontSize: 18,
  fontWeight: 'bold',
  fontStyle: 'normal',
  textDecoration: 'none',
  textAlign: 'left',
  verticalAlign: 'top',
  color: '#000000',
  lineHeight: 1.15,
  letterSpacing: 0,
  borderConfig: {
    type: 'rectangle',
    thickness: 1,
    color: '#000000',
    dashStyle: 'solid',
    fillColor: '#ffffff',
  },
  dataSources: [
    {
      id: 'ds-serial',
      name: 'Serial Source',
      type: 'embedded',
      value: '000001',
      enabled: true,
      serialization: {
        action: 'increment',
        method: 'alphanumeric',
        preserveCharacters: true,
        incrementBy: 1,
        event: 'item',
        eventInterval: 1,
        copies: 10,
      },
      prefixSuffix: {
        prefix: 'SN-',
      },
    },
  ],
};

// Verify Element Evaluation for Record 0..9
for (let i = 0; i < 10; i++) {
  const evaluated = evaluateElementData(e2eTextElement, { printIndex: i });
  const expected = `SN-${String(i + 1).padStart(6, '0')}`;
  assert(evaluated === expected, `Print index ${i} evaluated to ${expected}`);
}

// Next batch starts at SN-000011
const nextBatchFirst = evaluateElementData(e2eTextElement, { printIndex: 10 });
assert(nextBatchFirst === 'SN-000011', 'Next batch begins at SN-000011 without collision');

console.log('\n================================================================');
console.log('  ALL REQUIRED TEXT PROPERTIES & SERIALIZATION TESTS PASSED!    ');
console.log('================================================================\n');
