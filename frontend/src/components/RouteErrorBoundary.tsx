import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Briefcase } from 'lucide-react';

type Props = {
  children: ReactNode;
  pageLabel?: string;
};

type State = {
  error: Error | null;
};

/**
 * Empêche une erreur de rendu (hors async) de laisser la zone de page entièrement vide.
 */
export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[RouteErrorBoundary]', error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.error) {
      const label = this.props.pageLabel ?? 'cette page';
      return (
        <div
          className="route-error-fallback"
          style={{
            padding: '2rem',
            maxWidth: 640,
            margin: '0 auto',
            background: 'var(--bg-surface, #fff)',
            border: '1px solid var(--border, #e5e7eb)',
            borderRadius: 16,
            color: 'var(--text-main, #374151)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <Briefcase size={28} aria-hidden />
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Impossible d’afficher {label}</h1>
          </div>
          <p style={{ marginBottom: 16, lineHeight: 1.5 }}>
            Une erreur d’affichage s’est produite. Rechargez la page ou ouvrez la console (F12) pour le
            détail technique.
          </p>
          <pre
            style={{
              fontSize: 12,
              padding: 12,
              borderRadius: 8,
              background: 'var(--bg-main, #f9fafb)',
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
            }}
          >
            {this.state.error.message}
          </pre>
          <button
            type="button"
            className="primary-btn"
            style={{ marginTop: 16 }}
            onClick={() => window.location.reload()}
          >
            Recharger la page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
