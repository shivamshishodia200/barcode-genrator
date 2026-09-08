# 12. Automation, REST API & Scripting Subsystem Audit Report

**Product:** BarcodeFlow Enterprise Suite  
**Subsystem:** Embedded REST API, Event Scripting & Automation Services  
**Implementation Files:**  
- [`barcode-automation-backend/src/app.ts`](file:///c:/Users/shiva/React%20js/Barcode-automation-main/barcode-automation-backend/src/app.ts)
- [`src/services/apiService.ts`](file:///c:/Users/shiva/React%20js/Barcode-automation-main/src/services/apiService.ts)
- [`src/components/dialogs/DocumentEventScriptsModal.tsx`](file:///c:/Users/shiva/React%20js/Barcode-automation-main/src/components/dialogs/DocumentEventScriptsModal.tsx)
- [`src/types/formTypes.ts`](file:///c:/Users/shiva/React%20js/Barcode-automation-main/src/types/formTypes.ts)  

---

## 1. Embedded REST API Server

BarcodeFlow includes an embedded Node.js REST API server running on port `3001` (or user-configurable via `process.env.PORT`), providing programmatic control:

| Endpoint | HTTP Method | Purpose | Status | Notes |
| :--- | :---: | :--- | :---: | :--- |
| `/api/templates` | `GET`, `POST` | List and create label design templates | ✅ COMPLETE | Supports filtering by category and status. |
| `/api/templates/:id` | `GET`, `PUT`, `DELETE` | Read, update, and delete template definitions | ✅ COMPLETE | Atomic SQLite / JSON file persistence. |
| `/api/templates/:id/duplicate` | `POST` | Clone an existing template | ✅ COMPLETE | Increments name with `(Copy)`. |
| `/api/templates/submit` | `POST` | Submit template for approval review | ✅ COMPLETE | Attaches snapshot and version number. |
| `/api/printers` | `GET`, `POST` | Query printer pool and add network printers | ✅ COMPLETE | Enriched with driver and DPI metadata. |
| `/api/print-jobs` | `GET`, `POST` | Submit print requests and query queue status | ✅ COMPLETE | Supports variable payload data injection. |
| `/api/audit-logs` | `GET`, `POST` | Query 21 CFR Part 11 audit events | ✅ COMPLETE | Filter by user, action, and date range. |
| `/api/license/verify` | `POST` | Validate product serial and license status | ✅ COMPLETE | Returns edition and feature entitlements. |

---

## 2. Document Event Scripting Engine

Located in [`DocumentEventScriptsModal.tsx`](file:///c:/Users/shiva/React%20js/Barcode-automation-main/src/components/dialogs/DocumentEventScriptsModal.tsx):
- **Events Supported:**
  - `OnStartJob`: Executed once when the print job initiates.
  - `OnEndJob`: Executed once after all labels complete.
  - `OnNewRecord`: Executed each time a new database record is loaded.
  - `OnPrePrint`: Executed immediately prior to rasterizing/ZPL generation.
  - `OnPostPrint`: Executed immediately after dispatch to the spooler.
  - `OnSerialize`: Executed when serial counters advance.
- **Current Status:** 🟡 **PARTIAL**
  - The script editor and test sandbox execute JavaScript safely inside a bounded Function closure (`new Function('record', 'console', ...)`).
  - **Remaining Gap:** Script execution hook must be attached directly inside `EnterprisePrintSpooler.dispatchJob()` during batch printing. (Effort: 12 hrs).

---

## 3. BarTender Integration Builder Comparison (Automation Engine)

| Enterprise Automation Capability | BarTender Integration Builder | BarcodeFlow Current Implementation | Gap & Roadmap |
| :--- | :--- | :--- | :--- |
| **REST API Trigger** | Listens on HTTP/HTTPS endpoint and prints on JSON payload | ✅ Implemented via `/api/print-jobs` | Needs API key authentication middleware. |
| **File Drop Watch Folder** | Monitors network folder for `.csv` / `.xml` / `.json` drops and prints automatically | 🔴 Not Implemented | Needs background directory watcher daemon (`scripts/folderWatcherService.ts`). |
| **TCP / Serial Port Listener** | Listens on raw TCP socket or COM port for barcode scanner triggers | 🔴 Not Implemented | Planned for Target C (Advanced Enterprise). |
| **Database Polling Trigger** | Periodically queries SQL table for new rows with `STATUS = 'PENDING'` | 🔴 Not Implemented | Planned for Target C (Advanced Enterprise). |

---

## 4. Print-Time Data Entry Forms

- **Type Contracts ([`src/types/formTypes.ts`](file:///c:/Users/shiva/React%20js/Barcode-automation-main/src/types/formTypes.ts)):**
  - Supports `text`, `dropdown`, `record_picker`, `date`, `checkbox`, `number`, `quantity`, and `button` controls.
- **Current Status:** 🟡 **PARTIAL**
  - Data contracts exist, but visual Form Designer drag-and-drop builder canvas and print-time interactive popup modal are not yet implemented.
  - **Estimated Effort:** 48 developer-hours (PERT).
