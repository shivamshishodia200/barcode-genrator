# 01. Project Architecture & Subsystem Map

**Product:** BarcodeFlow Enterprise Suite  
**Application Type:** Windows Desktop Industrial Label & Barcode Platform  
**Target Parity:** Seagull Scientific BarTender Enterprise Edition  
**Tech Stack:** Electron 39, Node.js 22, React 19, TypeScript 5.7, Vite 6, Tailwind CSS 4, SQLite3 / JSON Sync  

---

## 1. High-Level Architecture Diagram

```text
+-------------------------------------------------------------------------------------------------------+
|                                      BARCODEFLOW ENTERPRISE SUITE                                      |
+-------------------------------------------------------------------------------------------------------+
                                                    |
         +------------------------------------------+------------------------------------------+
         |                                                                                     |
+------------------+                                                                  +------------------+
|  ELECTRON MAIN   |                                                                  |  REACT RENDERER  |
|  (Node.js / OS)  | <================== [IPC Bridge / Preload] ===================> |  (TypeScript 19) |
+------------------+                                                                  +------------------+
         |                                                                                     |
         +---> Windows Spooler (winspool.drv RAW)                                              +---> Designer Engine
         +---> System Printer Discovery (Win32_Printer)                                        +---> Canvas / Rulers / Snap
         +---> Native File System Dialogs (Save/Open)                                          +---> Object Properties (28 types)
         +---> Native Atomic File I/O (.bfl, .btw)                                             +---> Barcode Engine (bwip-js)
         +---> Excel OpenXML Engine (xlsx)                                                     +---> GS1 Application Identifiers
         +---> File System Watchers (Debounced 1000ms)                                         +---> Formula & Transform Engines
         +---> Embedded REST API Server (Port 3001)                                            +---> Record Browser & Navigator
         +---> SQLite3 WAL Engine + JSON Sync                                                  +---> Print Center & Preview
                                                                                               +---> Form Runner & Data Entry
```

---

## 2. Core Subsystems & File Layout

