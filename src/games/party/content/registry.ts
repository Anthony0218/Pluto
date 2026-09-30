export class Registry<T extends { id: string }> {
  private entries = new Map<string, T>();
  register(definition: T): void {
    if (this.entries.has(definition.id))
      throw new Error(`Duplicate content: ${definition.id}`);
    this.entries.set(definition.id, definition);
  }
  get(id: string): T {
    const definition = this.entries.get(id);
    if (!definition) throw new Error(`Unknown content: ${id}`);
    return definition;
  }
  all(): T[] {
    return [...this.entries.values()];
  }
}
