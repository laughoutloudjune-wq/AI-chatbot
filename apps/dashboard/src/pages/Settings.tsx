import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Settings as SettingsIcon, Save, Plus, X, Loader2 } from 'lucide-react';

interface SystemSetting {
  key: string;
  value: any;
  description: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, SystemSetting>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [newKeyword, setNewKeyword] = useState('');

  // Form states
  const [clinicName, setClinicName] = useState('');
  const [adminLineId, setAdminLineId] = useState('');
  const [fbAccessToken, setFbAccessToken] = useState('');
  const [fbVerifyToken, setFbVerifyToken] = useState('');
  const [handoffKeywords, setHandoffKeywords] = useState<string[]>([]);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [takeoverMinutes, setTakeoverMinutes] = useState(120);
  const [aiStatusLine, setAiStatusLine] = useState(true);
  const [aiStatusFb, setAiStatusFb] = useState(true);

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
      setTakeoverMinutes(settingsMap['takeover_duration_minutes']?.value || 120);
      
      const lineStatus = settingsMap['ai_status_line']?.value;
      setAiStatusLine(lineStatus !== undefined ? String(lineStatus) === 'true' : true);
      
      const fbStatus = settingsMap['ai_status_fb']?.value;
      setAiStatusFb(fbStatus !== undefined ? String(fbStatus) === 'true' : true);
      
    } catch (err) {
      console.error('Error fetching settings:', err);
      alert('Failed to load settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (key: string, value: any) => {
    setSavingKey(key);
    try {
      // Add a minimum delay so the saving animation is visible
      await new Promise(resolve => setTimeout(resolve, 600));
      
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
      setSavingKey(null);
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
        {/* Global AI Status */}
        <section className="settings-card" style={{ gridColumn: '1 / -1', borderLeft: '4px solid #ef4444' }}>
          <h2>Global AI Power Switch</h2>
          <p className="help-text">Turn the AI completely on or off. If turned off, the AI will ignore all incoming messages, giving you 100% manual control over the platform.</p>
          
          <div style={{ display: 'flex', gap: '24px', marginTop: '16px', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: 1, minWidth: '250px', padding: '16px', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ margin: 0 }}>LINE AI Status</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    className={`btn ${aiStatusLine ? 'btn-primary' : 'btn-outline'}`}
                    style={aiStatusLine ? { backgroundColor: '#10b981', borderColor: '#10b981' } : {}}
                    onClick={() => {
                      setAiStatusLine(true);
                      handleSave('ai_status_line', 'true');
                    }}
                    disabled={savingKey === 'ai_status_line'}
                  >
                    ON
                  </button>
                  <button 
                    className={`btn ${!aiStatusLine ? 'btn-primary' : 'btn-outline'}`}
                    style={!aiStatusLine ? { backgroundColor: '#ef4444', borderColor: '#ef4444' } : {}}
                    onClick={() => {
                      setAiStatusLine(false);
                      handleSave('ai_status_line', 'false');
                    }}
                    disabled={savingKey === 'ai_status_line'}
                  >
                    OFF
                  </button>
                </div>
              </div>
            </div>

            <div className="form-group" style={{ flex: 1, minWidth: '250px', padding: '16px', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ margin: 0 }}>Facebook AI Status</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    className={`btn ${aiStatusFb ? 'btn-primary' : 'btn-outline'}`}
                    style={aiStatusFb ? { backgroundColor: '#10b981', borderColor: '#10b981' } : {}}
                    onClick={() => {
                      setAiStatusFb(true);
                      handleSave('ai_status_fb', 'true');
                    }}
                    disabled={savingKey === 'ai_status_fb'}
                  >
                    ON
                  </button>
                  <button 
                    className={`btn ${!aiStatusFb ? 'btn-primary' : 'btn-outline'}`}
                    style={!aiStatusFb ? { backgroundColor: '#ef4444', borderColor: '#ef4444' } : {}}
                    onClick={() => {
                      setAiStatusFb(false);
                      handleSave('ai_status_fb', 'false');
                    }}
                    disabled={savingKey === 'ai_status_fb'}
                  >
                    OFF
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

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
                className="btn btn-secondary" 
                onClick={() => handleSave('clinic_name', clinicName)}
                disabled={savingKey === 'clinic_name' || clinicName === settings['clinic_name']?.value}
              >
                {savingKey === 'clinic_name' ? <Loader2 size={16} className="spinner" /> : <Save size={16} />} 
                {savingKey === 'clinic_name' ? 'Saving...' : 'Save'}
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
                className="btn btn-secondary" 
                style={{ marginTop: '0', flexShrink: 0 }}
                onClick={() => handleSave('system_prompt', systemPrompt)}
                disabled={savingKey === 'system_prompt' || systemPrompt === settings['system_prompt']?.value}
              >
                {savingKey === 'system_prompt' ? <Loader2 size={16} className="spinner" /> : <Save size={16} />} 
                {savingKey === 'system_prompt' ? 'Saving...' : 'Save'}
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
                className="btn btn-secondary" 
                onClick={() => handleSave('admin_line_user_id', adminLineId)}
                disabled={savingKey === 'admin_line_user_id' || adminLineId === settings['admin_line_user_id']?.value}
              >
                {savingKey === 'admin_line_user_id' ? <Loader2 size={16} className="spinner" /> : <Save size={16} />} 
                {savingKey === 'admin_line_user_id' ? 'Saving...' : 'Save'}
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
              <button className="btn btn-primary" onClick={addKeyword} disabled={savingKey === 'handoff_keywords' || !newKeyword.trim()}>
                {savingKey === 'handoff_keywords' ? <Loader2 size={16} className="spinner" /> : <Plus size={16} />} Add
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

          <div className="form-group">
            <label>Take Over Duration (minutes)</label>
            <p className="help-text">How long "Take Over" lasts before AI automatically resumes. Default: 120 minutes (2 hours).</p>
            <div className="input-with-action">
              <input 
                type="number" 
                min="5" 
                max="1440" 
                value={takeoverMinutes} 
                onChange={e => setTakeoverMinutes(Number(e.target.value))}
              />
              <button 
                className="btn btn-secondary" 
                onClick={() => handleSave('takeover_duration_minutes', takeoverMinutes)}
                disabled={savingKey === 'takeover_duration_minutes' || takeoverMinutes === settings['takeover_duration_minutes']?.value}
              >
                {savingKey === 'takeover_duration_minutes' ? <Loader2 size={16} className="spinner" /> : <Save size={16} />} 
                {savingKey === 'takeover_duration_minutes' ? 'Saving...' : 'Save'}
              </button>
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
                className="btn btn-secondary" 
                onClick={() => handleSave('fb_page_access_token', fbAccessToken)}
                disabled={savingKey === 'fb_page_access_token' || fbAccessToken === settings['fb_page_access_token']?.value}
              >
                {savingKey === 'fb_page_access_token' ? <Loader2 size={16} className="spinner" /> : <Save size={16} />} 
                {savingKey === 'fb_page_access_token' ? 'Saving...' : 'Save'}
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
                className="btn btn-secondary" 
                onClick={() => handleSave('fb_verify_token', fbVerifyToken)}
                disabled={savingKey === 'fb_verify_token' || fbVerifyToken === settings['fb_verify_token']?.value}
              >
                {savingKey === 'fb_verify_token' ? <Loader2 size={16} className="spinner" /> : <Save size={16} />} 
                {savingKey === 'fb_verify_token' ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
