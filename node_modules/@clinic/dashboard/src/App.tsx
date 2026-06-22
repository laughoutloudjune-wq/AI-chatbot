import { BrowserRouter as Router, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { Stethoscope, HelpCircle, Activity, Settings as SettingsIcon } from 'lucide-react';
import ServicesPage from './pages/Services';
import FaqsPage from './pages/Faqs';
import SettingsPage from './pages/Settings';

function App() {
  return (
    <Router>
      <div className="app-container">
        <aside className="sidebar">
          <div className="sidebar-header">
            <Activity color="var(--primary-dark)" size={28} />
            Erika Admin
          </div>
          <nav className="sidebar-nav">
            <NavLink 
              to="/services" 
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <Stethoscope size={20} />
              Clinic Services
            </NavLink>
            <NavLink 
              to="/faqs" 
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <HelpCircle size={20} />
              FAQs / Knowledge
            </NavLink>
            <NavLink 
              to="/settings" 
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <SettingsIcon size={20} />
              System Settings
            </NavLink>
          </nav>
        </aside>

        <main className="main-content">
          <Routes>
            <Route path="/services" element={<ServicesPage />} />
            <Route path="/faqs" element={<FaqsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/services" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
