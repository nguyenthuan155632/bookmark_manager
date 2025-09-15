import { useEffect } from 'react';

type SEOProps = {
  title?: string;
  description?: string;
  canonicalPath?: string; // path or full URL; if not set, uses current location
  noindex?: boolean;
  ogImage?: string;
  structuredData?: Record<string, any> | Array<Record<string, any>>;
};

function upsertMeta(name: string, content: string) {
  if (!content) return;
  let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertMetaProp(property: string, content: string) {
  if (!content) return;
  let el = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('property', property);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertCanonical(href: string) {
  if (!href) return;
  let el = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function upsertJsonLd(id: string, data: any) {
  const json = JSON.stringify(data);
  let el = document.getElementById(id) as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement('script');
    el.id = id;
    el.type = 'application/ld+json';
    document.head.appendChild(el);
  }
  el.textContent = json;
}

export function SEO({ title, description, canonicalPath, noindex, ogImage, structuredData }: SEOProps) {
  useEffect(() => {
    const baseTitle = 'Memorize';
    const fullTitle = title ? `${title} • ${baseTitle}` : baseTitle;
    if (fullTitle) document.title = fullTitle;

    const publicBase = (import.meta as any).env?.VITE_PUBLIC_BASE_URL as string | undefined;
    const loc = typeof window !== 'undefined' ? window.location : undefined;
    const canonical = canonicalPath
      ? canonicalPath.startsWith('http')
        ? canonicalPath
        : `${publicBase || loc?.origin || ''}${canonicalPath}`
      : loc
        ? loc.href
        : '';

    if (description) upsertMeta('description', description);
    if (noindex) upsertMeta('robots', 'noindex, nofollow');
    upsertCanonical(canonical);

    // Open Graph
    upsertMetaProp('og:type', 'website');
    upsertMetaProp('og:site_name', 'Memorize');
    if (title) upsertMetaProp('og:title', fullTitle);
    if (description) upsertMetaProp('og:description', description);
    if (canonical) upsertMetaProp('og:url', canonical);
    const defaultOg = ogImage || '/og-image.png';
    if (defaultOg) upsertMetaProp('og:image', defaultOg);

    // Twitter
    upsertMeta('twitter:card', defaultOg ? 'summary_large_image' : 'summary');
    if (title) upsertMeta('twitter:title', fullTitle);
    if (description) upsertMeta('twitter:description', description);
    if (defaultOg) upsertMeta('twitter:image', defaultOg);

    // Structured data: Organization + Website + SearchAction
    const baseUrl = publicBase || loc?.origin || '';
    const defaults = [
      {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'Memorize',
        url: baseUrl || undefined,
        logo: `${baseUrl}/favicon.svg`,
      },
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'Memorize',
        url: baseUrl || undefined,
        potentialAction: {
          '@type': 'SearchAction',
          target: `${baseUrl}/?q={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      },
    ];
    const data = structuredData
      ? Array.isArray(structuredData)
        ? structuredData
        : [structuredData]
      : defaults;
    upsertJsonLd('ld-json-structured-data', data);
  }, [title, description, canonicalPath, noindex, ogImage]);

  return null;
}
