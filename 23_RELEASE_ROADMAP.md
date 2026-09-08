# 23. Release Roadmap & Milestone Specification

**Product:** BarcodeFlow Enterprise Suite  
**Engineering Release Strategy:** 3-Phase Staged Commercial Rollout  

---

## 1. Release Milestone Definitions

```text
+-------------------------------------------------------------------------------------------------------+
|                                    BARCODEFLOW RELEASE ROADMAP                                        |
+-------------------------------------------------------------------------------------------------------+

  [PHASE 1: TARGET A — PRODUCTION MVP]  (Est: ~54 Hours | ~1.5 Weeks)
  ───────────────────────────────────────────────────────────────────────────────────────────────────
  Goal: Solid standalone desktop label designer with Excel/CSV data binding & verified thermal printing.
  Scope:
    • WYSIWYG Label Canvas with mm/inch Rulers, Snap to Grid, and Physical DPI Engine (203/300/600 DPI)
    • Text, Shapes, Images, and 28 Industrial 1D/2D Barcodes (Code 128, EAN-13, UPC-A, QR, DataMatrix)
    • Production Microsoft Excel (.xlsx/.xls/.xlsm) Data Provider (Zero Mock Data, 64 Tests Passed)
    • Text File (CSV/TSV/Delimited) Provider with custom delimiters & encoding
    • Active Record Browser & Navigator (First, Prev, Next, Last) updating Designer live
    • High-Fidelity Print Preview and Win32 RAW Spooler (winspool.drv)
    • Physical Thermal Printer Calibration & Alignment (Zebra ZT410 / TSC TTP-244)
    • Native File Persistence (.bfl, .btw) with Atomic Windows Save/Open Dialogs
    • Standalone Windows NSIS 64-bit Installer (.exe) verified on clean Windows VM

  [PHASE 2: TARGET B — PROFESSIONAL V1]  (Est: ~240 Additional Hours | ~6.5 Weeks)
  ───────────────────────────────────────────────────────────────────────────────────────────────────
  Goal: Complete BarTender Professional equivalent for commercial factory & logistics deployment.
  Scope:
    • Universal Windows ODBC & Native Microsoft SQL Server (tedious) Data Providers
    • Smart Alignment Guides with Equidistant Spapping & Composite Grouping
    • Centralized Shared Network Serial Counters (Duplicate-proof across multiple print stations)
    • Print-Time Interactive Data Entry Forms Builder & Runner (Prompt for lot/operator input)
    • Headless Hot Folder Integration Watcher Service (Auto-print upon file drop)
    • Document Event Scripts hook into Print Spooler (OnPrePrint, OnPostPrint execution)
    • Complete 21 CFR Part 11 Audit Trail & Version Control with Rollback
    • Signed Windows Installer (EV Authenticode Certificate)

  [PHASE 3: TARGET C — ADVANCED ENTERPRISE SUITE]  (Est: ~220 Additional Hours | ~6.0 Weeks)
  ───────────────────────────────────────────────────────────────────────────────────────────────────
  Goal: Complete BarTender Enterprise & Automation equivalent with smart hardware & ERP connectivity.
  Scope:
    • Native Oracle Database (Thin Mode) & Microsoft Access (.accdb) Providers
    • SAP IDoc XML Segment Parser & Enterprise File Connectors
    • RAIN RFID EPC Gen2 Tag Encoding Engine (Zebra ZPL ^RF/^RW on ZT411 RFID)
    • Active Directory / LDAP Domain Authentication & Single Sign-On (SSO)
    • Background Silent Auto-Updater Pipeline (electron-updater)
    • Cloud Document Synchronization & Remote Edge Print Station Manager
```

---

## 2. Release Comparison Matrix

| Capability Area | Target A (MVP) | Target B (Professional V1) | Target C (Advanced Enterprise) |
| :--- | :---: | :---: | :---: |
| **Interactive Canvas** | Full (Grid, Snap, Rulers) | Smart Guides + Grouping | Freeform 1° Rotation |
| **Barcode Symbologies** | 28 Core Industrial Types | + GS1 Digital Link | + MaxiCode / Specialized |
| **Data Sources** | Excel + CSV / TSV | + SQL Server + ODBC DSN | + Oracle + Access + SAP IDoc |
| **Record Navigation** | Live Paging & Navigator | + Shared Network Counters | + Multi-table Relational Joins |
| **Print Protocols** | ZPL, TSPL, EPL, PDF | + Spooler Event Hooks | + Live SNMP MIB Status Polling |
| **Forms & Input** | Static Template Prompts | Visual Form Designer Canvas | Dynamic Script-Driven Forms |
| **Automation** | REST API (`/api/print-jobs`) | + Hot Folder Drop Watcher | + TCP Socket / COM Port Listener |
| **RFID Encoding** | Visual Icon Only | Visual Icon Only | EPC Gen2 (SGTIN-96 / SSCC-96) |
| **Deployment** | NSIS Setup Executable | EV Code-Signed Setup | Silent Background Auto-Updater |
