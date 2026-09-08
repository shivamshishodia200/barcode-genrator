/**
 * Provider Registry for BarcodeFlow Data Source Architecture
 * Registers all Enterprise Data Source Providers
 */
import { IDataSourceProvider } from './IDataSourceProvider';
import { excelDataSourceProvider } from './ExcelDataSourceProvider';
import { sqlServerProvider } from './SqlServerProvider';
import { oracleProvider } from './OracleProvider';
import { sapIdocProvider } from './SapIdocProvider';
import { db2Provider } from './Db2Provider';
import { informixProvider } from './InformixProvider';
import { oleDbProvider } from './OleDbProvider';
import { odbcProvider } from './OdbcProvider';

class ProviderRegistryClass {
  private providers = new Map<string, IDataSourceProvider>();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults(): void {
    this.register(excelDataSourceProvider);
    this.register(sqlServerProvider);
    this.register(oracleProvider);
    this.register(sapIdocProvider);
    this.register(db2Provider);
    this.register(informixProvider);
    this.register(oleDbProvider);
    this.register(odbcProvider);
  }

  public register(provider: IDataSourceProvider): void {
    const key = provider.type.toLowerCase();
    this.providers.set(key, provider);
  }

  public get(type: string): IDataSourceProvider | undefined {
    return this.providers.get(type.toLowerCase());
  }

  public has(type: string): boolean {
    return this.providers.has(type.toLowerCase());
  }

  public listTypes(): string[] {
    return Array.from(this.providers.keys());
  }

  public clear(): void {
    this.providers.clear();
  }
}

export const ProviderRegistry = new ProviderRegistryClass();
export {
  excelDataSourceProvider,
  sqlServerProvider,
  oracleProvider,
  sapIdocProvider,
  db2Provider,
  informixProvider,
  oleDbProvider,
  odbcProvider,
};