### 2.1 Electron Main Process (`electron/`)
- **Entry Point:** [`electron/main.ts`](file:///c:/Users/shiva/React%20js/Barcode-automation-main/electron/main.ts)
  - Lifecycle management: Single instance lock, hardware acceleration config, crash reporter.
  - Window manager: Main design studio window, splash screen, viewer stations.
  - IPC Registration:
    - Document I/O: `document:show-save-dialog`, `document:show-open-dialog`, `document:save-file`, `document:read-file`.
    - Printer Management: `barcodeFlow:printers:discover`, `barcodeFlow:printers:send-raw`, `barcodeFlow:printers:get-status`.
    - Excel Bridge: `barcodeFlow:excel:select-file`, `barcodeFlow:excel:inspect`, `barcodeFlow:excel:preview`, `barcodeFlow:excel:records`, `barcodeFlow:excel:watch`.
- **Preload Bridge:** [`electron/preload.ts`](file:///c:/Users/shiva/React%20js/Barcode-automation-main/electron/preload.ts)
  - Secure context-isolated boundary (`contextIsolation: true`, `nodeIntegration: false`).
  - Strict type definitions for `window.barcodeFlow`.
- **Printer Subsystem:**
  - [`electron/printer/printerDiscovery.ts`](file:///c:/Users/shiva/React%20js/Barcode-automation-main/electron/printer/printerDiscovery.ts): Electron `webContents.getPrintersAsync()` + Windows CIM `Get-CimInstance Win32_Printer`.
  - [`electron/printer/rawSpooler.ts`](file:///c:/Users/shiva/React%20js/Barcode-automation-main/electron/printer/rawSpooler.ts): Win32 `winspool.drv` P/Invoke raw byte dispatching (`OpenPrinterA`, `StartDocPrinterA`, `WritePrinter`).
  - [`electron/printer/printerIPC.ts`](file:///c:/Users/shiva/React%20js/Barcode-automation-main/electron/printer/printerIPC.ts): IPC routing between renderer print center and spooler.

### 2.2 React Renderer UI Layer (`src/`)
- **Main View Router:** [`src/App.tsx`](file:///c:/Users/shiva/React%20js/Barcode-automation-main/src/App.tsx)
  - Controls active view: `designer`, `dashboard`, `datasetManager`, `printQueue`, `workflows`, `viewerStation`, `adminConsole`, `licenseManager`.
  - Global application state: Document metadata, active label template, selected element IDs, zoom/pan transform, undo/redo history stacks, active database connection, record navigator index, dirty tracking.
- **Canvas Subsystem (`src/components/canvas/`):**
  - Interactive multi-layer design canvas with sub-pixel rendering.
  - Direct manipulation: Drag, resize (8 bounding handles), rotate, multi-select bounding box.
  - Visual guides: Dynamic millimeter/inch rulers, snap-to-grid, smart alignment guides, DPI physical scaling (203/300/600 DPI).
- **Toolbars & Panels:**
  - [`src/components/menu/MenuBar.tsx`](file:///c:/Users/shiva/React%20js/Barcode-automation-main/src/components/menu/MenuBar.tsx): Standard Windows menu bar (File, Edit, View, Create, Transform, Database, Tools, Help).
  - [`src/components/toolbar/ObjectToolbar.tsx`](file:///c:/Users/shiva/React%20js/Barcode-automation-main/src/components/toolbar/ObjectToolbar.tsx): Quick tool insertion (Text, Barcode, QR, Shape, Line, Image, RFID tag).
  - [`src/components/sidebar/LeftDockPanel.tsx`](file:///c:/Users/shiva/React%20js/Barcode-automation-main/src/components/sidebar/LeftDockPanel.tsx): Object tree, layers, data sources, components library.
  - [`src/components/sidebar/DataSourcesPanel.tsx`](file:///c:/Users/shiva/React%20js/Barcode-automation-main/src/components/sidebar/DataSourcesPanel.tsx): Live data sources tree, field drag-and-drop onto canvas.

### 2.3 Business Logic & Engines (`src/services/`)
- **Barcode & Symbology Engine:** [`src/services/barcodeEngine.ts`](file:///c:/Users/shiva/React%20js/Barcode-automation-main/src/services/barcodeEngine.ts)
  - Leverages `bwip-js` for rendering 28+ industrial 1D/2D barcode symbologies.
  - Comprehensive parameter validation, quiet zone calculation, check digit verification, human-readable text positioning.
- **GS1 Engine:** [`src/services/gs1Engine.ts`](file:///c:/Users/shiva/React%20js/Barcode-automation-main/src/services/gs1Engine.ts)
  - Complete GS1 Application Identifier (AI) dictionary (AI 01, 10, 11, 17, 21, 310x, 37, 400, etc.).
  - FNC1 delimiter encoding and GS1 human-readable bracket formatting.
- **Data Source Provider Architecture (`src/services/providers/`):**
  - Contract: [`IDataSourceProvider.ts`](file:///c:/Users/shiva/React%20js/Barcode-automation-main/src/services/providers/IDataSourceProvider.ts)
  - Registry: [`ProviderRegistry.ts`](file:///c:/Users/shiva/React%20js/Barcode-automation-main/src/services/providers/ProviderRegistry.ts)
  - Implementations: [`ExcelDataSourceProvider.ts`](file:///c:/Users/shiva/React%20js/Barcode-automation-main/src/services/providers/ExcelDataSourceProvider.ts).
- **Print Stream & Language Adapters (`src/printing/renderers/` & `src/services/printerAdapters/`):**
  - Windows Driver / GDI Vector: `windowsDriverRenderer.ts`, `pdfAdapter.ts`.
  - Zebra ZPL II: `zplRenderer.ts`, `zplEngine.ts`.
  - TSC TSPL / TSPL2: `tsplRenderer.ts`, `tsplAdapter.ts`.
  - Eltron EPL / EPL2: `eplRenderer.ts`, `eplAdapter.ts`.
  - SATO SBPL: `sbplRenderer.ts`.
  - Intermec / Datamax CPCL: `cpclRenderer.ts`.
- **Expression & Transform Engines:**
  - Formula Engine: [`src/services/formulaEngine.ts`](file:///c:/Users/shiva/React%20js/Barcode-automation-main/src/services/formulaEngine.ts) (AST-safe math, string, date, condition evaluator).
  - Transform Engine: [`src/services/transformEngine.ts`](file:///c:/Users/shiva/React%20js/Barcode-automation-main/src/services/transformEngine.ts) (Trim, Substring, Regex, Prefix/Suffix, Padding, Case conversion).
- **Document & File Persistence:** [`src/services/documentFileService.ts`](file:///c:/Users/shiva/React%20js/Barcode-automation-main/src/services/documentFileService.ts)
  - BarcodeFlow native JSON `.bfl` format with versioning and migration.
  - XML/JSON BarTender `.btw` structure parsing.

### 2.4 Backend Application Server (`barcode-automation-backend/`)
- **Framework:** Express on Node.js / TypeScript.
- **Persistence:** SQLite3 database with WAL mode (`barcodeflow.sqlite`) mirrored to atomic JSON files (`templates.json`, `auditLogs.json`).
- **REST Endpoints (`src/services/apiService.ts`):**
  - `/api/templates`: Full CRUD, version history, approval workflow.
  - `/api/printers`: Network printer pool, status, capabilities.
  - `/api/print-jobs`: Job submission, spooling, progress, history.
  - `/api/audit-logs`: 21 CFR Part 11 compliant audit trail.
  - `/api/license`: License verification, feature enablement, machine fingerprinting.
  - `/api/users`: RBAC authentication (Admin, Designer, Operator, Viewer).

---

## 3. Data Flow Architecture

```text
[Data Source (Excel / SQL / CSV)]
               │
               ▼
[Provider Pipeline (IDataSourceProvider)]
  ├── Type Ingestion & Leading Zeros Preservation
  ├── Formula Resolution & Date Serials
  └── Snapshot Freezing (PrintSnapshot)
               │
               ▼
[Active Record Context (RecordNavigator)]
               │
               ▼
[Designer Binding Evaluator (evaluateElementData)]
  ├── Named Data Sources
  ├── Formula & Script Expressions
  ├── Transforms & Formatting
  └── GS1 FNC1 Formatting
               │
               ▼
[Polymorphic Print Renderer (generatePrintStream)]
  ├── Native ZPL / TSPL / EPL / SBPL (Industrial Thermal)
  ├── Windows Driver Spooler via winspool.drv (Color / Office / Thermal)
  └── High-Res Vector PDF Engine
               │
               ▼
[Physical Windows Printer / Network TCP Port 9100]
```
