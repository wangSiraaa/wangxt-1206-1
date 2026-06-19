import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Filling from './pages/Filling';
import Delivery from './pages/Delivery';
import Supervise from './pages/Supervise';
import { Toasts } from './components/ui';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/filling" element={<Filling />} />
          <Route path="/delivery" element={<Delivery />} />
          <Route path="/supervise" element={<Supervise />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <Toasts />
    </BrowserRouter>
  );
}
