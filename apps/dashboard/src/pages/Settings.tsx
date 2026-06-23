import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Settings as SettingsIcon, Save, Plus, X } from 'lucide-react';

interface SystemSetting {
  key: string;
  value: any;
  description: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, SystemSetting>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newKeyword, setNewKeyword] = useState('');

  // Form states
  const [clinicName, setClinicName] = useState('');
  const [adminLineId, setAdminLineId] = useState('');
  const [fbAccessToken, setFbAccessToken] = useState('');
  const [fbVerifyToken, setFbVerifyToken] = useState('');
  const [handoffKeywords, setHandoffKeywords] = useState<string[]>([]);
  const [systemPrompt, setSystemPrompt] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*');

      if (error) throw error;

      const settingsMap: Record<string, SystemSetting> = {};
      data.forEach(s => { settingsMap[s.key] = s; });
      setSettings(settingsMap);

      // Initialize form states
      setClinicName(settingsMap['clinic_name']?.value || '');
      setAdminLineId(settingsMap['admin_line_user_id']?.value || '');
      setFbAccessToken(settingsMap['fb_page_access_token']?.value || '');
      setFbVerifyToken(settingsMap['fb_verify_token']?.value || '');
      setHandoffKeywords(settingsMap['handoff_keywords']?.value || []);
      setSystemPrompt(settingsMap['system_prompt']?.value || '');
      
    } catch (err) {
      console.error('Error fetching settings:', err);
      alert('Failed to load settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (key: string, value: any) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('system_settings')
        .update({ value, updated_at: new Date().toISOString() })
        .eq('key', key);

      if (error) throw error;
      
      setSettings(prev => ({
        ...prev,
        [key]: { ...prev[key], value }
      }));
    } catch (err) {
      console.error(`Error saving ${key}:`, err);
      alert(`Failed to save ${key}`);
    } finally {
      setSaving(false);
    }
  };

  const addKeyword = () => {
    if (!newKeyword.trim()) return;
    const updated = [...handoffKeywords, newKeyword.trim()];
    setHandoffKeywords(updated);
    handleSave('handoff_keywords', updated);
    setNewKeyword('');
  };

  const removeKeyword = (indexToRemove: number) => {
    const updated = handoffKeywords.filter((_, idx) => idx !== indexToRemove);
    setHandoffKeywords(updated);
    handleSave('handoff_keywords', updated);
  };

  if (loading) {
    return <div className="page-container"><div className="loading">Loading settings...</div></div>;
  }

  return (
    <div className="page-container">
      <header className="page-header">
        <div className="header-title">
          <SettingsIcon className="page-icon" />
          <h1>System Settings</h1>
        </div>
        <p className="header-subtitle">Configure AI bot behaviors, keywords, and integrations</p>
      </header>

      <div className="settings-grid">
        {/* General Settings */}
        <section className="settings-card">
          <h2>General Info</h2>
          <div className="form-group">
            <label>Clinic Name</label>
            <p className="help-text">{settings['clinic_name']?.description}</p>
            <div className="input-with-action">
              <input 
                type="text" 
                value={clinicName} 
                onChange={e => setClinicName(e.target.value)}
              />
              <button 
                className="btn-secondary" 
                onClick={() => handleSave('clinic_name', clinicName)}
                disabled={saving || clinicName === settings['clinic_name']?.value}
              >
                <Save size={16} /> Save
              </button>
            </div>
          </div>
        </section>

        {/* AI System Prompt */}
        <section className="settings-card" style={{ gridColumn: '1 / -1' }}>
          <h2>AI System Prompt (Brain Instructions)</h2>
          <div className="form-group">
            <p className="help-text">
              {settings['system_prompt']?.description || 'Edit the core instructions for the AI bot. Use {{clinic_name}} as a placeholder.'}
            </p>
            <div className="input-with-action" style={{ alignItems: 'flex-start' }}>
              <textarea 
                className="form-textarea"
                rows={15}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontFamily: 'monospace', resize: 'vertical' }}
                value={systemPrompt} 
                onChange={e => setSystemPrompt(e.target.value)}
              />
              <button 
                className="btn-secondary" 
                style={{ marginTop: '0', flexShrink: 0 }}
                onClick={() => handleSave('system_prompt', systemPrompt)}
                disabled={saving || systemPrompt === settings['system_prompt']?.value}
              >
                <Save size={16} /> Save
              </button>
            </div>
          </div>
        </section>

        {/* Handoff Settings */}
        <section className="settings-card">
          <h2>Handoff (Transfer to Human)</h2>
          <div className="form-group">
            <label>Admin LINE User ID</label>
            <p className="help-text">{settings['admin_line_user_id']?.description}</p>
            <div className="input-with-action">
              <input 
                type="text" 
                value={adminLineId} 
                onChange={e => setAdminLineId(e.target.value)}
              />
              <button 
                className="btn-secondary" 
                onClick={() => handleSave('admin_line_user_id', adminLineId)}
                disabled={saving || adminLineId === settings['admin_line_user_id']?.value}
              >
                <Save size={16} /> Save
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>Handoff Keywords</label>
            <p className="help-text">{settings['handoff_keywords']?.description}</p>
            
            <div className="keyword-input-row">
              <input 
                type="text" 
                placeholder="Add new keyword..." 
                value={newKeyword}
                onChange={e => setNewKeyword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addKeyword()}
              />
              <button className="btn-primary" onClick={addKeyword} disabled={saving || !newKeyword.trim()}>
                <Plus size={16} /> Add
              </button>
            </div>
            
            <div className="keywords-container">
              {handoffKeywords.map((kw, idx) => (
                <div key={idx} className="keyword-chip">
                  <span>{kw}</span>
                  <button className="remove-keyword-btn" onClick={() => removeKeyword(idx)}>
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Facebook Settings */}
        <section className="settings-card">
          <h2>Facebook Messenger Integration</h2>
          <div className="form-group">
            <label>Facebook Page Access Token</label>
            <p className="help-text">{settings['fb_page_access_token']?.description}</p>
            <div className="input-with-action">
              <input 
                type="password" 
                value={fbAccessToken} 
                onChange={e => setFbAccessToken(e.target.value)}
                placeholder="EAA..."
              />
              <button 
                className="btn-secondary" 
                onClick={() => handleSave('fb_page_access_token', fbAccessToken)}
                disabled={saving || fbAccessToken === settings['fb_page_access_token']?.value}
              >
                <Save size={16} /> Save
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>Webhook Verify Token</label>
            <p className="help-text">{settings['fb_verify_token']?.description}</p>
            <div className="input-with-action">
              <input 
                type="text" 
                value={fbVerifyToken} 
                onChange={e => setFbVerifyToken(e.target.value)}
              />
              <button 
                className="btn-secondary" 
                onClick={() => handleSave('fb_verify_token', fbVerifyToken)}
                disabled={saving || fbVerifyToken === settings['fb_verify_token']?.value}
              >
                <Save size={16} /> Save
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
