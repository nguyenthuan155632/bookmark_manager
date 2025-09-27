declare module '@mozilla/readability' {
  export class Readability {
    constructor(document: Document);
    parse(): {
      title: string;
      content: string;
      textContent: string;
      length: number;
      excerpt: string;
      byline: string | null;
      siteName: string | null;
    } | null;
  }
}
