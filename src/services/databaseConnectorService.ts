import { DatabaseConnectionConfig } from '../types';

// Enterprise Database Connector Helpers

/**
 * Parses raw CSV string into fields and records
 */
export function parseCSVToDatabaseConnection(csvText: string, connectionName: string = 'Imported CSV'): DatabaseConnectionConfig {
  const lines = csvText.trim().split(/\r?\n/);
  if (!lines.length) {
    return {
      id: `db-${Date.now()}`,
      name: connectionName,
      type: 'csv',
      fields: [],
      records: [],
    };
  }

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        inQuotes = !inQuotes;
      } else if (c === ',' && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    result.push(cur.trim());
    return result;
  };

  const fields = parseLine(lines[0]);
  const records: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = parseLine(lines[i]);
    const row: Record<string, string> = {};
    fields.forEach((field, fIdx) => {
      row[field] = values[fIdx] || '';
    });
    records.push(row);
  }

  return {
    id: `db-${Date.now()}`,
    name: connectionName,
    type: 'csv',
    fields,
    records,
  };
}
