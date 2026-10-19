'use client';

import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  ExternalLink,
  Lightbulb,
  Maximize2,
  Search,
  Star,
  TriangleAlert,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { type SearchDoc, searchDocs } from '@/lib/guide-search';
import { cn } from '@/lib/utils';
import {
  GUIDE_SECTIONS,
  GUIDE_TOPICS,
  type GuideSection,
  type GuideSectionId,
  type GuideText,
  type GuideTopic,
  topicById,
} from './guide-content';
import { RichText, type Translate, plainText } from './rich-text';

type Lang = keyof GuideText;

const sectionById = (id: string | null) => GUIDE_SECTIONS.find((s) => s.id === id);

/** The user guide: search, sections, and one topic at a time with numbered steps and pictures. */
export function GuideView() {
  const tAll = useTranslations();
  const t = useTranslations('guide');
  const lang = (useLocale() === 'si' ? 'si' : 'en') satisfies Lang;
  const label: Translate = (key) => tAll(key);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const topic = topicById(params.get('topic'));
  const section = sectionById(params.get('section'));
  const [query, setQuery] = useState(params.get('q') ?? '');
  const top = useRef<HTMLDivElement>(null);

  const go = (next: { topic?: string; section?: string }) => {
    const qs = new URLSearchParams();
    if (next.topic) qs.set('topic', next.topic);
    if (next.section) qs.set('section', next.section);
    setQuery('');
    router.push(qs.size ? `${pathname}?${qs}` : pathname);
  };

  // A new topic or section starts at the top of the page.
  const view = `${topic?.id ?? ''}|${section?.id ?? ''}`;
  useEffect(() => {
    top.current?.scrollIntoView({ block: 'start' });
    window.scrollTo({ top: 0 });
  }, [view]);

  const docs = useMemo<SearchDoc[]>(() => {
    const other: Lang = lang === 'en' ? 'si' : 'en';
    return GUIDE_TOPICS.map((tp) => ({
      id: tp.id,
      boost: tp.popular ? 1.5 : 0,
      fields: [
        { text: plainText(tp.title[lang], label), weight: 8 },
        { text: tp.keywords[lang], weight: 5 },
        { text: tp.title[other], weight: 4 },
        { text: tp.keywords[other], weight: 3 },
        { text: plainText(tp.summary[lang], label), weight: 3 },
        { text: sectionById(tp.section)!.title[lang], weight: 2 },
        {
          text: [...tp.steps.map((s) => s.text), ...(tp.tips ?? []), ...(tp.warnings ?? [])]
            .map((x) => plainText(x[lang], label))
            .join(' '),
          weight: 1,
        },
      ],
    }));
    // `label` only changes with the locale
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);
  const hits = useMemo(() => searchDocs(docs, query), [docs, query]);
  const searching = query.trim().length > 0;

  return (
    <div ref={top} className="flex scroll-mt-24 flex-col gap-6" data-testid="guide">
      <Card>
        <CardContent className="flex flex-col gap-2">
          <label htmlFor="guide-search" className="text-lg font-semibold">
            {t('searchLabel')}
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="guide-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="h-13 pr-12 pl-11 text-lg"
              autoComplete="off"
              data-testid="guide-search"
            />
            {query ? (
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-1/2 right-2 -translate-y-1/2"
                onClick={() => setQuery('')}
                aria-label={t('clearSearch')}
              >
                <X className="size-5" />
              </Button>
            ) : null}
          </div>
          <p className="text-muted-foreground">{t('searchHint')}</p>
        </CardContent>
      </Card>

      {searching ? (
        <SearchResults
          hits={hits.map((h) => topicById(h.id)!)}
          lang={lang}
          label={label}
          onOpen={go}
        />
      ) : topic ? (
        <TopicView topic={topic} lang={lang} label={label} onOpen={go} />
      ) : section ? (
        <SectionView section={section} lang={lang} label={label} onOpen={go} />
      ) : (
        <GuideHome lang={lang} label={label} onOpen={go} />
      )}
    </div>
  );
}

type Open = (next: { topic?: string; section?: string }) => void;

function topicsOf(id: GuideSectionId) {
  return GUIDE_TOPICS.filter((tp) => tp.section === id);
}

/** A clickable topic line: title and a one-line summary. */
function TopicLink({
  topic,
  lang,
  label,
  onOpen,
  showSection = false,
}: {
  topic: GuideTopic;
  lang: Lang;
  label: Translate;
  onOpen: Open;
  showSection?: boolean;
}) {
  const section = sectionById(topic.section)!;
  const Icon = section.icon;
  return (
    <button
      type="button"
      onClick={() => onOpen({ topic: topic.id })}
      className="group flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      data-testid={`guide-topic-${topic.id}`}
    >
      <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold group-hover:underline">
          {plainText(topic.title[lang], label)}
        </span>
        <span className="mt-0.5 line-clamp-2 block text-[0.95rem] text-muted-foreground">
          {showSection ? `${section.title[lang]} · ` : ''}
          {plainText(topic.summary[lang], label)}
        </span>
      </span>
      <ChevronRight className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
    </button>
  );
}

function GuideHome({ lang, label, onOpen }: { lang: Lang; label: Translate; onOpen: Open }) {
  const t = useTranslations('guide');
  const popular = GUIDE_TOPICS.filter((tp) => tp.popular);
  return (
    <>
      <section aria-labelledby="guide-popular">
        <h2 id="guide-popular" className="mb-3 flex items-center gap-2 text-xl font-semibold">
          <Star className="size-5 text-brand-accent" aria-hidden />
          {t('popular')}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="guide-popular">
          {popular.map((tp) => {
            const Icon = sectionById(tp.section)!.icon;
            return (
              <button
                key={tp.id}
                type="button"
                onClick={() => onOpen({ topic: tp.id })}
                className="group flex items-start gap-3 rounded-xl bg-card p-4 text-left ring-1 ring-foreground/10 transition hover:ring-2 hover:ring-primary/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                data-testid={`guide-popular-${tp.id}`}
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-6" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-base font-semibold group-hover:underline">
                    {plainText(tp.title[lang], label)}
                  </span>
                  <span className="mt-1 line-clamp-2 block text-[0.95rem] text-muted-foreground">
                    {plainText(tp.summary[lang], label)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="guide-all">
        <h2 id="guide-all" className="mb-3 text-xl font-semibold">
          {t('allTopics')}
        </h2>
        <div className="grid gap-4 lg:grid-cols-2" data-testid="guide-sections">
          {GUIDE_SECTIONS.map((s) => (
            <SectionCard key={s.id} section={s} lang={lang} label={label} onOpen={onOpen} />
          ))}
        </div>
      </section>
    </>
  );
}

function SectionCard({
  section,
  lang,
  label,
  onOpen,
}: {
  section: GuideSection;
  lang: Lang;
  label: Translate;
  onOpen: Open;
}) {
  const t = useTranslations('guide');
  const Icon = section.icon;
  const topics = topicsOf(section.id);
  return (
    <Card data-testid={`guide-section-${section.id}`}>
      <CardContent className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => onOpen({ section: section.id })}
          className="group flex items-center gap-3 text-left"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-sidebar text-sidebar-foreground">
            <Icon className="size-5" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-lg font-semibold group-hover:underline">
              {section.title[lang]}
            </span>
            <span className="block text-[0.95rem] text-muted-foreground">
              {section.description[lang]}
            </span>
          </span>
        </button>
        <ul className="mt-1 flex flex-col">
          {topics.slice(0, 5).map((tp) => (
            <li key={tp.id}>
              <button
                type="button"
                onClick={() => onOpen({ topic: tp.id })}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[0.95rem] hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span>{plainText(tp.title[lang], label)}</span>
              </button>
            </li>
          ))}
        </ul>
        {topics.length > 5 ? (
          <Button
            variant="link"
            className="self-start px-2"
            onClick={() => onOpen({ section: section.id })}
          >
            {t('showAll', { count: topics.length })}
            <ArrowRight aria-hidden />
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function SectionView({
  section,
  lang,
  label,
  onOpen,
}: {
  section: GuideSection;
  lang: Lang;
  label: Translate;
  onOpen: Open;
}) {
  const t = useTranslations('guide');
  const Icon = section.icon;
  return (
    <div className="flex flex-col gap-4">
      <BackLink onClick={() => onOpen({})}>{t('backToAll')}</BackLink>
      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-sidebar text-sidebar-foreground">
              <Icon className="size-6" aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 className="text-2xl font-bold" data-testid="guide-section-title">
                {section.title[lang]}
              </h2>
              <p className="text-muted-foreground">{section.description[lang]}</p>
            </div>
          </div>
          <div className="flex flex-col divide-y">
            {topicsOf(section.id).map((tp) => (
              <TopicLink key={tp.id} topic={tp} lang={lang} label={label} onOpen={onOpen} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SearchResults({
  hits,
  lang,
  label,
  onOpen,
}: {
  hits: GuideTopic[];
  lang: Lang;
  label: Translate;
  onOpen: Open;
}) {
  const t = useTranslations('guide');
  return (
    <section aria-live="polite" data-testid="guide-results">
      <h2 className="mb-3 text-xl font-semibold">{t('results', { count: hits.length })}</h2>
      {hits.length ? (
        <Card>
          <CardContent className="flex flex-col divide-y">
            {hits.map((tp) => (
              <TopicLink
                key={tp.id}
                topic={tp}
                lang={lang}
                label={label}
                onOpen={onOpen}
                showSection
              />
            ))}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-6 text-center">
            <p className="text-lg">{t('noResults')}</p>
            <p className="mt-1 text-muted-foreground">{t('noResultsHint')}</p>
          </CardContent>
        </Card>
      )}
    </section>
  );
}

function BackLink({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <Button
      variant="ghost"
      size="lg"
      className="self-start px-2 text-base"
      onClick={onClick}
      data-testid="guide-back"
    >
      <ArrowLeft aria-hidden />
      {children}
    </Button>
  );
}

function TopicView({
  topic,
  lang,
  label,
  onOpen,
}: {
  topic: GuideTopic;
  lang: Lang;
  label: Translate;
  onOpen: Open;
}) {
  const t = useTranslations('guide');
  const section = sectionById(topic.section)!;
  const siblings = topicsOf(topic.section);
  const next = siblings[siblings.indexOf(topic) + 1];
  const [zoom, setZoom] = useState<{ src: string; alt: string } | null>(null);

  return (
    <article className="flex flex-col gap-5" data-testid="guide-topic">
      <nav className="flex flex-wrap items-center gap-1 text-muted-foreground">
        <BackLink onClick={() => onOpen({})}>{t('backToAll')}</BackLink>
        <ChevronRight className="size-4" aria-hidden />
        <Button
          variant="ghost"
          size="lg"
          className="px-2 text-base"
          onClick={() => onOpen({ section: section.id })}
        >
          {section.title[lang]}
        </Button>
      </nav>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <h2
            className="text-2xl leading-tight font-bold lg:text-3xl"
            data-testid="guide-topic-title"
          >
            <RichText text={topic.title[lang]} t={label} />
          </h2>
          <p className="text-lg text-muted-foreground">
            <RichText text={topic.summary[lang]} t={label} />
          </p>
          {topic.page ? (
            <Button asChild size="lg" className="self-start text-base">
              <Link href={topic.page} data-testid="guide-open-page">
                {t('openPage')}
                <ExternalLink aria-hidden />
              </Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <ol className="flex flex-col gap-4" data-testid="guide-steps">
        {topic.steps.map((step, i) => {
          const alt = t('screenshotAlt', {
            n: i + 1,
            title: plainText(topic.title[lang], label),
          });
          return (
            <li key={i}>
              <Card>
                <CardContent className="flex flex-col gap-4">
                  <div className="flex items-start gap-4">
                    <span
                      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground"
                      aria-label={t('step', { n: i + 1 })}
                    >
                      {i + 1}
                    </span>
                    <p className="pt-1.5 text-[1.05rem] leading-relaxed">
                      <RichText text={step.text[lang]} t={label} />
                    </p>
                  </div>
                  {step.shot ? (
                    <Screenshot
                      src={`/guide/${lang}/${step.shot}.webp`}
                      alt={alt}
                      onZoom={() => setZoom({ src: `/guide/${lang}/${step.shot}.webp`, alt })}
                    />
                  ) : null}
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ol>

      {topic.warnings?.map((w, i) => (
        <Note key={`w${i}`} kind="warning" title={t('warning')}>
          <RichText text={w[lang]} t={label} />
        </Note>
      ))}
      {topic.tips?.map((tip, i) => (
        <Note key={`t${i}`} kind="tip" title={t('tip')}>
          <RichText text={tip[lang]} t={label} />
        </Note>
      ))}

      {topic.related?.length ? (
        <section aria-labelledby="guide-related">
          <h3 id="guide-related" className="mb-2 text-lg font-semibold">
            {t('related')}
          </h3>
          <Card>
            <CardContent className="flex flex-col divide-y">
              {topic.related.map((id) => {
                const r = topicById(id);
                return r ? (
                  <TopicLink key={id} topic={r} lang={lang} label={label} onOpen={onOpen} />
                ) : null;
              })}
            </CardContent>
          </Card>
        </section>
      ) : null}

      {next ? (
        <Button
          variant="outline"
          size="lg"
          className="h-auto self-end py-3 text-base whitespace-normal"
          onClick={() => onOpen({ topic: next.id })}
          data-testid="guide-next"
        >
          <span className="text-left">
            <span className="block text-sm text-muted-foreground">{t('nextTopic')}</span>
            {plainText(next.title[lang], label)}
          </span>
          <ArrowRight aria-hidden />
        </Button>
      ) : null}

      <Dialog open={zoom !== null} onOpenChange={(o) => !o && setZoom(null)}>
        <DialogContent className="max-h-[95dvh] w-[96vw] max-w-[1320px] overflow-auto p-3 sm:max-w-[1320px]">
          <DialogTitle className="sr-only">{zoom?.alt}</DialogTitle>
          <DialogDescription className="sr-only">{t('zoomHelp')}</DialogDescription>
          {zoom ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={zoom.src} alt={zoom.alt} className="h-auto w-full rounded-md" />
          ) : null}
        </DialogContent>
      </Dialog>
    </article>
  );
}

function Screenshot({ src, alt, onZoom }: { src: string; alt: string; onZoom: () => void }) {
  const t = useTranslations('guide');
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <button
      type="button"
      onClick={onZoom}
      className="group relative block w-full overflow-hidden rounded-lg border bg-muted text-left shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none lg:ml-14 lg:w-[calc(100%-3.5rem)]"
      title={t('enlarge')}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onError={() => setFailed(true)}
        className="h-auto w-full"
        data-testid="guide-shot"
      />
      <span className="absolute right-2 bottom-2 flex items-center gap-1.5 rounded-md bg-background/90 px-2 py-1 text-sm font-medium shadow transition-opacity group-hover:opacity-100 sm:opacity-0">
        <Maximize2 className="size-4" aria-hidden />
        {t('enlarge')}
      </span>
    </button>
  );
}

function Note({
  kind,
  title,
  children,
}: {
  kind: 'tip' | 'warning';
  title: string;
  children: React.ReactNode;
}) {
  const Icon = kind === 'tip' ? Lightbulb : TriangleAlert;
  return (
    <div
      className={cn(
        'flex gap-3 rounded-xl border p-4 text-[1.05rem] leading-relaxed',
        kind === 'tip' ? 'border-primary/25 bg-primary/5' : 'border-warning/60 bg-warning/10',
      )}
      data-testid={`guide-${kind}`}
    >
      <Icon
        className={cn('mt-1 size-5 shrink-0', kind === 'tip' ? 'text-primary' : 'text-warning')}
        aria-hidden
      />
      <p>
        <span className="font-semibold">{title}: </span>
        {children}
      </p>
    </div>
  );
}
