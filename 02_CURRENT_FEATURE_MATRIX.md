# 02. Comprehensive Current Feature Matrix

**Product:** BarcodeFlow Enterprise Suite  
**Audit Baseline:** Source Code Analysis, TypeScript AST Inspection, IPC Verification, Runtime Execution  
**Status Standard:** Strict Evidence-Based Audit  

---

## 1. Feature Status Legend

| Status | Meaning |
| :---: | :--- |
| ✅ **COMPLETE** | Implemented, integrated, persisted, automated-tested, and fully usable without mocks. |
| 🟡 **PARTIAL** | Major functionality exists, but critical requirements or edge cases remain. |
| 🎨 **UI ONLY** | Screen, dialog, or control exists visually, but backing engine/IPC handler is missing. |
| ⚠️ **MOCK / PLACEHOLDER** | UI or backend uses fake/sample data or simulated `setTimeout` delays. |
| ❌ **BROKEN** | Implementation exists but throws runtime errors or produces corrupted output. |
| 🧪 **NEEDS VERIFICATION** | Code is present but requires structured automated/integration testing. |
| 🖨 **HARDWARE TEST REQUIRED** | Code is implemented but requires verification against physical thermal/barcode hardware. |
| 🔴 **NOT IMPLEMENTED** | Feature is planned or referenced in BarTender parity, but absent in codebase. |

---

## 2. Exhaustive Feature Matrix

### 2.1 File & Document Management
| Feature | Status | Evidence File / Location | Missing Behavior / Notes |
| :--- | :---: | :--- | :--- |
| New Document | ✅ **COMPLETE** | `src/App.tsx`, `initialTemplates.ts` | Clean state initialization with default dimensions. |
| Native Windows Open Dialog | ✅ **COMPLETE** | `electron/main.ts` (line 1045) | Filter `.bfl`, `.btw`, `.json`, `.xml`. |
| Native Windows Save As Dialog | ✅ **COMPLETE** | `electron/main.ts` (line 1008) | Native Windows File Dialog returning normalized path. |
| Safe Atomic File Save (.bfl) | ✅ **COMPLETE** | `electron/main.ts` (line 1040) | Writes to `.tmp` file and performs atomic rename. |
| File Open & Hydration | ✅ **COMPLETE** | `src/services/documentFileService.ts` | Deserializes elements, dimensions, margins, data connections. |
| BarTender .btw Import | 🟡 **PARTIAL** | `src/services/documentFileService.ts` | Parses XML/JSON-based `.btw` files; binary legacy `.btw` format unsupported. |
| Autosave & Crash Recovery | 🟡 **PARTIAL** | `src/services/snapshotService.ts` | LocalStorage snapshot exists; needs background atomic interval to disk. |
| Recent Files List | ✅ **COMPLETE** | `src/App.tsx`, `src/services/apiService.ts` | Persisted in local configuration and server database. |

### 2.2 Label Designer Canvas & Manipulation
| Feature | Status | Evidence File / Location | Missing Behavior / Notes |
| :--- | :---: | :--- | :--- |
| Interactive Canvas Drag & Drop | ✅ **COMPLETE** | `src/components/canvas/Canvas.tsx` | Smooth mouse drag with boundary constraints. |
| Multi-Handle Resizing (8 handles) | ✅ **COMPLETE** | `src/components/canvas/Canvas.tsx` | Top, bottom, left, right, corners with aspect ratio lock. |
| Object Rotation (0°, 90°, 180°, 270°) | ✅ **COMPLETE** | `src/components/canvas/Canvas.tsx` | Discrete angle rotation with bounding box recalculation. |
| Multi-Selection & Bounding Box | ✅ **COMPLETE** | `src/components/canvas/Canvas.tsx` | Drag-to-select marquee and Shift+Click multi-select. |
| Undo / Redo History Stack | ✅ **COMPLETE** | `src/App.tsx` | Full state history stack with keyboard shortcuts (`Ctrl+Z`, `Ctrl+Y`). |
| Dynamic Millimeter/Inch Rulers | ✅ **COMPLETE** | `src/components/canvas/Ruler.tsx` | Responsive ticks tracking cursor position in mm and inches. |
| Snap to Grid | ✅ **COMPLETE** | `src/components/canvas/Canvas.tsx` | Configurable grid interval (1mm, 2mm, 5mm) with magnetic snapping. |
| Snap to Objects & Smart Guides | 🟡 **PARTIAL** | `src/components/canvas/Canvas.tsx` | Center and edge alignment guide lines render, but lack multi-object spacing snaps. |
| Object Alignment (Left/Center/Right/Top/Middle/Bottom) | ✅ **COMPLETE** | `src/components/toolbar/` | Full alignment suite operating on multi-selected elements. |
| Object Distribution (Horizontal/Vertical) | ✅ **COMPLETE** | `src/components/toolbar/` | Equidistant spacing calculation across selected items. |
| Z-Order (Bring to Front / Send to Back) | ✅ **COMPLETE** | `src/App.tsx` | Layer reordering with real-time canvas updates. |
| Object Grouping / Ungrouping | 🟡 **PARTIAL** | `src/App.tsx` | Multi-select movement works; nested composite group hierarchy is absent. |
| Object Locking / Hiding | ✅ **COMPLETE** | `src/components/sidebar/LeftDockPanel.tsx` | Prevents accidental edits on locked layers; toggle visibility. |
| High-DPI Windows Display Scaling | ✅ **COMPLETE** | `src/printer/dpiService.ts` | Uses CSS transform matrix scaling synchronized with device pixel ratio. |

