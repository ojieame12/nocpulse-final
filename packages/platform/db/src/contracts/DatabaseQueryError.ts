export class DatabaseQueryError extends Error {
  constructor(context: string, message: string) {
    super(`[db] ${context}: ${message}`);
    this.name = "DatabaseQueryError";
  }
}
