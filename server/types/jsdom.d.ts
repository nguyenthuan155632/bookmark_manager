declare module 'jsdom' {
  interface JSDOMOptions {
    url?: string;
  }

  export class JSDOM {
    constructor(html: string, options?: JSDOMOptions);
    window: Window & typeof globalThis;
  }
}
