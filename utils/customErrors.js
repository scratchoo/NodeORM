export class RecordNotFoundError extends Error {
  constructor(message) {
    super(message); // (1)
    this.name = "RecordNotFoundError"; // (2)
  }
}