/**
 * Provider Registry for BarcodeFlow Data Source Architecture
 */
import { IDataSourceProvider } from './IDataSourceProvider';

class ProviderRegistryClass {
  private providers = new Map<string, IDataSourceProvider>();

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
