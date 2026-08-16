import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';

import { ToastProvider } from '@/components/ui/Toast';
import { router } from '@/router';

import './index.css';

// No data-fetching provider: queries run through the hand-rolled hooks in
// src/api/hooks.ts, backed by the module-level cache in src/api/store.ts.
// Nothing needs to hang off a React context for that to work.
const rootElement = document.getElementById('root');
if (rootElement === null) throw new Error('Root element not found');

createRoot(rootElement).render(
  <StrictMode>
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>
  </StrictMode>,
);
