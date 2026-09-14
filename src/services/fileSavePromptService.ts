/**
 * FileSavePromptService
 * Enterprise File & PDF Destination Picker Service
 *
 * Solves the issue where printing or exporting silently downloads into the Downloads folder.
 * Provides:
 * 1. Native Windows "Save As" file/folder picker dialog on every print (showSaveFilePicker / showSavePdfDialog).
 * 2. Pre-selection of a dedicated output folder (showDirectoryPicker / showDirectoryDialog).
 * 3. Graceful handling of user cancellation, error recovery, and cross-environment support (Electron & Web Browser).
 */

export interface SavePdfOptions {
  data: Blob | Uint8Array | string; // PDF Blob, binary Uint8Array, or base64
  defaultFileName: string;
  targetFolderHandle?: any; // FileSystemDirectoryHandle if user pre-selected a folder
  targetFolderPath?: string; // string path for Electron if pre-selected
}

export interface SavePdfResult {
  status: 'completed' | 'cancelled' | 'failed';
  filePath?: string;
  fileName?: string;
  error?: string;
}

/**
 * Prompts user with native folder/file destination dialog and saves the PDF.
 */
export async function promptSavePdfFile(options: SavePdfOptions): Promise<SavePdfResult> {
  const { data, defaultFileName, targetFolderHandle, targetFolderPath } = options;
  const baseName = (defaultFileName || 'Document1').replace(/[\/\\:*?"<>|]/g, '_');
  const safeFileName = baseName.endsWith('.pdf') ? baseName : `${baseName}.pdf`;

  // Prepare Blob and Base64 representations
  let pdfBlob: Blob;
  let base64Data: string = '';

  if (data instanceof Blob) {
    pdfBlob = data;
  } else if (typeof data === 'string') {
    const cleaned = data.includes(',') ? data.split(',')[1] : data;
    base64Data = cleaned;
    const binary = atob(cleaned);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    pdfBlob = new Blob([bytes], { type: 'application/pdf' });
  } else {
    // Uint8Array
    pdfBlob = new Blob([data], { type: 'application/pdf' });
  }

  // 1. If user previously pre-selected a target folder handle (Web Browser File System Access API)
  if (targetFolderHandle && typeof targetFolderHandle.getFileHandle === 'function') {
    try {
      const fileHandle = await targetFolderHandle.getFileHandle(safeFileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(pdfBlob);
      await writable.close();
      return {
        status: 'completed',
        fileName: safeFileName,
        filePath: `${targetFolderHandle.name}/${safeFileName}`,
      };
    } catch (err: any) {
      console.warn('[FileSavePromptService] Writing to pre-selected folder failed, prompting Save As dialog:', err);
    }
  }

  // 2. Electron Desktop Environment (Native Windows Save As Dialog)
  const electronAPI = typeof window !== 'undefined' ? (window as any).electronAPI : undefined;
  if (electronAPI?.showSavePdfDialog) {
    try {
      const dialogRes = await electronAPI.showSavePdfDialog(safeFileName, targetFolderPath);
      if (dialogRes.canceled || !dialogRes.filePath) {
        return { status: 'cancelled' };
      }
      if (!base64Data) {
        const reader = new FileReader();
        base64Data = await new Promise<string>((resolve) => {
          reader.onloadend = () => {
            const res = reader.result as string;
            resolve(res.includes(',') ? res.split(',')[1] : res);
          };
          reader.readAsDataURL(pdfBlob);
        });
      }
      const writeRes = await electronAPI.saveBinaryFile(dialogRes.filePath, base64Data);
      if (writeRes.success) {
        if (electronAPI.openDocumentFile) {
          electronAPI.openDocumentFile(dialogRes.filePath).catch(() => {});
        }
        return {
          status: 'completed',
          filePath: dialogRes.filePath,
          fileName: dialogRes.fileName || safeFileName,
        };
      }
      return { status: 'failed', error: writeRes.error || 'Failed to write file to disk' };
    } catch (err: any) {
      return { status: 'failed', error: err.message };
    }
  }

  // 3. Web Browser: File System Access API (Native Windows "Save As" Dialog)
  // Supported in Chrome, Microsoft Edge, Opera, Brave
  if (typeof (window as any).showSaveFilePicker === 'function') {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: safeFileName,
        types: [
          {
            description: 'PDF Document (*.pdf)',
            accept: { 'application/pdf': ['.pdf'] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(pdfBlob);
      await writable.close();
      return {
        status: 'completed',
        fileName: handle.name || safeFileName,
        filePath: handle.name || safeFileName,
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { status: 'cancelled' };
      }
      console.warn('[FileSavePromptService] showSaveFilePicker error, falling back to download:', err);
    }
  }

  // 4. Browser Download Fallback (if browser blocks or doesn't support showSaveFilePicker)
  try {
    const blobUrl = URL.createObjectURL(pdfBlob);
    const link = window.document.createElement('a');
    link.href = blobUrl;
    link.download = safeFileName;
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
    return {
      status: 'completed',
      fileName: safeFileName,
      filePath: safeFileName,
    };
  } catch (err: any) {
    return { status: 'failed', error: err.message };
  }
}

/**
 * Prompts the user to pick a folder on their PC.
 * Can be used to set a default destination folder for printing.
 */
export async function promptSelectFolder(): Promise<{
  canceled: boolean;
  folderHandle?: any;
  folderName?: string;
  folderPath?: string;
  error?: string;
}> {
  // Electron Desktop
  const electronAPI = typeof window !== 'undefined' ? (window as any).electronAPI : undefined;
  if (electronAPI?.showDirectoryDialog) {
    try {
      const res = await electronAPI.showDirectoryDialog();
      if (res.canceled || !res.folderPath) {
        return { canceled: true };
      }
      return {
        canceled: false,
        folderPath: res.folderPath,
        folderName: res.folderPath.split(/[\\/]/).pop() || res.folderPath,
      };
    } catch (err: any) {
      return { canceled: true, error: err.message };
    }
  }

  // Web Browser (Chrome / Edge / Opera)
  if (typeof (window as any).showDirectoryPicker === 'function') {
    try {
      const handle = await (window as any).showDirectoryPicker({
        mode: 'readwrite',
      });
      return {
        canceled: false,
        folderHandle: handle,
        folderName: handle.name,
        folderPath: handle.name,
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { canceled: true };
      }
      return { canceled: true, error: err.message };
    }
  }

  return { canceled: true, error: 'Folder selection is not supported in this browser.' };
}
