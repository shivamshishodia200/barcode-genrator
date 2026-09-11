# BarcodeFlow Enterprise Suite — Print Dialog & Object Print Method Guide
*(प्रिंट डायलॉग और ऑब्जेक्ट प्रिंट मेथड फीचर गाइड)*

---

## 📌 1. इस टास्क का मुख्य उद्देश्य क्या था? (What was the goal?)

पहले BarcodeFlow के **Print Dialog** में **"Object Print Method"** टैब केवल एक सादा सूचनात्मक टेक्स्ट (Static Text) दिखाता था, जिसमें कोई सेटिंग्स बदलने का विकल्प नहीं था। 

अब इसे पूरी तरह से **BarTender-Style Desktop Workflow** की तरह असली काम करने वाले ऑप्शन्स और रेंडरर पाइपलाइन के साथ बना दिया गया है।

---

## 🚀 2. क्या-क्या नया जोड़ा गया है? (Key Features Implemented)

### A. "Object Print Method" टैब (पूरी तरह फंक्शनल)
जब आप `Ctrl + P` दबाकर **Object Print Method** टैब खोलेंगे, तो आपको ये विकल्प मिलेंगे:

#### 1. Settings (स्कोप चुनें)
- **`Use Settings For All Documents` (Global):** यह सेटिंग पूरे एप्लिकेशन के सभी लेबल्स पर डिफ़ॉल्ट रूप से लागू होगी (`localStorage` में सुरक्षित)।
- **`Use Settings For This Document Only` (Document Only):** यह सेटिंग सिर्फ चालू लेबल फ़ाइल (`.bfl`) में सेव होगी।

#### 2. Objects (प्रिंटिंग का तरीका चुनें)
| Object Type | उपलब्ध विकल्प (Dropdown Options) | इसका क्या काम है? |
| :--- | :--- | :--- |
| **TrueType Text** | `Auto`, `Text Output`, `Vector`, `Raster` | टेक्स्ट को वेक्टर पाथ में छापना है, डायरेक्ट प्रिंटर फॉन्ट में, या इमेज (बिटमैप) बनाकर। |
| **Unsupported 1D Barcodes** | `Auto`, `Printer Native`, `Vector`, `Raster` | यदि प्रिंटर किसी 1D बारकोड को सीधे सपोर्ट नहीं करता, तो वेक्टर या रास्टर में ऑटो-कन्वर्ट होगा। |
| **Unsupported 2D Barcodes** | `Auto`, `Printer Native`, `Vector`, `Raster` | QR कोड, DataMatrix, PDF417 आदि के लिए रेंडरिंग मोड। |
| **Lines** | `Auto`, `Printer Native`, `Vector`, `Raster` | सीधी व तिरछी लाइनों की मोटाई, डैश स्टाइल और प्रिंटिंग मेथड। |
| **Boxes** | `Auto`, `Printer Native`, `Vector`, `Raster` | आयत/चौकोर बॉक्स, स्ट्रोक, फिल और कॉर्नर रेडियस। |
| **Ellipses** | `Auto`, `Printer Native`, `Vector`, `Raster` | गोलाकार / अंडाकार आकृतियों की प्रिंटिंग। |

---

### B. "Print &rarr; Options" सब-टैब में नए जॉब कंट्रोल्स
Print टैब के **Options** सेक्शन में अब 5 शक्तिशाली फीचर्स हैं:

1. **`[ ] Repeat data entry until cancelled`**
   - जब तक ऑपरेटर Cancel बटन न दबाए, प्रिंट होने के बाद हर बार नया डेटा दर्ज करने का फ़ॉर्म अपने आप खुलता रहेगा।
2. **`[ ] Cancel any jobs previously queued to this printer`**
   - अगर प्रिंटर में पुराने अटके हुए प्रिंट जॉब्स हैं, तो उन्हें तुरंत हटाने के लिए **`[Purge Queue Now]`** बटन दिया गया है (Windows Spooler Clear)।
3. **`[ ] Enable data entry`**
   - प्रिंट कमांड देने पर पहले वेरिएबल डेटा एंट्री फ़ॉर्म खुलेगा।
4. **`[ ] Enable Printer Code Modifier`**
   - ZPL/TSPL कोड में प्रिंट से पहले कस्टम हेडर/फ़ूटर जोड़ना या टेक्स्ट बदलना (उदा. `^LH` या स्पीड कमांड बदलना)। इसके लिए **`[Configure Modifier...]`** बटन दिया गया है।
