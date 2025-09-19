import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Link } from 'wouter';
import { AlertCircle, Home, BookOpenText, Mail, ArrowRight } from 'lucide-react';

export default function NotFound() {
  const isDev = import.meta.env.MODE !== 'production';

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-muted/30 px-4 py-12">
      <Card className="w-full max-w-3xl shadow-sm border-muted/60">
        <CardContent className="p-8 md:p-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="max-w-xl space-y-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-10 w-10 text-red-500" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium text-red-500">404 — Page Missing</p>
                  <h1 className="text-3xl font-semibold text-foreground">Looks like this bookmark is no longer stored</h1>
                </div>
              </div>

              <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                The link you followed might be broken, or the page may have been moved. Try one of the quick
                actions below to get back on track.
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  {
                    to: '/',
                    label: 'Back to dashboard',
                    description: 'See your bookmarks and shared vaults',
                    icon: Home,
                  },
                  {
                    to: '/documentation',
                    label: 'Read documentation',
                    description: 'Setup guides, onboarding, and FAQs',
                    icon: BookOpenText,
                  },
                  {
                    to: '/discover',
                    label: 'Discover public bookmarks',
                    description: 'Explore curated resources from the community',
                    icon: ArrowRight,
                  },
                  {
                    href: 'mailto:nt.apple.it@gmail.com',
                    label: 'Contact support',
                    description: 'Let us know what you were looking for',
                    icon: Mail,
                    external: true,
                  },
                ].map(({ to, href, label, description, icon: Icon, external }) => {
                  const commonClass =
                    'group rounded-lg border border-muted bg-background/70 px-4 py-3 transition hover:border-primary/50 hover:bg-primary/5';

                  const content = (
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          'mt-1 inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary transition group-hover:bg-primary/20',
                        )}
                      >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-foreground group-hover:text-primary">{label}</p>
                        <p className="text-xs text-muted-foreground leading-snug">{description}</p>
                      </div>
                    </div>
                  );

                  return to ? (
                    <Link key={label} to={to} className={commonClass}>
                      {content}
                    </Link>
                  ) : (
                    <a
                      key={label}
                      href={href}
                      target={external ? '_blank' : undefined}
                      rel={external ? 'noopener noreferrer' : undefined}
                      className={commonClass}
                    >
                      {content}
                    </a>
                  );
                })}
              </div>
            </div>

            <div className="w-full max-w-xs space-y-3">
              {isDev && (
                <div className="rounded-lg border border-dashed border-primary/50 bg-primary/5 p-4 text-sm text-primary">
                  <p className="font-medium">Friendly reminder</p>
                  <p className="mt-1 text-primary/80">
                    If you are building a new feature, double-check that the route is registered in
                    <code className="mx-1 rounded bg-primary/10 px-1 py-0.5">client/src/App.tsx</code>.
                  </p>
                </div>
              )}

              <Button asChild className="w-full" size="lg">
                <Link to="/">Return to dashboard</Link>
              </Button>
              <Button asChild variant="outline" className="w-full" size="lg">
                <Link to="/documentation">View documentation</Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
