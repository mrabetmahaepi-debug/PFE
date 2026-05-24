import React, { useEffect, useState, type ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n, { initI18n } from './config';

type I18nGateProps = {
  children: ReactNode;
};

/** Blocks render until i18n is ready (translations loaded). */
const I18nGate: React.FC<I18nGateProps> = ({ children }) => {
  const [ready, setReady] = useState(i18n.isInitialized);

  useEffect(() => {
    if (i18n.isInitialized) {
      setReady(true);
      return;
    }
    void initI18n().then(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          color: '#6b7280',
          fontSize: 14,
        }}
      >
        …
      </div>
    );
  }

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
};

export default I18nGate;
