# 03. UI vs. Functionality Audit Matrix

**Product:** BarcodeFlow Enterprise Suite  
**Scope:** Deep Audit of Every Major Screen, Modal, Dialog, and Button Control  
**Objective:** Identify Visual Placeholders vs. Real Backend Operations  

---

## 1. Top-Level Views & Dialogs Overview

| Screen / Dialog | Component File | UI Exists? | Real Backend Handler? | Status | Notes |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **Main Designer View** | `src/App.tsx`, `Canvas.tsx` | YES | YES | ✅ **COMPLETE** | Live interactive canvas, toolbars, rulers, state management. |
| **Welcome / New Template Modal** | `src/components/dialogs/WelcomeModal.tsx` | YES | YES | ✅ **COMPLETE** | Template selection, dimension presets, blank canvas initialization. |
| **Save As Dialog** | `src/components/dialogs/SaveAsModal.tsx` | YES | YES | ✅ **COMPLETE** | Invokes native Electron Windows Save Dialog and writes atomic `.bfl`. |
| **Page Setup Modal** | `src/components/dialogs/PageSetupModal.tsx` | YES | YES | ✅ **COMPLETE** | Configures width, height, margins, DPI, orientation. |
| **Text Properties Modal** | `src/components/dialogs/TextPropertiesModal.tsx` | YES | YES | ✅ **COMPLETE** | Font family, size, alignment, data binding to fields/named sources. |
| **Barcode Properties Modal** | `src/components/dialogs/BarcodePropertiesModal.tsx` | YES | YES | ✅ **COMPLETE** | Symbology selector, check digit, quiet zone, human-readable text. |
| **Shape Properties Modal** | `src/components/dialogs/ShapePropertiesModal.tsx` | YES | YES | ✅ **COMPLETE** | Stroke, fill, corner radius, line thickness. |
| **Database Connection Wizard** | `src/components/dialogs/DatabaseConnectionModal.tsx` | YES | PARTIAL | 🟡 **PARTIAL** | Excel is 100% functional; other 9 providers are UI only. |
| **Excel Connect Wizard** | `src/components/dialogs/ExcelConnectWizardModal.tsx` | YES | YES | ✅ **COMPLETE** | Dedicated 3-step wizard with sheet inspection and record preview. |
| **CSV Import Modal** | `src/components/dialogs/CsvImportModal.tsx` | YES | YES | ✅ **COMPLETE** | Drag-drop CSV file, auto-detect delimiter, header discovery. |
| **Record Browser Modal** | `src/components/dialogs/RecordBrowserModal.tsx` | YES | YES | ✅ **COMPLETE** | Table view with search, filter, column sorting, active record selector. |
| **Named Data Sources Modal** | `src/components/dialogs/NamedDataSourcesModal.tsx` | YES | YES | ✅ **COMPLETE** | Variable manager creating global template variables. |
| **Formula Builder Modal** | `src/components/dialogs/FormulaBuilderModal.tsx` | YES | YES | ✅ **COMPLETE** | Expression builder with syntax validation and live result preview. |
| **Serial Number Wizard** | `src/components/dialogs/SerialNumberWizardModal.tsx` | YES | YES | ✅ **COMPLETE** | Counter step, prefix, suffix, padding, reset frequency. |
| **GS1 AI Wizard Modal** | `src/components/dialogs/GS1ApplicationIdentifierWizardModal.tsx` | YES | YES | ✅ **COMPLETE** | Guided step-by-step GS1 element string assembly. |
| **Print Center Dialog** | `src/components/dialogs/PrintCenterDialog.tsx` | YES | YES | ✅ **COMPLETE** | Windows printer selector, copies, record range, live print preview. |
| **Printer Calibration Modal** | `src/components/dialogs/PrinterCalibrationModal.tsx` | YES | YES | 🖨 **HARDWARE TEST REQ** | Sends real calibration ZPL/TSPL commands to printer spooler. |
| **Printer Manager Modal** | `src/components/dialogs/PrinterManagerModal.tsx` | YES | YES | ✅ **COMPLETE** | Discovers Windows system printers, manages default driver settings. |
| **Document Event Scripts** | `src/components/dialogs/DocumentEventScriptsModal.tsx` | YES | PARTIAL | 🟡 **PARTIAL** | Script editor with test sandbox; lacks execution hook in print spooler. |
| **Approval Workflow Modal** | `src/components/dialogs/ApprovalWorkflowModal.tsx` | YES | YES | ✅ **COMPLETE** | Submit for review, approve, reject, version compare. |
| **Template Version History** | `src/components/dialogs/TemplateVersionHistoryModal.tsx` | YES | YES | ✅ **COMPLETE** | View past revisions, rollback, restore template state. |
| **Audit Log Modal** | `src/components/dialogs/AuditLogModal.tsx` | YES | YES | ✅ **COMPLETE** | Real-time audit log viewer with export to CSV/JSON. |
| **Settings Modal** | `src/components/dialogs/SettingsModal.tsx` | YES | YES | ✅ **COMPLETE** | Application preferences, measurement units, theme, API config. |
| **Dashboard View** | `src/components/views/DashboardView.tsx` | YES | YES | ✅ **COMPLETE** | Live statistics (templates, printers, print volume, queue status). |
| **Dataset Manager View** | `src/components/views/DatasetManagerView.tsx` | YES | YES | ✅ **COMPLETE** | Enterprise database catalog, connection testing, schema viewer. |
| **Print Queue View** | `src/components/views/PrintQueueView.tsx` | YES | YES | ✅ **COMPLETE** | Real-time print job monitor with retry, cancel, and clear actions. |
| **Viewer Print Station** | `src/components/views/ViewerPrintStationView.tsx` | YES | YES | ✅ **COMPLETE** | Operator-only locked print interface (no design modification). |
| **License Manager View** | `src/components/views/LicenseManagerView.tsx` | YES | YES | 🟡 **PARTIAL** | Offline key validation; lacks server-side hardware-lock verification. |
| **AI Assistant Modal** | `src/components/dialogs/AiAssistantModal.tsx` | YES | YES | 🟡 **PARTIAL** | Gemini 2.0 Flash prompt generation; requires Google API key configured. |

