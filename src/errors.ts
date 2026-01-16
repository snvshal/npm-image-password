export class ImagePasswordError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImagePasswordError';
  }
}

export class InputTooLargeError extends ImagePasswordError {
  constructor(
    public readonly size: number,
    public readonly max: number,
  ) {
    super(`Input too large: ${size} > ${max}`);
    this.name = 'InputTooLargeError';
  }
}

export class FetchFailedError extends ImagePasswordError {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
  ) {
    super(`Failed to fetch image: ${status} ${statusText}`);
    this.name = 'FetchFailedError';
  }
}

export class UnsupportedInputError extends ImagePasswordError {
  constructor() {
    super('Unsupported image input');
    this.name = 'UnsupportedInputError';
  }
}

