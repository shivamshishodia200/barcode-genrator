# 11. RFID & Smart Hardware Subsystem Audit Report

**Product:** BarcodeFlow Enterprise Suite  
**Subsystem:** RAIN RFID (EPC Gen2), Near Field Communication (NFC) & Hardware Handhelds  
**Status:** 🎨 **UI ONLY / NOT IMPLEMENTED IN BACKEND**  

---

## 1. Current State vs. BarTender Enterprise Parity

| RFID Feature Domain | BarTender Enterprise Feature | BarcodeFlow Current Implementation | Gap & Missing Engine | Classification |
| :--- | :--- | :--- | :--- | :---: |
| **Canvas Tag Visualizer** | RFID inlay graphic overlay on label design | Visual RFID badge/inlay renders on canvas in `ObjectToolbar.tsx` | Visual component exists; lack properties modal for EPC memory bank structure. | 🎨 **UI ONLY** |
| **EPC Gen2 Encoding** | Encode 96-bit / 128-bit EPC memory bank | None | Missing EPC bit-level binary encoder (SGTIN-96, SSCC-96, GRAI-96, GIAI-96). | 🔴 **NOT IMPLEMENTED** |
| **Zebra ZPL RFID Protocol** | Native `^RF`, `^RW`, `^RA`, `^RS`, `^RB` commands | None in `zplRenderer.ts` | Lacks ZPL RFID command stream generation for Zebra RFID printers (e.g. ZT411 RFID). | 🔴 **NOT IMPLEMENTED** |
| **TSC TSPL RFID Protocol** | Native `RFID WRITE`, `RFID READ`, `RFID EPC` | None in `tsplRenderer.ts` | Lacks TSPL RFID command stream generation for TSC Printronix RFID devices. | 🔴 **NOT IMPLEMENTED** |
| **User Memory Bank Write** | Custom Hex / ASCII writing to User Memory | None | Lacks User Memory bank partition configuration. | 🔴 **NOT IMPLEMENTED** |
| **TID / Serial Number Lock** | Lock EPC / TID memory with Access Password | None | Lacks Access Password and Lock command generator. | 🔴 **NOT IMPLEMENTED** |
| **Handheld RFID Readers** | Zebra RFD8500, TSL 1128, Honeywell IH25 | None | Lacks Bluetooth / Serial WebHID reader bridge. | 🔴 **NOT IMPLEMENTED** |

---

## 2. Technical Roadmap for RFID Enablement (Post-V1 / Phase 6)

To reach BarTender-level RFID capabilities, the following engine components will be constructed in Phase 6:

```text
[RFID Data Source (GTIN + Serial)]
               │
               ▼
[EPC Encoder Engine (src/services/rfidEngine.ts)]
  ├── SGTIN-96 Bit-Packing (Header: 8 bits, Filter: 3 bits, Partition: 3 bits, Company: 20-40 bits, Item: 24-4 bits, Serial: 38 bits)
  └── Converts binary string to Hex stream (e.g. "3074257BF7194E4000001A85")
               │
               ▼
[ZPL RFID Stream Renderer]
  ^XA
  ^RS8,,,1     (Setup RFID tag type: EPC Class 1 Gen 2)
  ^RFW,H,1,2,6 (Write 6 words of Hex to EPC Memory Bank starting at word 2)
  ^FD3074257BF7194E4000001A85^FS
  ^XZ
               │
               ▼
[Zebra ZT411 / ZD621R RFID Printer Spooler]
```

---

## 3. Effort & Priority Estimation

- **Priority:** **P2** (Advanced Enterprise Target C — Post-V1).
- **Estimated Development Effort:** 44 developer-hours (PERT).
- **Hardware Requirement:** Physical Zebra ZT411 RFID or SATO CL4NX RFID printer with real UHF RFID smart labels.