### 2.3 Label Objects & Symbologies
| Feature | Status | Evidence File / Location | Missing Behavior / Notes |
| :--- | :---: | :--- | :--- |
| Single-Line & Multi-Line Text | ✅ **COMPLETE** | `src/components/dialogs/TextPropertiesModal.tsx` | Font size, family, bold, italic, underline, alignment. |
| Rich Text / Word Wrap | 🟡 **PARTIAL** | `src/components/dialogs/TextPropertiesModal.tsx` | Word wrapping works; HTML/RTF mixed styling per block is not implemented. |
| 1D Barcodes (Code 128, Code 39, EAN-13, UPC-A, ITF) | ✅ **COMPLETE** | `src/services/barcodeEngine.ts` | `bwip-js` vector rendering, checksums, human-readable text. |
| 2D QR Code & Micro QR | ✅ **COMPLETE** | `src/services/barcodeEngine.ts` | ECC levels L/M/Q/H, URL encoding, dynamic data binding. |
| 2D DataMatrix & GS1 DataMatrix | ✅ **COMPLETE** | `src/services/barcodeEngine.ts`, `gs1Engine.ts` | ECC 200, square and rectangular formats, FNC1 encoding. |
| PDF417 / MicroPDF417 | ✅ **COMPLETE** | `src/services/barcodeEngine.ts` | Truncated and standard PDF417 with auto columns/rows. |
| GS1-128 & Application Identifiers | ✅ **COMPLETE** | `src/services/gs1Engine.ts` | Full AI dictionary (01, 10, 17, 21), FNC1 insertion, bracket display. |
| Vector Shapes (Rectangle, Ellipse, Line) | ✅ **COMPLETE** | `src/components/dialogs/ShapePropertiesModal.tsx` | Stroke color, stroke width, fill color, corner rounding. |
| Images (PNG, JPG, BMP, SVG) | ✅ **COMPLETE** | `src/components/canvas/Canvas.tsx` | Local file import, aspect ratio preservation, base64 serialization. |
| Table / Grid Object | 🎨 **UI ONLY** | `src/types/index.ts` | Type definition exists; visual canvas table renderer is not implemented. |
| RFID Tag (EPC Gen2 / RAIN) | 🎨 **UI ONLY** | `src/components/toolbar/ObjectToolbar.tsx` | Canvas inlay visual icon renders; hardware chip encoding is not hooked. |

### 2.4 Data Sources & Database Wizard
| Feature | Status | Evidence File / Location | Missing Behavior / Notes |
| :--- | :---: | :--- | :--- |
| Microsoft Excel (.xlsx, .xls, .xlsm) | ✅ **COMPLETE** | `ExcelDataSourceProvider.ts`, `electron/main.ts` | 64 test cases passed; leading zeros, formulas, dates, file watcher. |
| CSV / TSV / Delimited Text File | 🟡 **PARTIAL** | `src/components/dialogs/CsvImportModal.tsx` | Comma/tab parsing works; custom delimiters and encodings need provider wrapper. |
| Microsoft Access (.mdb, .accdb) | 🎨 **UI ONLY** | `DatabaseConnectionModal.tsx` | UI wizard steps exist; lacks Windows OLE DB / ACE driver binding. |
| Microsoft SQL Server | 🎨 **UI ONLY** | `DatabaseConnectionModal.tsx` | UI wizard steps exist; lacks native TDS / `mssql` client binding. |
| Oracle Database | 🎨 **UI ONLY** | `DatabaseConnectionModal.tsx` | UI wizard steps exist; lacks `oracledb` client connection execution. |
| SAP IDoc Integration | 🎨 **UI ONLY** | `DatabaseConnectionModal.tsx` | UI wizard steps exist; lacks IDoc XML parser and RFC connector. |
| IBM DB2 | 🎨 **UI ONLY** | `DatabaseConnectionModal.tsx` | UI wizard steps exist; lacks DB2 CLI driver execution. |
| IBM Informix | 🎨 **UI ONLY** | `DatabaseConnectionModal.tsx` | UI wizard steps exist; lacks Informix CSDK client binding. |
| OLE DB Connection | 🎨 **UI ONLY** | `DatabaseConnectionModal.tsx` | UI wizard steps exist; lacks ADO/OLE DB provider enumeration. |
| ODBC Connection | 🎨 **UI ONLY** | `DatabaseConnectionModal.tsx` | UI wizard steps exist; lacks Windows System/User DSN query. |
| Named Data Sources (Variables) | ✅ **COMPLETE** | `src/components/dialogs/NamedDataSourcesModal.tsx` | Reusable document variables referenced as `{{VarName}}`. |
| Active Record Navigator | ✅ **COMPLETE** | `src/components/sidebar/DataSourcesPanel.tsx` | First, Prev, Next, Last, Jump-to-index updating canvas immediately. |
| Record Filtering & Searching | ✅ **COMPLETE** | `src/components/dialogs/RecordBrowserModal.tsx` | In-memory column search and filter expressions. |

