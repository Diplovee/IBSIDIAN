import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

window.EXCALIDRAW_ASSET_PATH = new URL('./excalidraw/', window.location.href).toString();

createRoot(document.getElementById('root')!).render(
  <App />
);
