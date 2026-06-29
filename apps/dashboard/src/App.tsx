import { BrowserRouter as Router, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { Stethoscope, HelpCircle, Activity, Settings as SettingsIcon, LogOut, MessageSquare } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import ServicesPage from './pages/Services';
import FaqsPage from './pages/Faqs';
import SettingsPage from './pages/Settings';
import ChatsPage from './pages/Chats';
import LogsPage from './pages/Logs';
import Login from './pages/Login';

function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--primary-dark)' }}>Loading...</div>;
  }

  if (!session) {
    return <Login />;
  }

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
            <NavLink 
              to="/chats" 
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <MessageSquare size={20} />
              Live Chats
            </NavLink>
            <NavLink 
              to="/logs" 
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <Activity size={20} />
              System Logs
            </NavLink>
          </nav>
          
          <div style={{ padding: '24px', marginTop: 'auto' }}>
            <button 
              className="btn btn-outline" 
              style={{ width: '100%', borderColor: '#fca5a5', color: '#ef4444' }}
              onClick={() => supabase.auth.signOut()}
            >
              <LogOut size={18} /> Sign Out
            </button>
          </div>
        </aside>

        <main className="main-content">
          <Routes>
            <Route path="/services" element={<ServicesPage />} />
            <Route path="/faqs" element={<FaqsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/chats" element={<ChatsPage />} />
            <Route path="/logs" element={<LogsPage />} />
            <Route path="*" element={<Navigate to="/services" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