### 2.5 Data Transformation & Formula Engine
| Feature | Status | Evidence File / Location | Missing Behavior / Notes |
| :--- | :---: | :--- | :--- |
| String Transforms (Trim, Case, Substring, Pad) | ✅ **COMPLETE** | `src/services/transformEngine.ts` | Pure functions operating on element value pipeline. |
| Regex Extraction & Replacement | ✅ **COMPLETE** | `src/services/transformEngine.ts` | Pattern matching and capture group extraction. |
| Formula Engine (Math, String, Date, IF) | ✅ **COMPLETE** | `src/services/formulaEngine.ts` | AST-safe evaluation (`MRP * Quantity`, `IF(Qty > 10, "A", "B")`). |
| Serialization / Auto-Increment Counter | ✅ **COMPLETE** | `src/components/dialogs/SerialNumberWizardModal.tsx` | Numeric counters with step, prefix, suffix, and padding (`000001`). |
| Document Event Scripting | 🟡 **PARTIAL** | `src/components/dialogs/DocumentEventScriptsModal.tsx` | UI and sandbox evaluator exist; lacks execution during raw print spooling. |

### 2.6 Print Subsystem & Industrial Protocols
| Feature | Status | Evidence File / Location | Missing Behavior / Notes |
| :--- | :---: | :--- | :--- |
| Windows Installed Printer Discovery | ✅ **COMPLETE** | `electron/printer/printerDiscovery.ts` | Discovers real Windows printers with CIM `Win32_Printer` enrichment. |
| Win32 Spooler RAW Printing | ✅ **COMPLETE** | `electron/printer/rawSpooler.ts` | P/Invoke `winspool.drv` byte streaming (`StartDocPrinterA`, `WritePrinter`). |
| Zebra ZPL II Code Generation | 🖨 **HARDWARE TEST REQ** | `src/printing/renderers/zplRenderer.ts` | Generates valid `^XA ... ^XZ` streams; needs physical Zebra printer verification. |
| TSC TSPL / TSPL2 Code Generation | 🖨 **HARDWARE TEST REQ** | `src/printing/renderers/tsplRenderer.ts` | Generates `SIZE`, `GAP`, `BARCODE`, `TEXT`; needs physical TSC printer verification. |
| Eltron EPL / EPL2 Code Generation | 🖨 **HARDWARE TEST REQ** | `src/printing/renderers/eplRenderer.ts` | Generates `N`, `q`, `B`, `A`, `P`; needs physical EPL printer verification. |
| SATO SBPL Code Generation | 🖨 **HARDWARE TEST REQ** | `src/printing/renderers/sbplRenderer.ts` | Generates `<A> ... <Z>` command streams; needs physical SATO printer verification. |
| High-Res Vector PDF / Windows GDI Print | ✅ **COMPLETE** | `src/services/pdfExportService.ts` | Vector PDF output matching exact label dimensions. |
| Print Center Dialog & Live Preview | ✅ **COMPLETE** | `src/components/dialogs/PrintCenterDialog.tsx` | Multi-record preview, copy count, quantity field binding. |
| Quantity Multi-Label Expansion | ✅ **COMPLETE** | `ExcelDataSourceProvider.ts` | Generates distinct copies per record based on integer column. |
| Print Job Spooler & Queue Manager | ✅ **COMPLETE** | `src/services/printSpoolerService.ts` | Queued, Printing, Completed, Failed states with job logs. |
| 21 CFR Part 11 Audit Trail | ✅ **COMPLETE** | `src/components/dialogs/AuditLogModal.tsx` | User, timestamp, document, printer, copy count logging. |

### 2.7 Packaging, Installer & Release
| Feature | Status | Evidence File / Location | Missing Behavior / Notes |
| :--- | :---: | :--- | :--- |
| Electron Builder NSIS Config | ✅ **COMPLETE** | `electron-builder.json` | 64-bit Windows NSIS installer with desktop shortcut and uninstaller. |
| Unsigned Build Pipeline | ✅ **COMPLETE** | `electron-builder.unsigned.json` | Standalone local executable build without EV code-signing certificate. |
| Auto-Update Mechanism | 🔴 **NOT IMPLEMENTED** | `package.json` | `electron-updater` is not configured with a remote update repository. |
| Production Build Compilation | ✅ **COMPLETE** | `package.json` (`electron:build`) | Compiles React Vite bundle and esbuild Electron main/preload. |
| Standalone Windows Installer (.exe) | 🧪 **NEEDS VERIFICATION** | `scripts/Installer.cs`, `electron-builder` | Script exists; needs end-to-end packaging test run on clean VM. |