5. **`[ ] Show printer code at end of print job`**
   - थर्मल प्रिंटर (ZPL/TSPL) पर प्रिंट करने के बाद स्क्रीन पर एक **Code Viewer Window** खुलेगी, जहाँ से आप पूरा प्रिंट कोड देख सकते हैं, **Copy** कर सकते हैं या **`.prn` / `.zpl` फाइल Save** कर सकते हैं।
6. **Advanced Printer Settings:**
   - Starting Slot (मल्टी-अप शीट के लिए खाली स्लॉट छोड़ने का विकल्प)
   - Output Protocol (`PDF`, `ZPL`, `TSPL`, `EPL`, `CPCL`, `SBPL`)
   - Print Speed (ips)
   - Darkness / Heat

---

### C. White-Label Printable Area Clipping (सख्त सीमा नियम)
- यदि कोई बारकोड, टेक्स्ट या शेप सफ़ेद लेबल एरिया से बाहर जाता है:
  - **Designer Canvas** में वह धुंधला/वार्निंग के साथ दिखेगा (`⚠ Outside printable area`)।
  - **Print Preview**, **PDF Export**, **Windows Spooler** और **ZPL/TSPL प्रिंट** में बाहर का हिस्सा **पूरी तरह कट (Clip)** हो जाएगा, जिससे कोई गलत प्रिंटिंग नहीं होगी।

---

## 🛠️ 3. कौन-कौन सी फाइल्स में बदलाव हुआ? (Modified / Created Files)

1. **`src/types/index.ts`**
   - `ObjectPrintMethodSettings`, `TextPrintMethod`, `BarcodePrintMethod`, `ShapePrintMethod` टाइप्स जोड़े गए।
2. **`src/services/objectPrintMethodService.ts`** *(NEW)*
   - ग्लोबल और डॉक्यूमेंट सेटिंग्स का रिज़ॉल्वर इंजन और डायग्नोस्टिक लॉगर।
3. **`src/components/dialogs/PrintCenterDialog.tsx`**
   - पूरा प्रिंट डायलॉग BarTender-स्टाइल लेआउट और नए टैब्स के साथ दोबारा बनाया गया।
4. **`src/components/dialogs/ShowPrinterCodeModal.tsx`** *(NEW)*
   - ZPL/TSPL प्रिंट कोड व्यूअर, कॉपी और सेव-एज़ पॉपअप।
5. **`src/components/dialogs/PrinterCodeModifierModal.tsx`** *(NEW)*
   - प्रिंटर कोड मॉडिफायर और सब्स्टीट्यूशन रूल्स डायलॉग।
6. **`src/services/pdfExportService.ts`**
   - वेक्टर और रास्टर मोड के अनुसार PDF रेंडरिंग और स्ट्रिक्ट क्लिपिंग।
7. **`src/printing/renderers/zplRenderer.ts`**
   - ZPL इंजन में ऑब्जेक्ट प्रिंट मेथड और लेबल बाउंड्स क्लिपिंग।
8. **`electron/printer/printerIPC.ts` & `barcode-automation-backend/src/routes/printers.ts`**
   - Windows Spooler Queue Cancellation (`Get-PrintJob | Remove-PrintJob`) API।

---

## 🧪 4. आप इसे ऐप में कैसे टेस्ट कर सकते हैं? (How to Test)

1. BarcodeFlow ऐप में कोई लेबल खोलें।
2. कीबोर्ड पर **`Ctrl + P`** दबाएं (या **File &rarr; Print** पर क्लिक करें)।
3. ऊपर **`Object Print Method`** टैब पर जाएं:
   - `TrueType Text` को `Raster` करके देखें &rarr; Preview में टेक्स्ट रास्टर रूप में दिखेगा।
   - `Use Settings For This Document Only` टिक करके सेव करें &rarr; यह केवल इसी दस्तावेज़ में रहेगा।
4. वापस **`Print &rarr; Options`** पर जाएं:
   - `Show printer code at end of print job` पर टिक करें।
   - Output Protocol में `Zebra ZPL` चुनें और `Print` दबाएं &rarr; प्रिंट होने के बाद ZPL कोड की पॉपअप विंडो खुलेगी।
