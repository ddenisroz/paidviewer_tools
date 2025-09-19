import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './App.css'
import { AuthProvider } from './context/AuthContext.jsx'
import { DataProvider } from './context/DataContext.jsx'
import { TtsProvider } from './context/TtsContext.jsx'
import { ChatProvider } from './context/ChatContext.jsx'
import { ToastProvider } from './components/ui/toast.jsx'
import { IntegrationsProvider } from './context/IntegrationsContext';


ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <IntegrationsProvider>
          <ChatProvider>
            <DataProvider>
              <TtsProvider>
                <ToastProvider>
                  <App />
                </ToastProvider>
              </TtsProvider>
            </DataProvider>
          </ChatProvider>
        </IntegrationsProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
