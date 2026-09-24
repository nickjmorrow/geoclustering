import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ApiError } from 'src/api/client';
import App from 'src/App';
import ErrorBoundary from 'src/components/ErrorBoundary';
import 'src/index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Nothing here changes behind the page's back: samples change with a
      // deploy, and uploads never touch the server after the first response.
      refetchOnWindowFocus: false,
      // Once, and only for something that might go differently the second
      // time. A 4xx will not.
      retry: (failures, error) => failures < 1 && !(error instanceof ApiError && error.status < 500),
    },
  },
});

const root = document.getElementById('root');
if (!root) throw new Error('#root not found');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </QueryClientProvider>
  </StrictMode>,
);
