import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { AppProviders } from './app/providers'
import I18nGate from './i18n/I18nGate'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nGate>
      <AppProviders>
        <App />
      </AppProviders>
    </I18nGate>
  </React.StrictMode>,
)
