import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider, Outlet, useLocation } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AnimatePresence } from 'framer-motion';
import { TopNav } from '@/components/layout/TopNav';
import { Footer } from '@/components/layout/Footer';
import { RequireAuth } from '@/components/shared/RequireAuth';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { PageTransition } from '@/components/shared/PageTransition';
import { useNotification } from '@/hooks/use-notification';
import { queryClient } from '@/lib/query-client';
import { setAuthStoreRefs } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';

setAuthStoreRefs(
  () => useAuthStore.getState().token,
  () => useAuthStore.getState().logout(),
);

const HomePage = lazy(() => import('@/pages/Home'));
const LoginPage = lazy(() => import('@/pages/Login'));
const RegisterPage = lazy(() => import('@/pages/Register'));
const NotFoundPage = lazy(() => import('@/pages/NotFound'));
const DashboardHomePage = lazy(() => import('@/pages/dashboard/DashboardHome'));
const PluginListPage = lazy(() => import('@/pages/dashboard/PluginList'));
const PluginEditPage = lazy(() => import('@/pages/dashboard/PluginEdit'));
const CreatePluginPage = lazy(() => import('@/pages/dashboard/CreatePlugin'));
const WorkspacePage = lazy(() => import('@/pages/workspace/WorkspacePage'));
const PluginDetailPage = lazy(() => import('@/pages/workspace/PluginDetail'));
const MessagesPage = lazy(() => import('@/pages/messages/MessagesPage'));
const DailyPage = lazy(() => import('@/pages/daily/DailyPage'));
const ProfilePage = lazy(() => import('@/pages/user/Profile'));
const SettingsPage = lazy(() => import('@/pages/dashboard/Settings'));

function Layout() {
  const location = useLocation();

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-body">
      <TopNav />
      <main className="flex-1">
        <Suspense fallback={<LoadingSpinner />}>
          <AnimatePresence mode="wait">
            <PageTransition key={location.pathname}>
              <Outlet />
            </PageTransition>
          </AnimatePresence>
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}

function ProtectedLayout() {
  return (
    <RequireAuth>
      <Outlet />
    </RequireAuth>
  );
}

function AppRoutes() {
  useNotification();

  const router = createBrowserRouter([
    {
      element: <Layout />,
      children: [
        {
          path: '/',
          element: <HomePage />,
        },
        {
          path: '/login',
          element: <LoginPage />,
        },
        {
          path: '/register',
          element: <RegisterPage />,
        },
          {
            path: '/workspace',
            element: <WorkspacePage />,
          },
          {
            path: '/workspace/:id',
            element: <PluginDetailPage />,
          },
          {
            path: '/user/:id',
            element: <ProfilePage />,
          },
          {
          element: <ProtectedLayout />,
          children: [
            {
              path: '/dashboard',
              element: <DashboardHomePage />,
            },
            {
              path: '/dashboard/create',
              element: <CreatePluginPage />,
            },
            {
              path: '/dashboard/plugins',
              element: <PluginListPage />,
            },
            {
              path: '/dashboard/plugins/:id/edit',
              element: <PluginEditPage />,
            },
          {
            path: '/daily',
            element: <DailyPage />,
          },
          {
            path: '/messages',
            element: <MessagesPage />,
          },
          {
            path: '/dashboard/settings',
            element: <SettingsPage />,
          },

          ],
        },
        {
          path: '*',
          element: <NotFoundPage />,
        },
      ],
    },
  ]);

  return <RouterProvider router={router} />;
}

export function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#faf9f5',
              color: '#141413',
              border: '1px solid #e6dfd8',
              borderRadius: '8px',
              fontSize: '14px',
            },
            success: {
              iconTheme: { primary: '#5db872', secondary: '#fff' },
            },
            error: {
              iconTheme: { primary: '#c64545', secondary: '#fff' },
            },
          }}
        />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
