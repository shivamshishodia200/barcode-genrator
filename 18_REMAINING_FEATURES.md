# 18. Remaining Features & Work Breakdown Report

**Product:** BarcodeFlow Enterprise Suite  
**Objective:** Complete inventory of remaining engineering tasks to reach full BarTender-level professional maturity.  
**Estimation Standard:** PERT Formula $E = \frac{O + 4M + P}{6}$  

---

## 1. Exhaustive Remaining Features Breakdown Table

| ID | Feature Name | Current Status | What Currently Exists | What Is Missing | Relevant Files | Priority | Estimated Hours (PERT) | Dependencies | Testing Required |
| :-: | :--- | :---: | :--- | :--- | :--- | :---: | :---: | :--- | :--- |
| **F-01** | **Physical Thermal Printer Verification** | 🖨 HARDWARE TEST REQ | ZPL, TSPL, EPL, SBPL renderers and Win32 RAW spooler exist | Physical calibration on real Zebra, TSC, Honeywell thermal printers | `zplRenderer.ts`, `rawSpooler.ts` | **P0** | **18 hrs** | Physical Printers | Real label roll printing (50x25, 100x50 mm) |
| **F-02** | **Text File (CSV/TSV/Delimited) Provider** | 🟡 PARTIAL | CSV drag-drop import in UI | Standalone `TextFileDataSourceProvider` with custom delimiters, encodings, fixed-width | `CsvImportModal.tsx`, `src/services/providers/` | **P0** | **20 hrs** | `IDataSourceProvider` | Automated CSV fixture test suite |
| **F-03** | **Clean Machine NSIS Installer Verification** | 🧪 NEEDS VERIF | `electron-builder.json` NSIS config & unsigned script | Verification on pristine Windows 10/11 VM without developer tools | `electron-builder.json`, `scripts/Installer.cs` | **P0** | **14 hrs** | VM Environment | Clean install, shortcut launch, uninstall test |
| **F-04** | **Universal Windows ODBC Provider** | 🎨 UI ONLY | Wizard UI screens | Windows ODBC DSN enumeration and query execution bridge via PowerShell/C++ | `DatabaseConnectionModal.tsx`, `electron/main.ts` | **P1** | **32 hrs** | `IDataSourceProvider` | Query System/User DSN tables with filter/paging |
| **F-05** | **Native Microsoft SQL Server Provider** | 🎨 UI ONLY | Wizard UI screens | Pure TypeScript `tedious` TDS driver, Windows Auth, SQL Auth, Schema discovery | `DatabaseConnectionModal.tsx`, `src/services/providers/` | **P1** | **38 hrs** | `tedious` package | Live SQL Server instance query & paging test |
| **F-06** | **Print-Time Data Entry Form Engine** | 🟡 PARTIAL | Form field types in `formTypes.ts` | Visual Form Designer builder and interactive print-time popup prompt modal | `src/types/formTypes.ts`, `src/components/forms/` | **P1** | **48 hrs** | Designer Canvas | Interactive user input binding to label fields |
| **F-07** | **Headless Integration Folder Watcher** | 🟡 PARTIAL | Event script modal & REST API | File Drop watcher service monitoring network folders for `.csv`/`.json` drops | `scripts/folderWatcherService.ts`, `server.ts` | **P1** | **52 hrs** | Print Spooler | Automated file drop printing without GUI |
| **F-08** | **Document Event Scripts Print Spooler Hook** | 🟡 PARTIAL | UI editor & test sandbox | Execution hook inside `EnterprisePrintSpooler.dispatchJob()` during batch printing | `DocumentEventScriptsModal.tsx`, `printSpoolerService.ts`| **P1** | **12 hrs** | Spooler Pipeline | PrePrint/PostPrint event execution tests |
| **F-09** | **Atomic Shared Network Serialization** | 🟡 PARTIAL | In-memory & local counter wizard | Server-backed atomic counter store shared across multiple print stations | `SerialNumberWizardModal.tsx`, `apiService.ts` | **P1** | **24 hrs** | SQLite Backend | Concurrent print station sequence test |
| **F-10** | **Smart Guides Equidistant Snapping** | 🟡 PARTIAL | X/Y edge alignment guides | Equidistant spacing measurement and snapping between 3+ objects | `src/components/canvas/Canvas.tsx` | **P1** | **14 hrs** | Canvas Engine | Visual multi-object alignment test |
| **F-11** | **Composite Nested Object Grouping** | 🟡 PARTIAL | Multi-select drag/align | Persistent composite group container with hierarchy serialization | `src/App.tsx`, `Canvas.tsx` | **P1** | **18 hrs** | Canvas Engine | Save & reopen grouped elements |
| **F-12** | **Microsoft Access (.mdb/.accdb) Provider** | 🎨 UI ONLY | Wizard UI screens | Windows ADO.NET / ACE.OLEDB bridge querying Access tables | `DatabaseConnectionModal.tsx` | **P2** | **28 hrs** | Windows ADO.NET | Query Access `.accdb` with password protection |
| **F-13** | **Native Oracle Database Provider** | 🎨 UI ONLY | Wizard UI screens | Thin-mode `oracledb` client connection and query execution | `DatabaseConnectionModal.tsx` | **P2** | **40 hrs** | `oracledb` package | Live Oracle DB schema & query test |
| **F-14** | **RAIN RFID Tag Chip Encoding Engine** | 🎨 UI ONLY | Visual RFID inlay on canvas | ZPL `^RF`/`^RW` & TSPL `RFID WRITE` command stream generation | `zplRenderer.ts`, `tsplRenderer.ts` | **P2** | **44 hrs** | RFID Printer | Physical RFID smart label encoding & read-back |
| **F-15** | **Auto-Updater Pipeline** | 🔴 NOT IMPL | None | `electron-updater` integration with GitHub Releases / S3 bucket | `package.json`, `electron/main.ts` | **P2** | **24 hrs** | Remote Storage | Background update download & silent install |
| **F-16** | **Centralized LDAP / Active Directory Auth**| 🔴 NOT IMPL | Local SQLite RBAC users | Windows Domain / Active Directory Single Sign-On (SSO) | `barcode-automation-backend/` | **P3** | **36 hrs** | LDAP Server | Domain user authentication & role mapping |
| **F-17** | **SAP IDoc XML & Enterprise File Connectors**| 🎨 UI ONLY | Wizard UI screens | SAP IDoc XML segment parser (`E1EDK01`, `E1EDP01`) into tabular records | `DatabaseConnectionModal.tsx` | **P3** | **48 hrs** | XML Parser | SAP IDoc XML file import & field mapping |

---

## 2. Work Breakdown Summary by Priority Tier

| Priority Tier | Description | Features Included | Total Estimated Hours (PERT) |
| :--- | :--- | :--- | :---: |
| **P0 (Critical MVP)** | Absolute must-haves for baseline physical shipping | F-01, F-02, F-03 | **52 hrs** |
| **P1 (Professional V1)**| Required for professional BarTender parity | F-04, F-05, F-06, F-07, F-08, F-09, F-10, F-11 | **238 hrs** |
| **P2 (Advanced Target C)**| Enterprise expansion & advanced industrial hardware | F-12, F-13, F-14, F-15 | **136 hrs** |
| **P3 (Future / Enterprise)**| Domain infrastructure & ERP connectors | F-16, F-17 | **84 hrs** |
| **Grand Total** | **All Remaining Development Work** | **17 Core Features** | **510 hrs** |
