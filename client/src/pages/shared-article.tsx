import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft, Clock, ExternalLink, Home, Sparkles } from 'lucide-react';
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
  const { user } = useAuth();
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
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHours / 24);

      if (diffHours < 1) return 'Just now';
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;

      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  };

  const getSourceDomain = (url: string) => {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  // Render AI-rewritten content
  const renderContent = (content: string) => {
    if (!content || content.trim().length === 0) {
      return <div className="text-muted-foreground italic">No content available for this article.</div>;
    }

    if (!article) {
      return <div className="text-muted-foreground italic">Loading article...</div>;
    }

    const contentId = `article-${article.id}`;
    const contentToDisplay = formattedContent[contentId] || content;

    return (
      <div className="prose prose-sm sm:prose-base lg:prose-lg max-w-none prose-headings:font-bold prose-h1:text-2xl sm:prose-h1:text-3xl prose-h2:text-xl sm:prose-h2:text-2xl prose-h3:text-lg sm:prose-h3:text-xl prose-p:text-foreground prose-p:leading-relaxed prose-a:text-purple-600 dark:prose-a:text-purple-400 prose-a:underline hover:prose-a:text-pink-600 dark:hover:prose-a:text-pink-400 prose-strong:text-foreground prose-strong:font-bold prose-em:text-purple-600 dark:prose-em:text-purple-400 prose-code:bg-purple-100 dark:prose-code:bg-purple-900/30 prose-code:text-purple-700 dark:prose-code:text-purple-300 prose-code:px-2 prose-code:py-1 prose-code:rounded prose-code:text-sm prose-pre:bg-gradient-to-br prose-pre:from-purple-50 prose-pre:to-pink-50 dark:prose-pre:from-purple-900/20 dark:prose-pre:to-pink-900/20 prose-pre:text-foreground prose-pre:p-4 prose-pre:rounded-xl prose-pre:overflow-x-auto prose-pre:border prose-pre:border-purple-200 dark:prose-pre:border-purple-800 prose-blockquote:border-l-4 prose-blockquote:border-purple-500 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-foreground prose-blockquote:bg-gradient-to-r prose-blockquote:from-purple-50 prose-blockquote:to-pink-50 dark:prose-blockquote:from-purple-900/20 dark:prose-blockquote:to-pink-900/20 prose-blockquote:py-3 prose-blockquote:rounded-r-xl prose-ul:space-y-2 prose-ol:space-y-2 prose-li:leading-relaxed prose-img:rounded-2xl prose-img:shadow-xl prose-img:my-6">
        <ReactMarkdown
          remarkPlugins={[]}
          rehypePlugins={[]}
          components={{
            h1: ({ children }) => (
              <h1 className="text-3xl font-black mt-10 mb-6 text-foreground bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent pb-3 border-b-2 border-purple-200 dark:border-purple-800">
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 className="text-2xl font-bold mt-8 mb-4 text-foreground flex items-center gap-2 pb-2 border-b border-purple-200 dark:border-purple-800">
                <span className="h-2 w-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500" />
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 className="text-xl font-bold mt-6 mb-3 text-purple-600 dark:text-purple-400 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
                {children}
              </h3>
            ),
            h4: ({ children }) => (
              <h4 className="text-lg font-semibold mt-5 mb-2 text-foreground">{children}</h4>
            ),
            p: ({ children }) => <p className="mb-5 text-foreground leading-relaxed text-base">{children}</p>,
            ul: ({ children }) => <ul className="mb-6 ml-6 space-y-3 text-foreground list-disc marker:text-purple-500">{children}</ul>,
            ol: ({ children }) => (
              <ol className="mb-6 ml-6 space-y-3 text-foreground list-decimal marker:text-purple-500 marker:font-bold">{children}</ol>
            ),
            li: ({ children }) => <li className="leading-relaxed pl-2">{children}</li>,
            blockquote: ({ children }) => (
              <blockquote className="border-l-4 border-purple-500 pl-6 my-6 italic text-foreground bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 py-4 pr-4 rounded-r-xl shadow-sm">
                {children}
              </blockquote>
            ),
            code(props: any) {
              const { inline, children } = props;
              if (inline) {
                return (
                  <code className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-1 rounded font-mono text-sm font-semibold">
                    {children}
                  </code>
                );
              }
              return (
                <code className="block bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 text-foreground border-2 border-purple-200 dark:border-purple-800 p-4 rounded-xl overflow-x-auto font-mono text-sm my-6 shadow-sm">
                  {children}
                </code>
              );
            },
            pre: ({ children }) => (
              <pre className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 text-foreground border-2 border-purple-200 dark:border-purple-800 p-4 rounded-xl overflow-x-auto my-6 shadow-sm">
                {children}
              </pre>
            ),
            strong: ({ children }) => (
              <strong className="font-bold text-foreground bg-purple-100 dark:bg-purple-900/20 px-1 rounded">{children}</strong>
            ),
            em: ({ children }) => <em className="italic text-purple-600 dark:text-purple-400 not-italic font-medium">{children}</em>,
            a: ({ href, children }) => (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-600 dark:text-purple-400 hover:text-pink-600 dark:hover:text-pink-400 underline underline-offset-4 decoration-2 transition-colors font-medium"
              >
                {children}
              </a>
            ),
            img: ({ src, alt }) => (
              <img
                src={src}
                alt={alt || ''}
                className="max-w-full h-auto rounded-2xl shadow-xl my-6 mx-auto border-4 border-purple-100 dark:border-purple-900/30"
              />
            ),
            table: ({ children }) => (
              <div className="overflow-x-auto my-6 rounded-xl border-2 border-purple-200 dark:border-purple-800 shadow-lg">
                <table className="min-w-full">{children}</table>
              </div>
            ),
            th: ({ children }) => (
              <th className="border-b-2 border-purple-200 dark:border-purple-800 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 px-4 py-3 text-left font-bold text-purple-700 dark:text-purple-300">
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className="border-b border-purple-100 dark:border-purple-900/30 px-4 py-3 text-foreground">{children}</td>
            ),
          }}
        >
          {contentToDisplay}
        </ReactMarkdown>
      </div>
    );
  };

  const backUrl = user ? '/ai-feed-management' : '/discover';
  const backTitle = user ? 'Back to Home' : 'Back to Discover';

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-gray-900 dark:via-purple-900/20 dark:to-blue-900/20 flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <div className="mx-auto h-16 w-16 animate-spin rounded-full border-4 border-purple-200 border-t-purple-600 dark:border-purple-800 dark:border-t-purple-400" />
          <p className="text-sm font-semibold text-purple-600 dark:text-purple-400">Loading article...</p>
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-gray-900 dark:via-purple-900/20 dark:to-blue-900/20 flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-3xl border-2 border-purple-200 dark:border-purple-800 bg-white dark:bg-gray-800 p-8 text-center shadow-2xl">
          <AlertCircle className="h-16 w-16 text-purple-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
            Article Not Found
          </h1>
          <p className="text-muted-foreground mb-6">
            {error instanceof Error
              ? error.message
              : 'This article is not available or may have been removed.'}
          </p>
          <Link href={backUrl}>
            <Button className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
              <ArrowLeft className="h-4 w-4" />
              {backTitle}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-gray-900 dark:via-purple-900/20 dark:to-blue-900/20">
      {/* Floating Back Button */}
      <Link href={backUrl} className="fixed bottom-6 right-6 z-50">
        <Button
          size="icon"
          className="h-14 w-14 rounded-full shadow-lg hover:shadow-2xl transition-all duration-300 bg-gradient-to-br from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 hover:scale-110 p-0"
          title={backTitle}
        >
          <Home className="h-6 w-6" />
        </Button>
      </Link>

      {/* Hero Header with Gradient */}
      <header className="border-b border-purple-200/50 dark:border-purple-800/30 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl sticky top-0 z-40 shadow-sm">
        <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between">
            <Link href={backUrl}>
              <Button variant="ghost" size="sm" className="gap-2 hover:bg-purple-100 dark:hover:bg-purple-900/30">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">{user ? 'Back to Home' : 'Back to Discover'}</span>
              </Button>
            </Link>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-100 dark:bg-purple-900/30">
              <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              <span className="text-sm font-semibold text-purple-600 dark:text-purple-400">Featured Article</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <article className="space-y-6">
          {/* Hero Image */}
          {article.imageUrl && (
            <div className="relative overflow-hidden rounded-3xl shadow-2xl">
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent z-10" />
              <img
                src={article.imageUrl}
                alt={article.title}
                className="h-auto w-full max-h-[32rem] object-cover"
              />
            </div>
          )}

          {/* Article Meta & Title */}
          <div className="space-y-4">
            {/* Meta Info */}
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 font-semibold">
                <Clock className="h-3.5 w-3.5" />
                {formatDate(article.createdAt)}
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-pink-100 dark:bg-pink-900/30">
                <span className="text-xs font-medium text-muted-foreground">Source:</span>
                <a
                  href={article.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-pink-600 dark:text-pink-400 hover:underline"
                >
                  {getSourceDomain(article.sourceUrl)}
                </a>
              </div>
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-semibold hover:from-purple-600 hover:to-pink-600 transition-all shadow-md hover:shadow-lg"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Read Original</span>
              </a>
            </div>

            {/* Title */}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black leading-tight bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              {article.title}
            </h1>
          </div>

          {/* Summary Card */}
          <div className="rounded-3xl border-2 border-purple-200/50 dark:border-purple-800/30 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-6 sm:p-8 shadow-lg">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <h2 className="text-xl font-bold text-purple-600 dark:text-purple-400">Summary</h2>
            </div>
            <div className="prose prose-sm sm:prose-base max-w-none">
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p className="mb-3 leading-relaxed text-foreground">{children}</p>,
                  strong: ({ children }) => (
                    <strong className="font-bold text-purple-600 dark:text-purple-400">{children}</strong>
                  ),
                  em: ({ children }) => <em className="italic text-pink-600 dark:text-pink-400">{children}</em>,
                }}
              >
                {article.summary}
              </ReactMarkdown>
            </div>
          </div>

          {/* Content */}
          <div className="rounded-3xl border border-purple-200/30 dark:border-purple-800/20 bg-white dark:bg-gray-800 p-6 sm:p-8 lg:p-12 shadow-xl">
            {renderContent(article.formattedContent)}
          </div>

          {/* Footer CTA */}
          <div className="rounded-3xl border-2 border-dashed border-purple-300 dark:border-purple-700 bg-gradient-to-r from-purple-100/50 to-pink-100/50 dark:from-purple-900/20 dark:to-pink-900/20 p-8 text-center">
            <Sparkles className="h-12 w-12 mx-auto mb-4 text-purple-500" />
            <h3 className="text-xl font-bold mb-2 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Want more amazing content?
            </h3>
            <p className="text-muted-foreground mb-4">
              Discover trending articles and stay updated with the latest news
            </p>
            <Link href={backUrl}>
              <Button
                size="lg"
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 shadow-lg hover:shadow-xl transition-all"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {user ? 'Back to Home' : 'Explore More Articles'}
              </Button>
            </Link>
          </div>
        </article>
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-purple-200/50 dark:border-purple-800/30 bg-white/50 dark:bg-gray-900/50 backdrop-blur-xl py-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-500" />
              <span className="font-semibold">Shared via Memorize Vault</span>
            </div>
            <p className="text-xs">{formatDate(article.createdAt)}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
