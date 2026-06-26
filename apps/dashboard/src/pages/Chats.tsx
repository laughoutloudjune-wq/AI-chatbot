import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { MessageSquare, Play, Loader2 } from 'lucide-react';

interface ChatSession {
  user_id: string;
  last_message: string;
  last_interaction_at: string;
  is_paused: boolean;
}

export default function ChatsPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [resumingId, setResumingId] = useState<string | null>(null);

  useEffect(() => {
    fetchPausedSessions();
    
    // Set up real-time subscription
    const channel = supabase
      .channel('public:chat_sessions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_sessions' },
        () => {
          fetchPausedSessions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchPausedSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_sessions')
        .select('user_id, last_message, last_interaction_at, is_paused')
        .eq('is_paused', true)
        .order('last_interaction_at', { ascending: false });

      if (error) throw error;
      setSessions(data || []);
    } catch (err) {
      console.error('Error fetching sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleResume = async (userId: string) => {
    setResumingId(userId);
    try {
      const { error } = await supabase
        .from('chat_sessions')
        .update({ is_paused: false })
        .eq('user_id', userId);

      if (error) throw error;
      
      // Remove from list locally
      setSessions(prev => prev.filter(s => s.user_id !== userId));
    } catch (err) {
      console.error('Error resuming session:', err);
      alert('Failed to unpause the AI.');
    } finally {
      setResumingId(null);
    }
  };

  if (loading) {
    return <div className="page-container"><div className="loading"><Loader2 className="spinner" /> Loading active chats...</div></div>;
  }

  return (
    <div className="page-container">
      <header className="page-header">
        <div className="header-title">
          <MessageSquare className="page-icon" />
          <h1>Live Chats (Handoffs)</h1>
        </div>
        <p className="header-subtitle">Manage customers currently talking to a human admin</p>
      </header>

      <div className="card">
        {sessions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
            <MessageSquare size={48} style={{ opacity: 0.2, margin: '0 auto 16px' }} />
            <h3>No paused chats right now</h3>
            <p>The AI is currently handling all customer inquiries.</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Platform & ID</th>
                  <th>Last Message</th>
                  <th>Last Interaction</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => {
                  const isFb = session.user_id.startsWith('fb_');
                  const platform = isFb ? 'Facebook' : 'LINE';
                  const displayId = isFb ? session.user_id.replace('fb_', '') : session.user_id;
                  const date = new Date(session.last_interaction_at);
                  
                  return (
                    <tr key={session.user_id}>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 600 }}>{platform}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{displayId}</span>
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
                      <td style={{ textAlign: 'right' }}>
                        <button 
                          className="btn btn-primary"
                          onClick={() => handleResume(session.user_id)}
                          disabled={resumingId === session.user_id}
                        >
                          {resumingId === session.user_id ? <Loader2 size={16} className="spinner" /> : <Play size={16} />}
                          Return to AI
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
