import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft, Calendar, ExternalLink, Share2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Link, useLocation } from 'wouter';

interface SharedArticleData {
  id: number;
  title: string;
  summary: string;
  formattedContent: string;
  originalContent?: string;
  url: string;
  imageUrl?: string;
  publishedAt?: string;
  createdAt: string;
  sourceUrl: string;
}

export default function SharedArticlePage() {
  const [shareId, setShareId] = useState<string>('');
  const [location] = useLocation();
  const [formattedContent, setFormattedContent] = useState<Record<string, string>>({});

  useEffect(() => {
    // Extract shareId from URL path
    // eslint-disable-next-line no-useless-escape
    const pathMatch = location.match(/\/shared-article\/([^\/]+)/);
    if (pathMatch && pathMatch[1]) {
      setShareId(pathMatch[1]);
    }
  }, [location]);

  const {
    data: article,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['/api/shared-article', shareId],
    queryFn: async () => {
      if (!shareId) return null;

      const response = await fetch(`/api/shared-article/${shareId}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Article not found or is no longer shared');
        }
        throw new Error('Failed to fetch shared article');
      }

      const result = await response.json();
      return result.article as SharedArticleData;
    },
    enabled: !!shareId,
    retry: false,
  });

  // Content is now AI-formatted during crawling, no need for client-side rewriting
  useEffect(() => {
    if (article && article.formattedContent) {
      const contentId = `article-${article.id}`;
      // Set the formatted content directly from the article
      setFormattedContent((prev) => ({ ...prev, [contentId]: article.formattedContent }));
    }
  }, [article]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';

    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  // Render AI-rewritten content
  const renderContent = (content: string) => {
    if (!content || content.trim().length === 0) {
      return <div className="text-gray-500 italic">No content available for this article.</div>;
    }

    if (!article) {
      return <div className="text-gray-500 italic">Loading article...</div>;
    }

    const contentId = `article-${article.id}`;
    const contentToDisplay = formattedContent[contentId] || content;

    return (
      <div className="prose prose-sm sm:prose-base lg:prose-lg max-w-none prose-headings:font-semibold prose-h1:text-xl sm:prose-h1:text-2xl prose-h2:text-lg sm:prose-h2:text-xl prose-h3:text-base sm:prose-h3:text-lg prose-p:text-gray-700 prose-a:text-blue-600 prose-a:underline hover:prose-a:text-blue-800 prose-strong:text-gray-900 prose-em:text-gray-700 prose-code:bg-gray-100 prose-code:text-gray-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs sm:prose-code:text-sm prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-pre:p-4 prose-pre:rounded-lg prose-pre:overflow-x-auto prose-pre:font-mono prose-pre:text-xs sm:prose-pre:text-sm prose-blockquote:border-l-4 prose-blockquote:border-gray-300 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-gray-600 prose-blockquote:bg-gray-50 prose-blockquote:py-2 prose-blockquote:rounded-r prose-ul:ml-0 prose-ul:pl-4 prose-ul:space-y-2 prose-ol:ml-6 prose-ol:space-y-2 prose-ol:list-decimal prose-li:leading-relaxed prose-img:max-w-full prose-img:h-auto prose-img:rounded-lg prose-img:shadow-md prose-img:my-4 prose-img:mx-auto">
        <ReactMarkdown
          remarkPlugins={[]}
          rehypePlugins={[]}
          components={{
            h1: ({ children }) => (
              <h1 className="text-2xl font-bold mt-8 mb-6 text-gray-900 border-b border-gray-200 pb-2">
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 className="text-xl font-semibold mt-8 mb-4 text-gray-800 border-b border-gray-100 pb-1">
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 className="text-lg font-medium mt-6 mb-3 text-gray-700 flex items-center">
                {children}
              </h3>
            ),
            h4: ({ children }) => (
              <h4 className="text-base font-medium mt-5 mb-2 text-gray-700">{children}</h4>
            ),
            p: ({ children }) => <p className="mb-4 text-gray-700 leading-relaxed">{children}</p>,
            ul: ({ children }) => <ul className="mb-4 ml-6 space-y-2 text-gray-700">{children}</ul>,
            ol: ({ children }) => (
              <ol className="mb-4 ml-6 space-y-2 text-gray-700 list-decimal">{children}</ol>
            ),
            li: ({ children }) => <li className="leading-relaxed">{children}</li>,
            blockquote: ({ children }) => (
              <blockquote className="border-l-4 border-blue-300 pl-4 my-4 italic text-gray-600 bg-blue-50 py-2 rounded-r">
                {children}
              </blockquote>
            ),
            code(props: any) {
              const { inline, children } = props;
              if (inline) {
                return (
                  <code className="bg-gray-100 text-gray-800 px-1 py-0.5 rounded text-sm font-mono">
                    {children}
                  </code>
                );
              }
              return (
                <code className="block bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto font-mono text-sm my-4">
                  {children}
                </code>
              );
            },
            pre: ({ children }) => (
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto my-4">
                {children}
              </pre>
            ),
            strong: ({ children }) => (
              <strong className="font-semibold text-gray-900">{children}</strong>
            ),
            em: ({ children }) => <em className="italic text-gray-700">{children}</em>,
            a: ({ href, children }) => (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline transition-colors"
              >
                {children}
              </a>
            ),
            img: ({ src, alt }) => (
              <img
                src={src}
                alt={alt || ''}
                className="max-w-full h-auto rounded-lg shadow-md my-4 mx-auto"
              />
            ),
            table: ({ children }) => (
              <div className="overflow-x-auto my-4">
                <table className="min-w-full border border-gray-300">{children}</table>
              </div>
            ),
            th: ({ children }) => (
              <th className="border border-gray-300 bg-gray-100 px-4 py-2 text-left font-semibold text-gray-700">
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className="border border-gray-300 px-4 py-2 text-gray-700">{children}</td>
            ),
          }}
        >
          {contentToDisplay}
        </ReactMarkdown>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/10 flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading shared article...</p>
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="min-h-screen bg-muted/10 flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-foreground mb-2">Article Not Found</h1>
          <p className="text-muted-foreground mb-6">
            {error instanceof Error
              ? error.message
              : 'This shared article is not available or may have been removed.'}
          </p>
          <Link href="/">
            <Button variant="outline" className="inline-flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/10">
      {/* Header */}
      <header className="border-b bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Link href="/">
            <Button variant="ghost" size="sm" className="justify-start gap-2 px-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Button>
          </Link>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Share2 className="h-4 w-4" />
            <span>Shared Article</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8 sm:py-10">
        <article className="overflow-hidden rounded-2xl border bg-card shadow-md">
          {/* Article Header */}
          <div className="border-b p-6 sm:p-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex flex-col gap-2 text-sm text-muted-foreground md:flex-row md:items-center md:space-x-4">
                {article.publishedAt && (
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 mr-1" />
                    {formatDate(article.publishedAt)}
                  </div>
                )}
                <div className="flex items-center">
                  <span>Source:</span>
                  <a
                    href={article.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-1 text-primary hover:underline"
                  >
                    {new URL(article.sourceUrl).hostname}
                  </a>
                </div>
              </div>

              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 sm:px-4"
              >
                <ExternalLink className="h-4 w-4" />
                <span className="hidden sm:inline">View Original</span>
                <span className="sr-only sm:hidden">View Original</span>
              </a>
            </div>

            <h1 className="text-xl font-bold leading-tight text-foreground sm:text-2xl">
              {article.title}
            </h1>

            {article.imageUrl && (
              <div className="mt-6">
                <img
                  src={article.imageUrl}
                  alt={article.title}
                  className="h-auto w-full max-h-[26rem] rounded-xl object-cover shadow-md"
                />
              </div>
            )}
          </div>

          {/* Summary Section */}
          <div className="border-b border-primary/20 bg-primary/10 p-6 sm:p-8">
            <h2 className="mb-4 flex items-center text-xl font-semibold text-primary">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
              Summary
            </h2>
            <div className="prose prose-sm sm:prose-base max-w-none text-muted-foreground">
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p className="mb-3 leading-relaxed">{children}</p>,
                  strong: ({ children }) => (
                    <strong className="font-semibold text-primary">{children}</strong>
                  ),
                  em: ({ children }) => <em className="italic text-primary/80">{children}</em>,
                }}
              >
                {article.summary}
              </ReactMarkdown>
            </div>
          </div>

          {/* Content Section */}
          <div className="p-4 sm:p-6 lg:p-8">
            {renderContent(article.formattedContent)}
          </div>

          {/* Footer */}
          <div className="border-t bg-muted/40 p-6 sm:p-8">
            <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <div>Shared via Memorize Vault</div>
              <div>{formatDate(article.createdAt)}</div>
            </div>
          </div>
        </article>
      </main>
    </div>
  );
}
