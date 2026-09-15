import {
  stepAlphabetic,
  stepAlphabeticWithAlphabet,
  stepHexadecimal,
  stepCustomSequence,
  stepNumeric,
  stepAlphanumeric,
  evaluateSerializedValue,
  generatePreviewSequence,
  computeNextSerialValue,
  advanceTemplateSerialState,
  AtomicSerialReservationService,
} from '../src/services/serializationEngine';
import { createPrintPlan } from '../src/services/printPlanService';
import { LabelTemplate, SerializationConfig } from '../src/types';

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    console.log(`  \x1b[32m✔ PASS\x1b[0m: ${testName}`);
    testsPassed++;
  } else {
    console.error(`  \x1b[31m✘ FAIL\x1b[0m: ${testName}`);
    if (details) console.error(`    -> Details: ${details}`);
    testsFailed++;
  }
}

async function runTestSuite() {
  console.log('\n=============================================================');
  console.log('🚀 BARCODEFLOW ENTERPRISE SERIALIZATION PRODUCTION TEST SUITE');
  console.log('=============================================================\n');

  // =========================================================================
  // 1. Core Stepping Algorithms
  // =========================================================================
  console.log('--- 1. Stepping Engine & Character Preservation ---');

  assert(stepNumeric('0001', 1, true) === '0002', 'Numeric increment with leading zeros: 0001 + 1 -> 0002');
  assert(stepNumeric('0099', 1, true) === '0100', 'Numeric rollover with leading zeros: 0099 + 1 -> 0100');
  assert(stepNumeric('0010', -1, true) === '0009', 'Numeric decrement with leading zeros: 0010 - 1 -> 0009');
  assert(stepNumeric('0', -5, true) === '0', 'Numeric decrement floor: 0 - 5 -> 0');

  assert(stepAlphabetic('A', 1) === 'B', 'Alphabetic increment: A -> B');
  assert(stepAlphabetic('Z', 1) === 'AA', 'Alphabetic rollover: Z -> AA');
  assert(stepAlphabetic('AZ', 1) === 'BA', 'Alphabetic 2-letter rollover: AZ -> BA');
  assert(stepAlphabetic('ZZ', 1) === 'AAA', 'Alphabetic 2-to-3 letter rollover: ZZ -> AAA');
  assert(stepAlphabetic('a', 1, true) === 'b', 'Alphabetic lowercase increment: a -> b');
  assert(stepAlphabetic('z', 1, true) === 'aa', 'Alphabetic lowercase rollover: z -> aa');

  assert(stepAlphanumeric('SN-001', 1, true) === 'SN-002', 'Alphanumeric with prefix: SN-001 -> SN-002');
  assert(stepAlphanumeric('BOX-999', 1, true) === 'BOX-1000', 'Alphanumeric prefix overflow: BOX-999 -> BOX-1000');
  assert(stepAlphanumeric('A009', 1, true) === 'A010', 'Alphanumeric prefix + padded: A009 -> A010');
  assert(stepAlphanumeric('A999', 1, true) === 'B000', 'Alphanumeric prefix rollover: A999 -> B000');
  assert(stepAlphanumeric('Z999', 1, true) === 'AA000', 'Alphanumeric multi-level rollover: Z999 -> AA000');
  // Decrement Underflow and Rollover Tests
  assert(stepAlphanumeric('B000', -1, true) === 'A999', 'Alphanumeric decrement prefix rollback: B000 - 1 -> A999');
  assert(stepAlphanumeric('AA000', -1, true) === 'Z999', 'Alphanumeric decrement multi-level rollback: AA000 - 1 -> Z999');
  assert(stepAlphanumeric('A010', -1, true) === 'A009', 'Alphanumeric decrement with padding: A010 - 1 -> A009');
  // Hexadecimal Stepping Tests
  assert(stepHexadecimal('000F', 1, false, true) === '0010', 'Hexadecimal increment with carry: 000F + 1 -> 0010');
  assert(stepHexadecimal('0010', -1, false, true) === '000F', 'Hexadecimal decrement with borrow: 0010 - 1 -> 000F');
  assert(stepHexadecimal('0009', 1, false, true) === '000A', 'Hexadecimal transition from 9 to A: 0009 + 1 -> 000A');
  assert(stepHexadecimal('000f', 1, true, true) === '0010', 'Hexadecimal lowercase increment: 000f + 1 -> 0010');
  assert(stepHexadecimal('HEX-00FF', 1, false, true) === 'HEX-0100', 'Hexadecimal with prefix: HEX-00FF + 1 -> HEX-0100');

  // Alphabetic Letter Exclusion Tests (BarTender Parity)
  const alphaNoIO = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  assert(stepAlphabeticWithAlphabet('H', alphaNoIO, 1) === 'J', 'Alphabetic without I and O skips I: H + 1 -> J');
  assert(stepAlphabeticWithAlphabet('N', alphaNoIO, 1) === 'P', 'Alphabetic without I and O skips O: N + 1 -> P');
  assert(stepAlphabeticWithAlphabet('P', alphaNoIO, -1) === 'N', 'Alphabetic without I and O decrement skips O: P - 1 -> N');
  assert(stepAlphabeticWithAlphabet('Z', alphaNoIO, 1) === 'AA', 'Alphabetic without I and O rollover: Z + 1 -> AA');

  const alphaNoL = 'abcdefghijkmnopqrstuvwxyz';
  assert(stepAlphabeticWithAlphabet('k', alphaNoL, 1) === 'm', 'Alphabetic lowercase without l skips l: k + 1 -> m');
  assert(stepAlphabeticWithAlphabet('m', alphaNoL, -1) === 'k', 'Alphabetic lowercase without l decrement skips l: m - 1 -> k');

  // Custom Sequence Stepping Tests
  const customSeq = '0123456789ABCDEF';
  assert(stepCustomSequence('000F', customSeq, 1, true) === '0010', 'Custom sequence increment: 000F + 1 -> 0010');
  assert(stepCustomSequence('0010', customSeq, -1, true) === '000F', 'Custom sequence decrement: 0010 - 1 -> 000F');

  // =========================================================================
  // 2. Complex Serialization Evaluation Rules
  // =========================================================================
  console.log('\n--- 2. Serialization Evaluation (Intervals, Copies, Decrement, Stepping) ---');

  const configDecrement1: SerializationConfig = {
    action: 'decrement',
    method: 'numeric',
    incrementBy: 1,
    event: 'standard',
    preserveCharacters: true,
  };
  assert(
    evaluateSerializedValue('100', configDecrement1, { printIndex: 0 }) === '100' &&
    evaluateSerializedValue('100', configDecrement1, { printIndex: 1 }) === '099' &&
    evaluateSerializedValue('100', configDecrement1, { printIndex: 5 }) === '095',
    'Decrement By 1 progression (Preserve characters): 100 -> 099 -> 095'
  );

  const configDecrementNoPreserve: SerializationConfig = {
    action: 'decrement',
    method: 'numeric',
    incrementBy: 1,
    event: 'standard',
    preserveCharacters: false,
  };
  assert(
    evaluateSerializedValue('100', configDecrementNoPreserve, { printIndex: 0 }) === '100' &&
    evaluateSerializedValue('100', configDecrementNoPreserve, { printIndex: 1 }) === '99' &&
    evaluateSerializedValue('100', configDecrementNoPreserve, { printIndex: 5 }) === '95',
    'Decrement By 1 progression (No preserve characters): 100 -> 99 -> 95'
  );

  const configIncrement2: SerializationConfig = {
    action: 'increment',
    method: 'numeric',
    incrementBy: 2,
    event: 'standard',
    preserveCharacters: true,
  };
  assert(
    evaluateSerializedValue('100', configIncrement2, { printIndex: 0 }) === '100' &&
    evaluateSerializedValue('100', configIncrement2, { printIndex: 1 }) === '102' &&
    evaluateSerializedValue('100', configIncrement2, { printIndex: 5 }) === '110',
    'Increment By 2 progression: 100 -> 102 -> 110'
  );

  const configCopies2: SerializationConfig = {
    action: 'increment',
    method: 'numeric',
    incrementBy: 1,
    copies: 2,
    event: 'standard',
    preserveCharacters: true,
  };
  assert(
    evaluateSerializedValue('001', configCopies2, { printIndex: 0 }) === '001' &&
    evaluateSerializedValue('001', configCopies2, { printIndex: 1 }) === '001' &&
    evaluateSerializedValue('001', configCopies2, { printIndex: 2 }) === '002' &&
    evaluateSerializedValue('001', configCopies2, { printIndex: 3 }) === '002',
    'Copies per serial value (2 copies each): 001, 001, 002, 002'
  );

  const configInterval3: SerializationConfig = {
    action: 'increment',
    method: 'numeric',
    incrementBy: 1,
    event: 'interval',
    eventInterval: 3,
    preserveCharacters: true,
  };
  assert(
    evaluateSerializedValue('10', configInterval3, { printIndex: 0 }) === '10' &&
    evaluateSerializedValue('10', configInterval3, { printIndex: 1 }) === '10' &&
    evaluateSerializedValue('10', configInterval3, { printIndex: 2 }) === '10' &&
    evaluateSerializedValue('10', configInterval3, { printIndex: 3 }) === '11',
    'Event Interval 3 progression: 10, 10, 10, 11'
  );

  // Method & Letters Evaluation Tests
  const configHex: SerializationConfig = {
    action: 'increment',
    method: 'hexadecimal',
    incrementBy: 1,
    event: 'standard',
    preserveCharacters: true,
  };
  assert(
    evaluateSerializedValue('000E', configHex, { printIndex: 0 }) === '000E' &&
    evaluateSerializedValue('000E', configHex, { printIndex: 1 }) === '000F' &&
    evaluateSerializedValue('000E', configHex, { printIndex: 2 }) === '0010',
    'Hexadecimal evaluation: 000E -> 000F -> 0010'
  );

  const configAlphaNoIO: SerializationConfig = {
    action: 'increment',
    method: 'alphabetic',
    letterCase: 'uppercase_no_io',
    incrementBy: 1,
    event: 'standard',
  };
  assert(
    evaluateSerializedValue('H', configAlphaNoIO, { printIndex: 0 }) === 'H' &&
    evaluateSerializedValue('H', configAlphaNoIO, { printIndex: 1 }) === 'J' &&
    evaluateSerializedValue('H', configAlphaNoIO, { printIndex: 2 }) === 'K',
    'Alphabetic without I and O evaluation: H -> J -> K (skips I)'
  );

  const configCustom: SerializationConfig = {
    action: 'increment',
    method: 'custom',
    customSequence: '0123456789ABCDEF',
    incrementBy: 1,
    event: 'standard',
    preserveCharacters: true,
  };
  assert(
    evaluateSerializedValue('000F', configCustom, { printIndex: 0 }) === '000F' &&
    evaluateSerializedValue('000F', configCustom, { printIndex: 1 }) === '0010',
    'Custom sequence evaluation: 000F -> 0010'
  );

  // Dynamic Value Source Bindings (Database Field & Named Source)
  const configDynamicStep: SerializationConfig = {
    action: 'increment',
    method: 'numeric',
    incrementBy: 1,
    incrementBySource: {
      sourceType: 'database',
      value: 1,
      databaseField: 'StepSize',
    },
    event: 'standard',
    preserveCharacters: true,
  };
  assert(
    evaluateSerializedValue('100', configDynamicStep, {
      printIndex: 1,
      record: { StepSize: '5' },
    }) === '105',
    'Dynamic step resolution from database field (StepSize=5): 100 -> 105'
  );

  const configDynamicCopies: SerializationConfig = {
    action: 'increment',
    method: 'numeric',
    incrementBy: 1,
    copies: 1,
    copiesSource: {
      sourceType: 'named_source',
      value: 1,
      namedSource: 'BatchMultiplier',
    },
    event: 'standard',
    preserveCharacters: true,
  };
  assert(
    evaluateSerializedValue('001', configDynamicCopies, {
      printIndex: 1,
      namedSources: { BatchMultiplier: '2' },
    }) === '001' &&
    evaluateSerializedValue('001', configDynamicCopies, {
      printIndex: 2,
      namedSources: { BatchMultiplier: '2' },
    }) === '002',
    'Dynamic copies resolution from named data source (BatchMultiplier=2)'
  );

  // BarTender Event Types Evaluation Tests (Every Record, Every Page, Every Job, When Data Changes, Every Copy)
  const configEventRecord: SerializationConfig = {
    action: 'increment',
    method: 'numeric',
    incrementBy: 1,
    event: 'record',
    eventInterval: 1,
    preserveCharacters: true,
  };
  assert(
    evaluateSerializedValue('100', configEventRecord, { recordIndex: 0, printIndex: 0 }) === '100' &&
    evaluateSerializedValue('100', configEventRecord, { recordIndex: 1, printIndex: 5 }) === '101' &&
    evaluateSerializedValue('100', configEventRecord, { recordIndex: 2, printIndex: 10 }) === '102',
    'Event "Every record": advances only with recordIndex'
  );

  const configEventPage: SerializationConfig = {
    action: 'increment',
    method: 'numeric',
    incrementBy: 1,
    event: 'page',
    eventInterval: 1,
    preserveCharacters: true,
  };
  assert(
    evaluateSerializedValue('100', configEventPage, { pageIndex: 0 } as any) === '100' &&
    evaluateSerializedValue('100', configEventPage, { pageIndex: 1 } as any) === '101',
    'Event "Every page": advances with pageIndex'
  );

  const configEventJob: SerializationConfig = {
    action: 'increment',
    method: 'numeric',
    incrementBy: 1,
    event: 'job',
    eventInterval: 1,
    preserveCharacters: true,
  };
  assert(
    evaluateSerializedValue('100', configEventJob, { jobIndex: 0, printIndex: 50 } as any) === '100' &&
    evaluateSerializedValue('100', configEventJob, { jobIndex: 1, printIndex: 0 } as any) === '101',
    'Event "Every print job": stays constant throughout job'
  );

  const configEventDataChange: SerializationConfig = {
    action: 'increment',
    method: 'numeric',
    incrementBy: 1,
    event: 'data_change',
    dataItem: 'Category',
    eventInterval: 1,
    preserveCharacters: true,
  };
  assert(
    evaluateSerializedValue('100', configEventDataChange, { dataItemChangeIndex: 0 } as any) === '100' &&
    evaluateSerializedValue('100', configEventDataChange, { dataItemChangeIndex: 1 } as any) === '101' &&
    evaluateSerializedValue('100', configEventDataChange, { dataItemChangeIndex: 2 } as any) === '102',
    'Event "When data changes": advances when monitored field transitions'
  );

  const configEventCopy: SerializationConfig = {
    action: 'increment',
    method: 'numeric',
    incrementBy: 1,
    event: 'copy',
    eventInterval: 1,
    preserveCharacters: true,
  };
  assert(
    evaluateSerializedValue('100', configEventCopy, { printIndex: 0 }) === '100' &&
    evaluateSerializedValue('100', configEventCopy, { printIndex: 1 }) === '101' &&
    evaluateSerializedValue('100', configEventCopy, { printIndex: 2 }) === '102',
    'Event "Every copy": advances on every single physical copy'
  );

  // =========================================================================
  // 3. Preview Sequence Generation
  // =========================================================================
  console.log('\n--- 3. Preview Sequence Generator ---');

  const previewSeq = generatePreviewSequence('100', configIncrement2, {
    prefix: 'LOT-',
    suffix: '-US',
    maxItems: 5,
  });
  assert(previewSeq.length === 5, 'Preview sequence generates exact item count: 5');
  assert(previewSeq[0].finalValue === 'LOT-100-US', 'Preview sequence item 1 has prefix and suffix: LOT-100-US');
  assert(previewSeq[1].finalValue === 'LOT-102-US', 'Preview sequence item 2 incremented: LOT-102-US');
  assert(previewSeq[4].finalValue === 'LOT-108-US', 'Preview sequence item 5 incremented: LOT-108-US');

  // Test Print Quantity multiplier (serialNumbers: 3, copies: 2 -> 6 total labels)
  const configPrintQty: SerializationConfig = {
    action: 'increment',
    method: 'numeric',
    incrementBy: 1,
    serialNumbers: 3,
    copies: 2,
    event: 'standard',
    preserveCharacters: true,
  };
  const previewQtySeq = generatePreviewSequence('001', configPrintQty);
  assert(
    previewQtySeq.length === 6 &&
    previewQtySeq[0].finalValue === '001' &&
    previewQtySeq[1].finalValue === '001' &&
    previewQtySeq[2].finalValue === '002' &&
    previewQtySeq[3].finalValue === '002' &&
    previewQtySeq[4].finalValue === '003' &&
    previewQtySeq[5].finalValue === '003',
    'Print Quantity exact sequence (Serial Numbers: 3, Copies per Serial: 2 -> 6 labels: 001, 001, 002, 002, 003, 003)'
  );

  // Dynamic Print Quantity Options from Database Field
  const configDynamicPrintQty: SerializationConfig = {
    action: 'increment',
    method: 'numeric',
    incrementBy: 1,
    serialNumbersSource: {
      sourceType: 'database',
      value: 1,
      databaseField: 'BoxCount',
    },
    copiesSource: {
      sourceType: 'database',
      value: 1,
      databaseField: 'UnitCopies',
    },
    event: 'standard',
    preserveCharacters: true,
  };
  const dynamicPreviewSeq = generatePreviewSequence('001', configDynamicPrintQty, {
    record: { BoxCount: '2', UnitCopies: '3' },
  });
  assert(
    dynamicPreviewSeq.length === 6 &&
    dynamicPreviewSeq[0].finalValue === '001' &&
    dynamicPreviewSeq[2].finalValue === '001' &&
    dynamicPreviewSeq[3].finalValue === '002' &&
    dynamicPreviewSeq[5].finalValue === '002',
    'Dynamic Print Quantity from DB (BoxCount=2, UnitCopies=3 -> 6 total labels: 001 x 3, 002 x 3)'
  );

  // Test "Don't Serialize" action with 8 copies
  const configDontSerialize: SerializationConfig = {
    action: 'none',
    method: 'custom',
    copies: 8,
    event: 'standard',
    preserveCharacters: true,
  };
  const nonePreviewSeq = generatePreviewSequence('BATCH-A', configDontSerialize);
  assert(
    nonePreviewSeq.length === 8 &&
    nonePreviewSeq.every((item) => item.finalValue === 'BATCH-A'),
    "Don't Serialize mode produces exact static copies count: 8 copies of BATCH-A"
  );

  // =========================================================================
  // 4. Template State Mutation on Confirmed Print
  // =========================================================================
  console.log('\n--- 4. Template State Mutation (advanceTemplateSerialState) ---');

  const mockTemplate: LabelTemplate = {
    id: 'tmpl-test-1',
    name: 'Test Template',
    version: 1,
    status: 'draft',
    dimensions: { width: 100, height: 50, dpi: 300, orientation: 'portrait', unit: 'mm' },
    elements: [
      {
        id: 'el-text-serial',
        type: 'text',
        text: 'SN-001',
        x: 10,
        y: 10,
        width: 40,
        height: 10,
        fontSize: 12,
        color: '#000000',
        visible: true,
        zIndex: 1,
        dataSources: [
          {
            id: 'ds-serial-1',
            name: 'SerialNumber',
            type: 'embedded',
            value: 'SN-001',
            serialization: {
              action: 'increment',
              method: 'alphanumeric',
              incrementBy: 1,
              currentValue: 'SN-001',
              preserveCharacters: true,
            },
          },
        ],
      } as any,
    ],
    tags: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const updatedTmpl = advanceTemplateSerialState(mockTemplate, 10);
  const updatedDs = updatedTmpl.elements[0].dataSources[0];
  assert(
    updatedDs.value === 'SN-011' && updatedDs.serialization.currentValue === 'SN-011',
    'advanceTemplateSerialState advances counter by 10 (SN-001 -> SN-011)'
  );

  // =========================================================================
  // 5. Atomic Reservation Service (Reserve, Commit, Rollback, Partial)
  // =========================================================================
  console.log('\n--- 5. Atomic Reservation Service Lifecycle ---');

  const sourceId = 'src-lot-pool-01';
  const docId = 'doc-123';
  const configResv: SerializationConfig = {
    action: 'increment',
    method: 'numeric',
    incrementBy: 1,
    preserveCharacters: true,
  };

  // 5a. Reserve Range
  const resvA = await AtomicSerialReservationService.reserve(docId, sourceId, '100', configResv, 10, {
    jobId: 'JOB-A',
  });
  assert(resvA.startValue === '100' && resvA.endValue === '109', 'Reservation A allocated range 100 -> 109');
  assert(resvA.status === 'RESERVED', 'Reservation A status is RESERVED');
  assert(AtomicSerialReservationService.hasActiveReservation(sourceId), 'hasActiveReservation returns true');

  // 5b. Commit Range
  const commitSuccess = await AtomicSerialReservationService.commit(
    resvA.id,
    sourceId,
    '110',
    10,
    'JOB-A',
    'Completed print run'
  );
  assert(commitSuccess === true, 'Reservation A commit succeeded');

  // 5c. Rollback test on cancel
  const resvB = await AtomicSerialReservationService.reserve(docId, sourceId, '110', configResv, 10, {
    jobId: 'JOB-B',
  });
  assert(resvB.startValue === '110' && resvB.endValue === '119', 'Reservation B allocated range 110 -> 119');
  const rollbackSuccess = await AtomicSerialReservationService.rollback(resvB.id, 'User clicked Cancel', sourceId);
  assert(rollbackSuccess === true, 'Reservation B rollback succeeded on cancellation');

  // 5d. Partial Print & Mid-Job Failure
  const resvC = await AtomicSerialReservationService.reserve(docId, sourceId, '110', configResv, 10, {
    jobId: 'JOB-C',
  });
  const partialSuccess = await AtomicSerialReservationService.markPartial(
    resvC.id,
    sourceId,
    '114',
    4,
    6,
    1,
    'Paper out after 4 labels'
  );
  assert(partialSuccess === true, 'Reservation C recorded partial completion: 4 printed, 6 remaining');

  // =========================================================================
  // 6. Audit Journal Recording
  // =========================================================================
  console.log('\n--- 6. Audit Journal Inspection ---');

  const journalEntries = await AtomicSerialReservationService.getJournal(sourceId);
  assert(journalEntries.length >= 3, `Audit journal captured all actions (Entries: ${journalEntries.length})`);
  assert(journalEntries.some((j) => j.status === 'committed'), 'Audit journal contains commit log entry');
  assert(journalEntries.some((j) => j.status === 'rolled_back'), 'Audit journal contains rollback log entry');

  // =========================================================================
  // 7. 100,000 Label PrintPlan Performance Benchmark
  // =========================================================================
  console.log('\n--- 7. Performance Benchmark (100,000 Labels PrintPlan Assembly) ---');

  const t0 = performance.now();
  const plan100k = createPrintPlan(mockTemplate, {
    printer: {
      id: 'prn-bench',
      name: 'High Speed Benchmark Printer',
      displayName: 'High Speed Benchmark Printer',
      status: 'READY',
      dpi: 300,
      port: 'PORTPROMPT:',
      connectionType: 'windows-driver',
      preferredRenderer: 'WINDOWS_DRIVER',
      capabilities: {},
    } as any,
    copies: 1,
    serializedLabels: 100000,
    recordsToPrint: [{}],
  });
  const t1 = performance.now();
  const durationMs = t1 - t0;

  console.log(`    -> 100,000 labels generated in ${durationMs.toFixed(2)}ms (Limit: 500ms)`);
  assert(durationMs < 500, '100,000 Label PrintPlan assembled in under 500ms');
  assert(plan100k.totalLabels === 100000, 'PrintPlan accurately computed 100,000 total labels');
  assert(plan100k.documentSnapshot !== undefined, 'PrintPlan contains immutable documentSnapshot');
  assert(plan100k.printerSnapshot !== undefined, 'PrintPlan contains immutable printerSnapshot');

  // =========================================================================
  // FINAL SUMMARY
  // =========================================================================
  console.log('\n=============================================================');
  console.log(`TEST SUITE COMPLETE: ${testsPassed} PASSED, ${testsFailed} FAILED`);
  console.log('=============================================================\n');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Test suite uncaught exception:', err);
  process.exit(1);
});
