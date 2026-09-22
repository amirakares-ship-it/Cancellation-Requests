import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import { ScrollBarProvider } from './contexts/ScrollBarContext';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ScrollBarProvider>
      <App />
    </ScrollBarProvider>
  </StrictMode>,
);