---

## 2. Button-by-Button Action Analysis

### 2.1 File & Top Menu Bar Actions
- **File -> New:** Triggers `handleNewDocument()` -> resets canvas state, pushes initial history. (✅ Real)
- **File -> Open:** Triggers `barcodeFlow.documents.showOpenDialog()` -> loads `.bfl` file from disk. (✅ Real)
- **File -> Save:** Triggers `barcodeFlow.documents.saveFile()` -> atomic write to disk. (✅ Real)
- **File -> Save As:** Triggers `barcodeFlow.documents.showSaveDialog()` -> opens native Windows dialog. (✅ Real)
- **File -> Print (`Ctrl+P`):** Opens `PrintCenterDialog` -> connects to Windows spooler. (✅ Real)
- **Edit -> Undo (`Ctrl+Z`):** Pops undo stack and restores canvas state. (✅ Real)
- **Edit -> Redo (`Ctrl+Y`):** Pops redo stack and advances canvas state. (✅ Real)
- **Edit -> Cut / Copy / Paste / Duplicate / Delete:** Manipulates selected elements on canvas. (✅ Real)

### 2.2 Object Insertion Tools
- **Text Tool:** Inserts new text element at canvas center. (✅ Real)
- **Barcode Tool:** Opens `BarcodePickerModal` -> inserts selected symbology. (✅ Real)
- **QR Code Tool:** Inserts QR code with default `https://barcodeflow.io` URL. (✅ Real)
- **Shape Tool:** Inserts rectangle, ellipse, or line. (✅ Real)
- **Image Tool:** Opens local file browser -> reads image as data URL -> inserts image element. (✅ Real)
- **RFID Tag Tool:** Inserts RFID visual inlay icon. (🎨 UI Only — lacks physical chip writer)

### 2.3 Database Setup Wizard Buttons
- **Screen 1 (Database Type Selection):**
  - Click "Microsoft Excel" -> advances to Step 2 with Excel file selector. (✅ Real)
  - Click "Text File" -> advances to Step 2 with text file selector. (🟡 Partial)
  - Click "SQL Server / Access / Oracle / DB2 / Informix / OLE DB / ODBC": (🎨 UI Only — driver bindings not connected)
- **Screen 2 (File / Connection Browse):**
  - Click "Browse...": Calls `excelDataSourceProvider.browseFile()` -> opens native Windows Open Dialog. (✅ Real)
  - Click "Test Connection": Calls `excelDataSourceProvider.testConnection()` -> tests file readability. (✅ Real)
- **Screen 3 (Table / Sheet Selection):**
  - Table double-click / add button: Transfers sheet from "Available Tables" to "Tables to Use". (✅ Real)
- **Database Setup Dialog (Sidebar Actions):**
  - Click "Refresh": Calls `loadWorkbookSheet(fullFilePath, sheetTarget)` -> re-reads workbook from disk. (✅ Real)
  - Click "Record Browser": Displays live paged rows directly from active sheet. (✅ Real)

### 2.4 Print Center Dialog Actions
- **Select Printer Dropdown:** Discovers real Windows installed printers via `webContents.getPrintersAsync()`. (✅ Real)
- **Copies Input:** Binds integer multiplier to print job. (✅ Real)
- **Record Selector (All / Current / Range / Quantity Field):** Generates distinct records per label. (✅ Real)
- **Print Button:** Dispatches raw stream to `electron/printer/rawSpooler.ts` or PDF vector exporter. (✅ Real)
- **Export ZPL Button:** Downloads raw `.zpl` file directly to disk. (✅ Real)

---

## 3. Summary of UI-Only and Incomplete Controls

| Screen | Control | Finding | Required Action |
| :--- | :--- | :--- | :--- |
| `DatabaseConnectionModal` | SQL Server / Oracle / DB2 connection test | Wizard allows entering server credentials, but connection probe returns unconfigured driver notice. | Implement database client drivers (`mssql`, `oracledb`, `ibm_db`). |
| `DocumentEventScriptsModal` | Event script execution | Scripts evaluate in test simulator, but are not invoked inside `printSpoolerService.ts`. | Hook script interpreter into `EnterprisePrintSpooler.dispatchJob()`. |
| `ObjectToolbar` | RFID Tag object | Renders visual RFID icon on canvas, but no ZPL `^R` RFID write commands are generated. | Implement ZPL RFID encoding blocks (`^RF`, `^RW`, `^RA`). |
| `BarcodePropertiesModal` | GS1 Digital Link resolver | Input field exists for Digital Link URI, but lacks real-time GS1 syntax validation parser. | Add GS1 Digital Link URI parser to `gs1Engine.ts`. |
