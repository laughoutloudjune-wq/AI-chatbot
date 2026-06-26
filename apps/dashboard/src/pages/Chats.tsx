import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { MessageSquare, Play, Pause, UserX, UserCheck, Loader2, ShieldCheck } from 'lucide-react';

interface ChatSession {
  user_id: string;
  customer_name: string | null;
  last_message: string;
  last_interaction_at: string;
  is_paused: boolean;
  human_only: boolean;
}

export default function ChatsPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  useEffect(() => {
    fetchSessions();
    
    const channel = supabase
      .channel('public:chat_sessions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_sessions' },
        () => { fetchSessions(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchSessions = async () => {
    try {
      const yesterday = new Date();
      yesterday.setHours(yesterday.getHours() - 24);

      const { data, error } = await supabase
        .from('chat_sessions')
        .select('user_id, customer_name, last_message, last_interaction_at, is_paused, human_only')
        .or(`last_interaction_at.gte.${yesterday.toISOString()},human_only.eq.true`)
        .order('last_interaction_at', { ascending: false });

      if (error) throw error;
      setSessions(data || []);
    } catch (err) {
      console.error('Error fetching sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePause = async (userId: string, currentStatus: boolean) => {
    setActionId(userId);
    try {
      const { error } = await supabase
        .from('chat_sessions')
        .update({ is_paused: !currentStatus })
        .eq('user_id', userId);

      if (error) throw error;
      setSessions(prev => prev.map(s => s.user_id === userId ? { ...s, is_paused: !currentStatus } : s));
    } catch (err) {
      console.error('Error toggling session:', err);
      alert('Failed to update AI status.');
    } finally {
      setActionId(null);
    }
  };

  const handleToggleHumanOnly = async (userId: string, currentStatus: boolean) => {
    setActionId(userId);
    try {
      const newHumanOnly = !currentStatus;
      const { error } = await supabase
        .from('chat_sessions')
        .update({ 
          human_only: newHumanOnly,
          is_paused: newHumanOnly ? true : false 
        })
        .eq('user_id', userId);

      if (error) throw error;
      setSessions(prev => prev.map(s => s.user_id === userId ? { ...s, human_only: newHumanOnly, is_paused: newHumanOnly ? true : false } : s));
    } catch (err) {
      console.error('Error toggling human_only:', err);
      alert('Failed to update patient status.');
    } finally {
      setActionId(null);
    }
  };

  // Split into two lists
  const liveChats = sessions.filter(s => !s.human_only);
  const oldPatients = sessions.filter(s => s.human_only);

  if (loading) {
    return <div className="page-container"><div className="loading"><Loader2 className="spinner" /> Loading active chats...</div></div>;
  }

  return (
    <div className="page-container">
      {/* ===== SECTION 1: Live Chats ===== */}
      <header className="page-header">
        <div className="header-title">
          <MessageSquare className="page-icon" />
          <h1>Live Chats</h1>
        </div>
        <p className="header-subtitle">Active customer conversations from the last 24 hours</p>
      </header>

      <div className="card">
        {liveChats.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
            <MessageSquare size={48} style={{ opacity: 0.2, margin: '0 auto 16px' }} />
            <h3>No active chats</h3>
            <p>No new customers have messaged in the last 24 hours.</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Last Message</th>
                  <th>Last Interaction</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {liveChats.map((session) => {
                  const isFb = session.user_id.startsWith('fb_');
                  const platform = isFb ? 'Facebook' : 'LINE';
                  const displayId = isFb ? session.user_id.replace('fb_', '') : session.user_id;
                  const date = new Date(session.last_interaction_at);
                  const isLoading = actionId === session.user_id;
                  
                  return (
                    <tr key={session.user_id}>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 600 }}>{session.customer_name || 'Unknown'}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{platform} • {displayId}</span>
                        </div>
                      </td>
                      <td style={{ maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {session.last_message || '-'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span>{date.toLocaleDateString()}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{date.toLocaleTimeString()}</span>
                        </div>
                      </td>
                      <td>
                        {session.is_paused ? (
                          <span style={{ display: 'inline-block', padding: '4px 8px', borderRadius: '12px', fontSize: '0.75rem', backgroundColor: '#fee2e2', color: '#991b1b', fontWeight: 500 }}>
                            👩‍💼 Human
                          </span>
                        ) : (
                          <span style={{ display: 'inline-block', padding: '4px 8px', borderRadius: '12px', fontSize: '0.75rem', backgroundColor: '#dcfce7', color: '#166534', fontWeight: 500 }}>
                            🤖 AI
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn-outline"
                            onClick={() => handleToggleHumanOnly(session.user_id, false)}
                            disabled={isLoading}
                            title="Mark as old patient — AI will never answer"
                            style={{ fontSize: '0.8rem', borderColor: '#d97706', color: '#d97706' }}
                          >
                            {isLoading ? <Loader2 size={14} className="spinner" /> : <UserX size={14} />}
                            Old Patient
                          </button>

                          {session.is_paused ? (
                            <button 
                              className="btn btn-primary"
                              onClick={() => handleTogglePause(session.user_id, true)}
                              disabled={isLoading}
                              style={{ fontSize: '0.8rem' }}
                            >
                              {isLoading ? <Loader2 size={14} className="spinner" /> : <Play size={14} />}
                              Return to AI
                            </button>
                          ) : (
                            <button 
                              className="btn btn-outline"
                              onClick={() => handleTogglePause(session.user_id, false)}
                              disabled={isLoading}
                              style={{ fontSize: '0.8rem' }}
                            >
                              {isLoading ? <Loader2 size={14} className="spinner" /> : <Pause size={14} />}
                              Take Over
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ===== SECTION 2: Old Patients ===== */}
      <header className="page-header" style={{ marginTop: '32px' }}>
        <div className="header-title">
          <ShieldCheck className="page-icon" />
          <h1>Old Patients</h1>
        </div>
        <p className="header-subtitle">Permanently human-only — AI will never respond to these patients</p>
      </header>

      <div className="card">
        {oldPatients.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
            <ShieldCheck size={48} style={{ opacity: 0.2, margin: '0 auto 16px' }} />
            <h3>No old patients marked</h3>
            <p>Use the "Old Patient" button in Live Chats to mark returning patients.</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Last Message</th>
                  <th>Last Interaction</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {oldPatients.map((session) => {
                  const isFb = session.user_id.startsWith('fb_');
                  const platform = isFb ? 'Facebook' : 'LINE';
                  const displayId = isFb ? session.user_id.replace('fb_', '') : session.user_id;
                  const date = new Date(session.last_interaction_at);
                  const isLoading = actionId === session.user_id;
                  
                  return (
                    <tr key={session.user_id}>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 600 }}>{session.customer_name || 'Unknown'}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{platform} • {displayId}</span>
                        </div>
                      </td>
                      <td style={{ maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {session.last_message || '-'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span>{date.toLocaleDateString()}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{date.toLocaleTimeString()}</span>
                        </div>
                      </td>
                      <td>
                        <span style={{ display: 'inline-block', padding: '4px 8px', borderRadius: '12px', fontSize: '0.75rem', backgroundColor: '#fef3c7', color: '#92400e', fontWeight: 500 }}>
                          🏥 Old Patient
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn-outline"
                          onClick={() => handleToggleHumanOnly(session.user_id, true)}
                          disabled={isLoading}
                          title="Remove old patient flag and enable AI"
                          style={{ fontSize: '0.8rem' }}
                        >
                          {isLoading ? <Loader2 size={14} className="spinner" /> : <UserCheck size={14} />}
                          Enable AI
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
