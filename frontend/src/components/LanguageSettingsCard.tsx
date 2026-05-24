import React, { useEffect, useState } from 'react';
import { CheckCircle2, Globe2, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  SUPPORTED_LANGUAGES,
  readStoredLanguage,
  type AppLanguageCode,
} from '../lib/language';
import { changeAppLanguage } from '../i18n/config';
import './LanguageSettingsCard.css';

type LanguageSettingsCardProps = {
  variant?: 'admin' | 'member';
};

const LanguageSettingsCard: React.FC<LanguageSettingsCardProps> = ({
  variant = 'admin',
}) => {
  const { t, i18n } = useTranslation();
  const [selected, setSelected] = useState<AppLanguageCode>(() =>
    readStoredLanguage()
  );
  const [applying, setApplying] = useState(false);
  const [feedback, setFeedback] = useState<'success' | null>(null);

  useEffect(() => {
    if (i18n.language && SUPPORTED_LANGUAGES.some((l) => l.code === i18n.language)) {
      setSelected(i18n.language as AppLanguageCode);
    }
  }, [i18n.language]);

  const handleApply = async () => {
    if (selected === readStoredLanguage() && i18n.language === selected) {
      setFeedback('success');
      return;
    }
    setApplying(true);
    setFeedback(null);
    try {
      await changeAppLanguage(selected);
      setFeedback('success');
    } catch {
      setApplying(false);
    } finally {
      setApplying(false);
    }
  };

  const rootClass =
    variant === 'member'
      ? 'language-settings-card language-settings-card--member'
      : 'language-settings-card';

  return (
    <section className={rootClass} aria-labelledby="language-settings-title">
      <div className="language-settings-card__header">
        <div className="language-settings-card__icon" aria-hidden>
          <Globe2 size={22} />
        </div>
        <div>
          <h2 id="language-settings-title" className="language-settings-card__title">
            {t('settings.language')}
          </h2>
          <p className="language-settings-card__description">
            {t('settings.languageDescription')}
          </p>
        </div>
      </div>

      <p className="language-settings-card__hint">{t('settings.languageHint')}</p>

      <div className="language-settings-card__control">
        <label htmlFor="app-language-select" className="language-settings-card__label">
          {t('settings.language')}
        </label>
        <div className="language-settings-card__select-wrap">
          <select
            id="app-language-select"
            className="language-settings-card__select"
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value as AppLanguageCode);
              setFeedback(null);
            }}
            disabled={applying}
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.nativeLabel}
              </option>
            ))}
          </select>
        </div>
      </div>

      {feedback === 'success' && !applying && (
        <p className="language-settings-card__success" role="status">
          <CheckCircle2 size={16} aria-hidden />
          {t('settings.languageAppliedLive')}
        </p>
      )}

      <div className="language-settings-card__actions">
        <button
          type="button"
          className="language-settings-card__apply"
          onClick={() => void handleApply()}
          disabled={applying}
        >
          {applying ? (
            <>
              <Loader2 size={16} className="language-settings-card__spin" aria-hidden />
              {t('common.loading')}
            </>
          ) : (
            t('common.apply')
          )}
        </button>
      </div>
    </section>
  );
};

export default LanguageSettingsCard;
