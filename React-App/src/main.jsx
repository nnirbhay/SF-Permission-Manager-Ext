import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Popup from './components/Popup';
import PermissionAnalyzer from './components/PermissionAnalyzer';

const url = window.location;
console.log('path name : ', url.pathname);
const path = url.pathname;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {path === '/dist/bundle.html' ? (
      <PermissionAnalyzer />
    ) : (
      <Popup />
    )}
  </StrictMode>
)
