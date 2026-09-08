# 20. Enterprise Architecture Dependency Map

**Product:** BarcodeFlow Enterprise Suite  
**Subsystem:** Architectural & Execution Dependency Graph  

---

## 1. Core Subsystem Dependency Diagram

```text
+-----------------------------------------------------------------------------------------+
|                                PHYSICAL MEASUREMENT ENGINE                              |
|                          (mm / inches <---> dots = mm/25.4 * DPI)                       |
+-----------------------------------------------------------------------------------------+
                                             │
                      ┌──────────────────────┴──────────────────────┐
                      ▼                                             ▼
       +-------------------------------+             +-------------------------------+
       |     INTERACTIVE DESIGNER      |             |     POLYMORPHIC RENDERERS     |
       |  (Canvas, Rulers, Guides,     |             |  (ZPL, TSPL, EPL, SBPL,       |
       |   Selection, Resize, Rotate)  |             |   Vector PDF, GDI Spooler)    |
       +-------------------------------+             +-------------------------------+
                      │                                             │
                      ▼                                             ▼
       +-------------------------------+             +-------------------------------+
       |       PRINT PREVIEW UI        |             |     WIN32 RAW PRINT SPOOLER   |
       |   (High-Fidelity Rasterized   |             |   (winspool.drv P/Invoke      |
       |    Multi-Record Preview)      |             |    Direct Byte Passthrough)   |
       +-------------------------------+             +-------------------------------+
                                                                    │
                                                                    ▼
                                                     +-------------------------------+
                                                     |   PHYSICAL PRINTER HARDWARE   |
                                                     | (Zebra, TSC, SATO, Honeywell) |
                                                     +-------------------------------+
```

---

## 2. Data Source & Binding Pipeline Dependency

```text
+-----------------------------------------------------------------------------------------+
|                              IDataSourceProvider CONTRACT                               |
|                  (validateConfig, testConnection, connect, getRecords)                  |
+-----------------------------------------------------------------------------------------+
                                             │
         ┌───────────────────────────────────┼───────────────────────────────────┐
         ▼                                   ▼                                   ▼
+------------------+                +------------------+                +------------------+
|  EXCEL PROVIDER  |                |  TEXT PROVIDER   |                |  ODBC / SQL DB   |
| (OpenXML xlsx)   |                | (CSV/TSV/Fixed)  |                | (tedious / DSN)  |
|  [✅ COMPLETE]   |                |  [🟡 PARTIAL]    |                |  [🎨 UI ONLY]    |
+------------------+                +------------------+                +------------------+
         │                                   │                                   │
         └───────────────────────────────────┼───────────────────────────────────┘
                                             │
                                             ▼
                            +----------------------------------+
                            |       ACTIVE RECORD CONTEXT      |
                            |   (Record Navigator: 1 ... N)    |
                            +----------------------------------+
                                             │
                                             ▼
                            +----------------------------------+
                            |    DESIGNER BINDING EVALUATOR    |
                            |     (evaluateElementData)        |
                            |  ├── Dynamic Named Sources       |
                            |  ├── Formula AST Engine          |
                            |  ├── String Transforms & Regex   |
                            |  └── GS1 FNC1 Formatting         |
                            +----------------------------------+
                                             │
                                             ▼
                            +----------------------------------+
                            |    BATCH PRINT STREAM ITERATOR   |
                            |   (Distinct Record Rendering     |
                            |    + Multi-Label Expansion)      |
                            +----------------------------------+
```

---

## 3. Automation & Headless Integration Dependency

```text
+------------------------------------+          +------------------------------------+
|       ERP / EXTERNAL SYSTEM        |          |      AUTOMATION HOT FOLDER         |
|   (REST API POST /api/print-jobs)  |          | (Drop order.csv / label.xml file)  |
+------------------------------------+          +------------------------------------+
                   │                                               │
                   └───────────────────────┬───────────────────────┘
                                           │
                                           ▼
                          +----------------------------------+
                          |   HEADLESS INTEGRATION SERVICE   |
                          |  (Payload Parsing & Validation)  |
                          +----------------------------------+
                                           │
                                           ▼
                          +----------------------------------+
                          |     DOCUMENT EVENT SCRIPTS       |
                          | (OnStartJob, OnPrePrint, etc.)   |
                          +----------------------------------+
                                           │
                                           ▼
                          +----------------------------------+
                          |   ENTERPRISE PRINT SPOOLER       |
                          |   (Dispatches RAW Stream to      |
                          |    Target Production Line)       |
                          +----------------------------------+
```
