import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Activity, Loader2, RefreshCw } from 'lucide-react';

interface SystemLog {
  id: string;
  level: string;
  source: string;
  message: string;
  created_at: string;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
    
    // Set up real-time subscription for logs
    const channel = supabase
      .channel('public:system_logs')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'system_logs' },
        (payload) => {
          const newLog = payload.new as SystemLog;
          setLogs(prev => [newLog, ...prev].slice(0, 500)); // Keep only latest 500
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('system_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error('Error fetching logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const getLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'error': return '#ef4444';
      case 'warn': return '#f59e0b';
      default: return '#10b981';
    }
  };

  const getSourceBadge = (source: string) => {
    let bgColor = '#e5e7eb';
    let color = '#374151';
    
    if (source === 'LINE') {
      bgColor = '#dcfce7'; color = '#16a34a';
    } else if (source === 'FB') {
      bgColor = '#dbeafe'; color = '#2563eb';
    } else if (source === 'System') {
      bgColor = '#f3e8ff'; color = '#9333ea';
    }

    return (
      <span style={{ 
        display: 'inline-block', 
        padding: '2px 8px', 
        borderRadius: '12px', 
        fontSize: '0.7rem', 
        fontWeight: 600,
        backgroundColor: bgColor,
        color: color
      }}>
        {source}
      </span>
    );
  };

  if (loading && logs.length === 0) {
    return <div className="page-container"><div className="loading"><Loader2 className="spinner" /> Loading system logs...</div></div>;
  }

  return (
    <div className="page-container">
      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="header-title">
            <Activity className="page-icon" />
            <h1>System Logs</h1>
          </div>
          <p className="header-subtitle">Real-time debugging logs from the bot server</p>
        </div>
        <button className="btn btn-outline" onClick={fetchLogs}>
          <RefreshCw size={16} /> Refresh
        </button>
      </header>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
            <Activity size={48} style={{ opacity: 0.2, margin: '0 auto 16px' }} />
            <h3>No logs found</h3>
            <p>System logs will appear here when the bot processes messages.</p>
          </div>
        ) : (
          <div className="table-container" style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
            <table style={{ margin: 0 }}>
              <thead style={{ position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 1, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                <tr>
                  <th style={{ width: '150px' }}>Timestamp</th>
                  <th style={{ width: '100px' }}>Level</th>
                  <th style={{ width: '100px' }}>Source</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                {logs.map((log) => {
                  const date = new Date(log.created_at);
                  return (
                    <tr key={log.id}>
                      <td style={{ color: 'var(--text-secondary)' }}>
                        {date.toLocaleDateString()} {date.toLocaleTimeString()}
                      </td>
                      <td>
                        <span style={{ color: getLevelColor(log.level), fontWeight: 600, textTransform: 'uppercase' }}>
                          {log.level}
                        </span>
                      </td>
                      <td>
                        {getSourceBadge(log.source)}
                      </td>
                      <td style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                        {log.message}
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
