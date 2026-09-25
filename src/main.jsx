import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';

import { AuthProvider } from './lib/auth.jsx';
import { GoogleOAuthProvider } from '@react-oauth/google';

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

const tree = (
  <BrowserRouter>
    <AuthProvider>
      <App />
    </AuthProvider>
  </BrowserRouter>
);

// Google button only renders when a client ID is configured; provider is optional.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {googleClientId ? (
      <GoogleOAuthProvider clientId={googleClientId}>{tree}</GoogleOAuthProvider>
    ) : (
      tree
    )}
  </React.StrictMode>
);
