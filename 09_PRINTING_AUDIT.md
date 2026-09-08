# 09. Printing Engine & Spooler Deep Audit Report

**Product:** BarcodeFlow Enterprise Suite  
**Subsystem:** Windows Spooler Architecture, RAW Byte Stream Pipeline & Language Renderers  
**Implementation Files:**  
- [`electron/printer/rawSpooler.ts`](file:///c:/Users/shiva/React%20js/Barcode-automation-main/electron/printer/rawSpooler.ts)
- [`electron/printer/printerIPC.ts`](file:///c:/Users/shiva/React%20js/Barcode-automation-main/electron/printer/printerIPC.ts)
- [`src/services/printSpoolerService.ts`](file:///c:/Users/shiva/React%20js/Barcode-automation-main/src/services/printSpoolerService.ts)
- [`src/components/dialogs/PrintCenterDialog.tsx`](file:///c:/Users/shiva/React%20js/Barcode-automation-main/src/components/dialogs/PrintCenterDialog.tsx)
- [`src/printing/renderers/`](file:///c:/Users/shiva/React%20js/Barcode-automation-main/src/printing/renderers/)  

---

## 1. End-to-End Print Pipeline Trace

```text
[PrintCenterDialog UI]
         │ (User selects Printer, Copies, and Records Range)
         ▼
[EnterprisePrintSpooler.dispatchJob()]
         │ (Applies template data binding and quantity expansion)
         ▼
[generatePrintStream(format, template, records, options)]
         │
         ├── Format == 'zpl'   ──> [zplRenderer.ts]   ──> Returns ASCII ZPL II (^XA ... ^XZ)
         ├── Format == 'tspl'  ──> [tsplRenderer.ts]  ──> Returns TSPL (SIZE, GAP, BARCODE, PRINT)
         ├── Format == 'epl'   ──> [eplRenderer.ts]   ──> Returns EPL2 (N, q, B, A, P)
         ├── Format == 'sbpl'  ──> [sbplRenderer.ts]  ──> Returns SATO SBPL (<A> ... <Z>)
         └── Format == 'pdf'   ──> [pdfExportService] ──> Returns Vector PDF Buffer
         │
         ▼
[IPC: barcodeFlow.printers.sendRaw(printerName, streamBytes, docTitle)]
         │
         ▼
[electron/main.ts -> printerIPC.ts]
         │
         ▼
[electron/printer/rawSpooler.ts -> sendRawBytesToWindowsSpooler()]
         │ (PowerShell C# P/Invoke with Win32 winspool.drv)
         ├── 1. OpenPrinterA(printerName, out hPrinter, null)
         ├── 2. StartDocPrinterA(hPrinter, 1, { pDocName, pDataType: "RAW" })
         ├── 3. StartPagePrinter(hPrinter)
         ├── 4. WritePrinter(hPrinter, pBytes, length, out dwWritten)
         ├── 5. EndPagePrinter(hPrinter)
         ├── 6. EndDocPrinter(hPrinter)
         └── 7. ClosePrinter(hPrinter)
         │
         ▼
[Windows Print Spooler -> Physical Printer Port (USB / TCP Port 9100 / Network)]
```

---

## 2. Printer Language Renderers Audit

| Renderer File | Target Language | Commands Supported | Status | Hardware Verified? |
| :--- | :--- | :--- | :---: | :---: |
| [`zplRenderer.ts`](file:///c:/Users/shiva/React%20js/Barcode-automation-main/src/printing/renderers/zplRenderer.ts) | Zebra ZPL II | `^XA`, `^LL`, `^PW`, `^FO`, `^FD`, `^A0`, `^BC`, `^BQ`, `^BX`, `^GB`, `^XZ` | ✅ COMPLETE | 🖨 **HARDWARE TEST REQ** |
| [`tsplRenderer.ts`](file:///c:/Users/shiva/React%20js/Barcode-automation-main/src/printing/renderers/tsplRenderer.ts) | TSC TSPL / TSPL2 | `SIZE`, `GAP`, `DIRECTION`, `CLS`, `TEXT`, `BARCODE`, `QRCODE`, `BOX`, `PRINT` | ✅ COMPLETE | 🖨 **HARDWARE TEST REQ** |
| [`eplRenderer.ts`](file:///c:/Users/shiva/React%20js/Barcode-automation-main/src/printing/renderers/eplRenderer.ts) | Eltron EPL2 | `N`, `q`, `Q`, `A`, `B`, `b`, `LO`, `P` | ✅ COMPLETE | 🖨 **HARDWARE TEST REQ** |
| [`sbplRenderer.ts`](file:///c:/Users/shiva/React%20js/Barcode-automation-main/src/printing/renderers/sbplRenderer.ts) | SATO SBPL | `<A>`, `<V>`, `<H>`, `<P>`, `<K>`, `<BG>`, `<2D30>`, `<Z>` | ✅ COMPLETE | 🖨 **HARDWARE TEST REQ** |
| [`cpclRenderer.ts`](file:///c:/Users/shiva/React%20js/Barcode-automation-main/src/printing/renderers/cpclRenderer.ts) | Intermec/Datamax CPCL | `! 0 200 200`, `PAGE-WIDTH`, `TEXT`, `BARCODE`, `PRINT` | ✅ COMPLETE | 🖨 **HARDWARE TEST REQ** |
| [`pdfAdapter.ts`](file:///c:/Users/shiva/React%20js/Barcode-automation-main/src/services/printerAdapters/pdfAdapter.ts) | High-Res Vector PDF | Full Vector canvas matching exact mm dimensions & DPI | ✅ COMPLETE | ✅ Software Verified |

---

## 3. Print Settings & Capabilities Control

- **Darkness / Density:** Configurable (ZPL `~SD`, TSPL `DENSITY 0-15`).
- **Print Speed:** Configurable (ZPL `^PR`, TSPL `SPEED 2-12`).
- **Media Sensor Mode:** Continuous, Gap, Black Mark (ZPL `^MN`, TSPL `GAP`).
- **Tear-off / Cutter Mode:** Configurable cutter activation after print batch.
- **Orientation:** Normal (0°), Inverted (180°), Rotated (90°/270°).
- **Batch Record Slicing:** Range selection (e.g. records 1–100, selected rows, or quantity multiplication).

---

## 4. Hardware Verification Checklist for Production Sign-off

While the code generation and Win32 RAW spooler pipelines are fully implemented and verified in software, the following physical tests must be executed with real thermal printers before final enterprise shipping:

1. **Zebra ZT410 (300 DPI):** Verify 100mm x 50mm label alignment, Code 128 edge sharpness, and tear-off position.
2. **TSC TTP-244 Pro (203 DPI):** Verify TSPL gap detection, darkness setting, and QR code scanability.
3. **Honeywell / SATO CL4NX:** Verify high-speed 600 DPI micro-UDI barcode output.
