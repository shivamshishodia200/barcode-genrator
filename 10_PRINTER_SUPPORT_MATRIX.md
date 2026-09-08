# 10. Industrial Printer Manufacturer Support Matrix

**Product:** BarcodeFlow Enterprise Suite  
**Subsystem:** Printer Driver Profiles, Manufacturer Discovery & Command Protocols  
**Implementation Files:**  
- [`src/printer/printerProfiles.ts`](file:///c:/Users/shiva/React%20js/Barcode-automation-main/src/printer/printerProfiles.ts)
- [`src/printer/printerService.ts`](file:///c:/Users/shiva/React%20js/Barcode-automation-main/src/printer/printerService.ts)
- [`electron/printer/printerDiscovery.ts`](file:///c:/Users/shiva/React%20js/Barcode-automation-main/electron/printer/printerDiscovery.ts)  

---

## 1. Manufacturer & Model Compatibility Matrix

| Manufacturer | Sample Models | Supported Protocol | Discovery Mechanism | Code Gen Status | Hardware Verification Status |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **Zebra Technologies** | ZT410, ZT421, ZD620, ZD421, ZT230, GK420t | **ZPL II / EPL2** | Windows CIM Win32_Printer | ✅ COMPLETE | 🖨 **HARDWARE TEST REQ** |
| **TSC Auto ID** | TTP-244 Pro, TE200, MB240, TX300, DA210 | **TSPL / TSPL2** | Windows CIM Win32_Printer | ✅ COMPLETE | 🖨 **HARDWARE TEST REQ** |
| **Honeywell / Intermec** | PC42t, PM42, PM43, PX4i, E-Class Mark III | **DP / CPCL / ZPL** | Windows CIM Win32_Printer | ✅ COMPLETE | 🖨 **HARDWARE TEST REQ** |
| **SATO** | CL4NX Plus, CL6NX, CT4-LX, WS408 | **SBPL / ZPL** | Windows CIM Win32_Printer | ✅ COMPLETE | 🖨 **HARDWARE TEST REQ** |
| **Brother** | TD-4550DNWB, TD-2130N, QL-820NWB | **ZPL / ESC-P** | Windows CIM Win32_Printer | ✅ COMPLETE | 🖨 **HARDWARE TEST REQ** |
| **Godex** | G500, RT700, ZX1200i | **EZPL / ZPL / TSPL**| Windows CIM Win32_Printer | ✅ COMPLETE | 🖨 **HARDWARE TEST REQ** |
| **Argox** | CP-2140, iX4-250, O4-250 | **PPLA / PPLB (EPL)** | Windows CIM Win32_Printer | ✅ COMPLETE | 🖨 **HARDWARE TEST REQ** |
| **Generic Windows Printers** | HP LaserJet, Canon Pixma, Epson WorkForce | **Windows GDI / PDF** | Electron `getPrintersAsync()`| ✅ COMPLETE | ✅ Software Verified |

---

## 2. Printer Discovery & Auto-Profile Assignment

When BarcodeFlow discovers an installed printer in Windows, it parses the driver name and matches it against [`printerProfiles.ts`](file:///c:/Users/shiva/React%20js/Barcode-automation-main/src/printer/printerProfiles.ts):

1. **Zebra Pattern Match:** Regex `/zebra|zpl|gx4|zd|zt/i`
   - Sets Default Protocol: `ZPL`
   - Enables Features: Darkness (0–30), Speed (2–14 ips), Media Sensor (Web/Mark/Continuous), Cutter.
2. **TSC Pattern Match:** Regex `/tsc|ttp|te200|tx300|da200/i`
   - Sets Default Protocol: `TSPL`
   - Enables Features: Density (0–15), Speed (2–12 ips), Gap Sensor, Bline.
3. **SATO Pattern Match:** Regex `/sato|cl4nx|ct4/i`
   - Sets Default Protocol: `SBPL`
4. **General Driver Fallback:**
   - Routes to Windows Driver Spooler / High-Resolution GDI Vector output.

---

## 3. Communication Transports

| Transport Channel | Implementation File | Status | Notes |
| :--- | :--- | :---: | :--- |
| **Windows Spooler RAW** | `electron/printer/rawSpooler.ts` | ✅ COMPLETE | Win32 `winspool.drv` P/Invoke byte streaming. |
| **Direct Network TCP/IP (Port 9100)** | `src/services/apiService.ts` | ✅ COMPLETE | Raw socket connection over LAN/Ethernet. |
| **Virtual PDF Print-to-File** | `src/services/pdfExportService.ts` | ✅ COMPLETE | Pure JavaScript vector PDF generation. |
| **USB Direct HID / Serial COM** | Node native addon | 🔴 NOT IMPL | Required only if bypassing Windows USB print driver. |
