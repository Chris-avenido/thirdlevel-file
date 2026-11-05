import './devtools/dev-bootstrap';
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import App from './App.jsx'
import './index.css'
import { devLogger } from './devtools/dev-logger'
import { DevErrorBoundary } from './devtools/DevErrorBoundary'
import { DevProfiler } from './devtools/DevProfiler'

ReactDOM.createRoot(document.getElementById('root'), devLogger.reactRootErrorHandlers).render(
  <DevProfiler id="Root">
    <React.StrictMode>
      <DevErrorBoundary>
        <AuthProvider>
          <BrowserRouter basename={import.meta.env.BASE_URL}>
            <App />
          </BrowserRouter>
        </AuthProvider>
      </DevErrorBoundary>
    </React.StrictMode>
  </DevProfiler>,
)
