import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

console.log('[Main] 🚀 Fabrix Dashboard Bootstrap');
console.log('[Main] 📅 Build Time:', new Date().toISOString());
console.log('[Main] 🖥️ User Agent:', navigator.userAgent);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
