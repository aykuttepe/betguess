import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';

export function StandardLayout() {
  return (
    <div className="max-w-6xl mx-auto px-4 pt-6">
      <Outlet />
    </div>
  );
}

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <Navbar />
      <main className="flex-1 w-full mx-auto pb-28 lg:pb-8">
        <Outlet />
      </main>
    </div>
  );
}
