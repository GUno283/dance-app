import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ padding: 32, maxWidth: 640 }}>
        <h2>表示中にエラーが発生しました</h2>
        <p className="muted">データは自動保存されています。再読み込みで復帰できることがほとんどです。</p>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, background: '#1b1e26', padding: 12, borderRadius: 8 }}>{String(this.state.error.message)}</pre>
        <div className="row">
          <button className="btn primary" onClick={() => location.reload()}>再読み込み</button>
          <button className="btn" onClick={() => { location.hash = '#/'; location.reload(); }}>プロジェクト一覧へ</button>
        </div>
      </div>
    );
  }
}
