import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', fontFamily: 'sans-serif', textAlign: 'center' }}>
          <h2 style={{ color: '#e53e3e' }}>Something went wrong</h2>
          <pre style={{ color: '#666', fontSize: '13px', marginTop: '16px', textAlign: 'left', background: '#f7f7f7', padding: '16px', borderRadius: '8px' }}>
            {this.state.error?.message}
          </pre>
          <button onClick={() => window.location.reload()}
            style={{ marginTop: '20px', padding: '10px 24px', background: '#3182ce', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>
            Reload Page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
