import { jsPDF } from 'jspdf';
import { LabelTemplate, LabelElement } from '../types';
import { generateBarcodeSVG, renderBarcodeToCanvas } from './barcodeEngine';
import { evaluateElementData } from './dataSourceEngine';
import { isObjectCompletelyOutOfBounds } from './labelGeometry';
import { resolveObjectPrintMethod, getEffectiveObjectPrintMethodSettings } from './objectPrintMethodService';

/**
 * Exports single or batch labels to a high-resolution Vector PDF
 */
export async function exportLabelsToPDF(
  template: LabelTemplate,
  records: Record<string, string>[] = [{}],
  copiesPerRecord: number = 1
): Promise<Blob> {
  const isLandscape = template.dimensions.width > template.dimensions.height;
  const orientation = isLandscape ? 'landscape' : 'portrait';
  const widthMm = template.dimensions.width;
  const heightMm = template.dimensions.height;

  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: [widthMm, heightMm],
    compress: true,
  });

  const totalLabels = records.length * copiesPerRecord;
  let labelIndex = 0;

  for (let r = 0; r < records.length; r++) {
    const record = records[r] || {};

    for (let c = 0; c < copiesPerRecord; c++) {
      if (labelIndex > 0) {
        pdf.addPage([widthMm, heightMm], orientation);
      }

      await renderTemplateToPDFPage(pdf, template, record, labelIndex, r, c);
      labelIndex++;
    }
  }

  return pdf.output('blob');
}

/**
 * Internal renderer for a single PDF page
 */
async function renderTemplateToPDFPage(
  pdf: jsPDF,
  template: LabelTemplate,
  record: Record<string, string>,
  labelIndex: number = 0,
  recordIndex: number = 0,
  copyIndex: number = 0
): Promise<void> {
  const sorted = [...template.elements].sort((a, b) => a.zIndex - b.zIndex);
  const settings = getEffectiveObjectPrintMethodSettings(template);

  for (const el of sorted) {
    if (!el.visible || isObjectCompletelyOutOfBounds(el, template)) continue;

    const resolution = resolveObjectPrintMethod({
      element: el,
      outputProtocol: 'pdf',
      settings,
    });

    switch (el.type) {
      case 'shape': {
        const strokeW = el.strokeWidth || 0.3;
        pdf.setLineWidth(strokeW);
        
        if (el.fillColor && el.fillColor !== 'transparent') {
          pdf.setFillColor(el.fillColor);
        }
        if (el.strokeColor && el.strokeColor !== 'transparent') {
          pdf.setDrawColor(el.strokeColor);
        }

        const style = el.fillColor && el.fillColor !== 'transparent'
          ? (el.strokeColor && el.strokeColor !== 'transparent' ? 'FD' : 'F')
          : 'S';

        if (el.shapeType === 'rectangle') {
          if (el.cornerRadius > 0) {
            pdf.roundedRect(el.x, el.y, el.width, el.height, el.cornerRadius, el.cornerRadius, style);
          } else {
            pdf.rect(el.x, el.y, el.width, el.height, style);
          }
        } else if (el.shapeType === 'circle' || el.shapeType === 'ellipse') {
          pdf.ellipse(el.x + el.width / 2, el.y + el.height / 2, el.width / 2, el.height / 2, style);
        } else if (el.shapeType === 'line') {
          pdf.line(el.x, el.y, el.x + el.width, el.y + el.height);
        }
        break;
      }

      case 'text': {
        const textVal = evaluateElementData(el, {
          record,
          printIndex: labelIndex,
          currentRecordIndex: recordIndex,
          copyNumber: copyIndex,
        });

        if (resolution.resolvedMethod === 'raster') {
          // Raster Text Pipeline: Render bitmap canvas and embed image
          const canvas = document.createElement('canvas');
          const scale = 4;
          canvas.width = Math.max(10, Math.round(el.width * scale * 3.78));
          canvas.height = Math.max(10, Math.round(el.height * scale * 3.78));
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.scale(scale * 3.78 / 1, scale * 3.78 / 1);
            ctx.fillStyle = el.color || '#000000';
            ctx.font = `${el.fontWeight || 'normal'} ${el.fontSize * 0.3527}mm ${el.fontFamily || 'Arial'}`;
            ctx.textBaseline = 'top';
            ctx.fillText(textVal, 0, 0, el.width);
            const imgData = canvas.toDataURL('image/png');
            pdf.addImage(imgData, 'PNG', el.x, el.y, el.width, el.height);
          }
        } else {
          // Vector / Native Text Pipeline
          pdf.setFontSize(el.fontSize);
          pdf.setTextColor(el.color || '#000000');
          pdf.setFont('helvetica', el.fontWeight === 'bold' || el.fontWeight === '700' || el.fontWeight === '800' ? 'bold' : 'normal');

          const textLines = pdf.splitTextToSize(textVal, el.width);
          const align = el.textAlign === 'center' ? 'center' : el.textAlign === 'right' ? 'right' : 'left';
          const posX = align === 'center' ? el.x + el.width / 2 : align === 'right' ? el.x + el.width : el.x;
          
          // Approximate baseline offset from top
          const baselineOffset = el.fontSize * 0.35;
          pdf.text(textLines, posX, el.y + baselineOffset, { align });
        }
        break;
      }

      case 'barcode': {
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(el.width * 8);
        canvas.height = Math.round(el.height * 8);

        try {
          await renderBarcodeToCanvas(canvas, el as any, 4, {
            record,
            printIndex: labelIndex,
            currentRecordIndex: recordIndex,
            copyNumber: copyIndex,
          });
          const dataUrl = canvas.toDataURL('image/png');
          pdf.addImage(dataUrl, 'PNG', el.x, el.y, el.width, el.height);
        } catch (e) {
          // Fallback box
          pdf.setDrawColor('#ff0000');
          pdf.rect(el.x, el.y, el.width, el.height);
        }
        break;
      }

      case 'image': {
        if (el.src) {
          try {
            pdf.addImage(el.src, 'JPEG', el.x, el.y, el.width, el.height);
          } catch (e) {
            // ignore broken image
          }
        }
        break;
      }

      case 'table': {
        const borderW = el.borderWidth || 0.3;
        pdf.setLineWidth(borderW);
        pdf.setDrawColor(el.borderColor || '#000000');
        pdf.setFontSize(el.fontSize || 8);

        const colW = el.width / (el.cols || 1);
        const rowH = el.rowHeight || 6;

        for (let r = 0; r < el.rows; r++) {
          for (let c = 0; c < el.cols; c++) {
            const cellX = el.x + c * colW;
            const cellY = el.y + r * rowH;
            pdf.rect(cellX, cellY, colW, rowH);

            const cell = el.cells?.[r]?.[c];
            if (cell && cell.content) {
              let content = cell.content;
              if (cell.dataBinding && record[cell.dataBinding]) {
                content = record[cell.dataBinding];
              }
              pdf.text(content, cellX + 1.5, cellY + rowH * 0.7);
            }
          }
        }
        break;
      }
    }
  }
}

export async function exportTemplateToPdf(
  template: LabelTemplate,
  records: Record<string, string>[] = [{}]
): Promise<{ save: (filename: string) => void }> {
  const blob = await exportLabelsToPDF(template, records);
  return {
    save: (filename: string) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    },
  };
}
