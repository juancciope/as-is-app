import Sidebar from '@/components/layout/sidebar';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <div className="flex h-screen lg:h-screen min-h-[100dvh] bg-gray-100">
        <Sidebar />
        <main className="flex-1 overflow-hidden">
          <div className="h-full lg:p-8 p-2">
            {children}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}