import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

function removeInjectedHostingWatermarks() {
  if (typeof document === 'undefined' || !document.body) return;
  const children = Array.from(document.body.children);
  for (const el of children) {
    if (el.id === 'root' || el.tagName === 'SCRIPT' || el.tagName === 'STYLE') continue;
    const tag = el.tagName.toLowerCase();
    const id = (el.id || '').toLowerCase();
    const cls = typeof el.className === 'string' ? el.className.toLowerCase() : '';
    const href = (el.getAttribute('href') || '').toLowerCase();
    const src = (el.getAttribute('src') || '').toLowerCase();
    const text = (el.textContent || '').trim().toLowerCase();

    const isNetlifyOverlay =
      tag.includes('netlify') ||
      id.includes('netlify') ||
      cls.includes('netlify') ||
      href.includes('netlify.com') ||
      src.includes('netlify') ||
      text.includes('powered by netlify');

    if (isNetlifyOverlay) {
      el.remove();
    }
  }
}

if (typeof window !== 'undefined' && typeof MutationObserver !== 'undefined') {
  removeInjectedHostingWatermarks();
  const observer = new MutationObserver(() => removeInjectedHostingWatermarks());
  observer.observe(document.body, { childList: true });
}

createRoot(document.getElementById('root')!).render(<App />);

