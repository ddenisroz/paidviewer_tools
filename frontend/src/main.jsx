import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './App.css'
import { AuthProvider } from './context/AuthContext.jsx'
import { DataProvider } from './context/DataContext.jsx'
import { IntegrationsProvider } from './context/IntegrationsContext.jsx';
import { ToastProvider } from './components/ui/toast.jsx'
import { TtsProvider } from './context/TtsContext.jsx'
import { TtsHealthProvider } from './context/TtsHealthContext.jsx'
import { TtsCardProvider } from './context/TtsCardContext.jsx'
import { ActiveChannelsProvider } from './context/ActiveChannelsContext.jsx'
import { ChatProvider } from './context/ChatContext.jsx'


ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <IntegrationsProvider>
            <TtsHealthProvider>
              <TtsCardProvider>
                <ChatProvider>
                  <DataProvider>
                    <TtsProvider>
                      <ActiveChannelsProvider>
                        <App />
                      </ActiveChannelsProvider>
                    </TtsProvider>
                  </DataProvider>
                </ChatProvider>
              </TtsCardProvider>
            </TtsHealthProvider>
          </IntegrationsProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
