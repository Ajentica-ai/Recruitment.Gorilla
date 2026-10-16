import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Printer } from 'lucide-react';
import Page from '../components/common/Page';
import PageHeader from '../components/common/PageHeader';
import SectionCard from '../components/common/SectionCard';
import EmptyState from '../components/common/EmptyState';
import LoadingPanel from '../components/common/Loading';
import GuideMarkdown from '../components/userGuide/GuideMarkdown';
import { getUserGuide } from '../services/api';
import { headingsOf } from '../utils/slugify';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

function GuideRail({
  chapters,
  onJump,
}: {
  chapters: { id: string; headings: { level: 1 | 2; text: string; id: string }[] }[];
  onJump: (id: string) => void;
}) {
  return (
    <nav aria-label="User guide contents" className="flex flex-col gap-3">
      {chapters.map((chapter) => {
        const [first, ...rest] = chapter.headings;
        if (!first) return null;
        return (
          <div key={chapter.id}>
            <button
              type="button"
              onClick={() => onJump(first.id)}
              className="text-left text-[length:var(--text-sm)] font-semibold text-foreground hover:text-brand"
            >
              {first.text}
            </button>
            {rest.length > 0 && (
              <ul className="mt-1 flex flex-col gap-1 border-l border-border pl-3">
                {rest.map((h) => (
                  <li key={h.id}>
                    <button
                      type="button"
                      onClick={() => onJump(h.id)}
                      className="text-left text-[length:var(--text-sm)] text-muted-foreground hover:text-brand"
                    >
                      {h.text}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}

export default function UserGuidePage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['user-guide'],
    queryFn: getUserGuide,
    staleTime: Infinity,
  });

  const chapters = useMemo(
    () => (data?.chapters ?? []).map((c) => ({ id: c.id, headings: headingsOf(c.markdown) })),
    [data],
  );

  const knownAnchors = useMemo(
    () => new Set(chapters.flatMap((c) => c.headings.map((h) => h.id))),
    [chapters],
  );

  // Deep link support: scroll to the hash once the guide has rendered.
  useEffect(() => {
    if (!data || !location.hash) return;
    const id = decodeURIComponent(location.hash.slice(1));
    const target = document.getElementById(id);
    if (target) target.scrollIntoView({ block: 'start' });
    // Only on load for this edition; in-page link clicks scroll themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const jumpTo = (id: string) => {
    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ block: 'start' });
      history.replaceState(null, '', `#${id}`);
    }
  };

  return (
    <Page>
      <PageHeader
        actions={
          data && (
            <>
              <Badge variant="brand">{data.label}</Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                className="print:hidden"
              >
                <Printer size={16} strokeWidth={1.75} aria-hidden="true" />
                Print / Save as PDF
              </Button>
            </>
          )
        }
      />

      {isLoading ? (
        <LoadingPanel label="Loading the user guide…" />
      ) : isError || !data ? (
        <EmptyState
          variant="error"
          title="Couldn't load the user guide"
          description="The request failed. Refresh the page to try again."
        />
      ) : (
        <div className="grid grid-cols-1 gap-[var(--space-6)] lg:grid-cols-[16rem_1fr] print:block">
          <div className="guide-rail print:hidden lg:hidden">
            <Accordion type="single" collapsible>
              <AccordionItem value="contents">
                <AccordionTrigger className="px-1">
                  <span className="flex items-center gap-2">
                    <BookOpen size={16} strokeWidth={1.75} aria-hidden="true" />
                    Contents
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <GuideRail chapters={chapters} onJump={jumpTo} />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          <div className="guide-rail hidden print:hidden lg:sticky lg:top-4 lg:block lg:self-start">
            <SectionCard title="Contents" as="h3">
              <GuideRail chapters={chapters} onJump={jumpTo} />
            </SectionCard>
          </div>

          <SectionCard className="min-w-0">
            <div className="flex flex-col gap-10">
              {data.chapters.map((chapter) => (
                <GuideMarkdown key={chapter.id} markdown={chapter.markdown} knownAnchors={knownAnchors} />
              ))}
            </div>
          </SectionCard>
        </div>
      )}
    </Page>
  );
}
