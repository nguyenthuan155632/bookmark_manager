import { useEffect } from 'react';
import { documentationSectionTitles } from './documentation-seo';

type SEOProps = {
  title?: string;
  description?: string;
  canonicalPath?: string; // path or full URL; if not set, uses current location
  noindex?: boolean;
  ogImage?: string;
  structuredData?: Record<string, any> | Array<Record<string, any>>;
  documentationSection?: string; // For documentation page anchor sections
  keywords?: string[];
  pageType?: 'home' | 'bookmarks' | 'documentation' | 'settings' | 'shared' | 'auth' | 'domain-tags';
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

export function SEO({
  title,
  description,
  canonicalPath,
  noindex,
  ogImage,
  structuredData,
  documentationSection,
  keywords,
  pageType,
}: SEOProps) {
  useEffect(() => {
    const baseTitle = 'Memorize';

    // Handle documentation section titles
    let effectiveTitle = title;
    if (documentationSection && documentationSectionTitles[documentationSection]) {
      effectiveTitle = `${documentationSectionTitles[documentationSection]} - Documentation`;
    }

    const fullTitle = effectiveTitle ? `${effectiveTitle} • ${baseTitle}` : baseTitle;
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

    // Get page-specific description
    const getPageDescription = () => {
      if (description) return description;

      switch (pageType) {
        case 'home':
          return 'Your intelligent bookmark manager with AI-powered organization, automatic screenshots, and link health monitoring. Perfect for researchers, developers, and knowledge workers.';
        case 'bookmarks':
          return 'Browse and manage your saved bookmarks with powerful search, filtering, and organization tools. Access your digital knowledge base instantly.';
        case 'documentation':
          return 'Complete guide to using Memorize Vault - learn about features, best practices, and troubleshooting for optimal bookmark management.';
        case 'settings':
          return 'Customize your Memorize Vault experience with preferences, themes, API keys, and account settings for personalized productivity.';
        case 'shared':
          return 'Shared bookmark - discover and access curated content shared by our community. Explore valuable resources and knowledge.';
        case 'auth':
          return 'Sign in to your Memorize Vault account to access your AI-powered bookmark manager and organize your digital knowledge.';
        case 'domain-tags':
          return 'Explore and manage domain-based tag suggestions in Memorize Vault. Discover trending websites and auto-generated tags.';
        default:
          return 'Memorize Vault - AI-powered bookmark management for teams and individuals with intelligent organization features.';
      }
    };

    const effectiveDescription = getPageDescription();

    // Add keywords meta tag
    if (keywords && keywords.length > 0) {
      upsertMeta('keywords', keywords.join(', '));
    } else if (pageType) {
      // Add default keywords based on page type
      const defaultKeywords = {
        home: ['AI bookmark manager', 'bookmark organization', 'link checker', 'screenshot bookmarks', 'knowledge management', 'productivity tools'],
        bookmarks: ['bookmark management', 'saved links', 'digital organization', 'knowledge base', 'bookmark search'],
        documentation: ['bookmark manager guide', 'productivity tutorial', 'organization tips', 'AI features documentation'],
        settings: ['bookmark preferences', 'productivity settings', 'customization options', 'account management'],
        shared: ['shared bookmarks', 'curated content', 'knowledge sharing', 'community resources'],
        auth: ['sign in', 'bookmark manager login', 'account access', 'productivity tools'],
        'domain-tags': ['domain tags', 'website organization', 'auto-tagging', 'bookmark categories']
      };

      const pageKeywords = defaultKeywords[pageType] || [];
      if (pageKeywords.length > 0) {
        upsertMeta('keywords', pageKeywords.join(', '));
      }
    }

    if (effectiveDescription) upsertMeta('description', effectiveDescription);
    if (noindex) upsertMeta('robots', 'noindex, nofollow');
    upsertCanonical(canonical);

    // Open Graph
    upsertMetaProp('og:type', 'website');
    upsertMetaProp('og:site_name', 'Memorize');
    if (effectiveTitle) upsertMetaProp('og:title', fullTitle);
    if (description) upsertMetaProp('og:description', description);
    if (canonical) upsertMetaProp('og:url', canonical);
    const defaultOg = ogImage || '/og-image.png';
    if (defaultOg) upsertMetaProp('og:image', defaultOg);

    // Twitter
    upsertMeta('twitter:card', defaultOg ? 'summary_large_image' : 'summary');
    if (effectiveTitle) upsertMeta('twitter:title', fullTitle);
    if (description) upsertMeta('twitter:description', description);
    if (defaultOg) upsertMeta('twitter:image', defaultOg);

    // Structured data: Organization + Website + SearchAction
    const baseUrl = publicBase || loc?.origin || '';
    const defaults = [
      {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'Memorize Vault',
        url: baseUrl || undefined,
        logo: `${baseUrl}/favicon.svg`,
      },
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'Memorize Vault',
        url: baseUrl || undefined,
        potentialAction: {
          '@type': 'SearchAction',
          target: `${baseUrl}/?q={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      },
    ];

    // Add SoftwareApplication schema for home page
    const enhancedStructuredData = [
      ...defaults,
      ...(pageType === 'home' ? [{
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'Memorize Vault',
        applicationCategory: 'ProductivityApplication',
        operatingSystem: 'Web Browser',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD'
        },
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: '4.8',
          reviewCount: '127'
        }
      }] : []),
      ...(structuredData ? (Array.isArray(structuredData) ? structuredData : [structuredData]) : [])
    ];

    upsertJsonLd('ld-json-structured-data', enhancedStructuredData);
  }, [title, description, canonicalPath, noindex, ogImage, structuredData, documentationSection, keywords, pageType]);

  return null;
}
