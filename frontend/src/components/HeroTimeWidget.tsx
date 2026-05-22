import React, { useEffect, useMemo, useState } from 'react';

function resolveLocale(): string {
  if (typeof navigator !== 'undefined' && navigator.language) {
    return navigator.language;
  }
  return 'fr-FR';
}

function usesHour12(locale: string): boolean {
  return (
    new Intl.DateTimeFormat(locale, { hour: 'numeric' }).resolvedOptions().hour12 ??
    false
  );
}

const HeroTimeWidget: React.FC = () => {
  const [now, setNow] = useState(() => new Date());
  const locale = useMemo(() => resolveLocale(), []);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const hour12 = usesHour12(locale);

  const { main, seconds, period } = useMemo(() => {
    const mainFmt = new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
      hour12,
    });
    const secFmt = new Intl.DateTimeFormat(locale, { second: '2-digit' });
    let period = '';
    if (hour12) {
      const parts = new Intl.DateTimeFormat(locale, {
        hour: 'numeric',
        hour12: true,
      }).formatToParts(now);
      period = parts.find((p) => p.type === 'dayPeriod')?.value ?? '';
    }
    return {
      main: mainFmt.format(now),
      seconds: secFmt.format(now),
      period,
    };
  }, [now, locale, hour12]);

  const label = locale.toLowerCase().startsWith('fr') ? 'Heure actuelle' : 'Current time';
  const ariaTime = period ? `${main} ${period}` : `${main}:${seconds}`;

  return (
    <aside className="cu-hero-time" aria-label={label}>
      <time dateTime={now.toISOString()} className="cu-hero-time__clock">
        <span className="cu-hero-time__main">{main}</span>
        <span className="cu-hero-time__seconds" aria-hidden="true">
          :{seconds}
        </span>
        {period ? (
          <span className="cu-hero-time__period" aria-hidden="true">
            {period}
          </span>
        ) : null}
      </time>
      <span className="cu-hero-time__label">{label}</span>
      <span className="sr-only" aria-live="polite">
        {ariaTime}
      </span>
    </aside>
  );
};

export default HeroTimeWidget;
