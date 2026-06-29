import { useEffect, useState } from 'react';
import { Plus, Edit2, X, AlertCircle, Trash2 } from 'lucide-react';
import { supabase } from '../supabase';

export default function FaqsPage() {
  const [faqs, setFaqs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    topic: '',
    question: '',
    answer: '',
    is_active: true,
    image_urls: [] as string[]
  });

  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    fetchFaqs();
  }, []);

  const fetchFaqs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('clinic_faqs')
        .select('*')
        .order('topic', { ascending: true });
        
      if (error) throw error;
      setFaqs(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, topic: string) => {
    if (!window.confirm(`Are you sure you want to delete the FAQ for "${topic}"?`)) {
      return;
    }
    
    try {
      const { error } = await supabase
        .from('clinic_faqs')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      
      setFaqs(faqs.filter(f => f.id !== id));
    } catch (err: any) {
      alert(`Error deleting FAQ: ${err.message}`);
    }
  };

  const openModal = (faq: any = null) => {
    if (faq) {
      setEditingId(faq.id);
      setFormData({
        topic: faq.topic,
        question: faq.question,
        answer: faq.answer,
        is_active: faq.is_active,
        image_urls: faq.image_urls || []
      });
    } else {
      setEditingId(null);
      setFormData({
        topic: '', question: '', answer: '', is_active: true, image_urls: []
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        const { error } = await supabase
          .from('clinic_faqs')
          .update(formData)
          .eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('clinic_faqs')
          .insert([formData]);
        if (error) throw error;
      }
      setIsModalOpen(false);
      fetchFaqs();
    } catch (err: any) {
      alert('Error saving data: ' + err.message);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);
    
    try {
      setUploadingImage(true);
      const newUrls: string[] = [];

      for (const file of files) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('clinic_images')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from('clinic_images')
          .getPublicUrl(filePath);

        newUrls.push(data.publicUrl);
      }

      setFormData({ ...formData, image_urls: [...formData.image_urls, ...newUrls] });
    } catch (err: any) {
      alert('Error uploading image: ' + err.message);
    } finally {
      setUploadingImage(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Knowledge Base & FAQs</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Answers to common questions for the AI to learn from.</p>
        </div>
        <button className="btn btn-primary" onClick={() => openModal()}>
          <Plus size={18} /> Add FAQ
        </button>
      </div>

      {error && (
        <div style={{ padding: '16px', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={20} /> {error}
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading FAQs...</div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Topic</th>
                  <th>Question (Example)</th>
                  <th>Answer</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {faqs.map((f) => (
                  <tr key={f.id}>
                    <td style={{ width: '15%' }}><span style={{ fontWeight: 500, color: 'var(--primary-dark)' }}>{f.topic}</span></td>
                    <td style={{ width: '25%' }}>{f.question}</td>
                    <td style={{ width: '40%' }}>
                      <div style={{ maxHeight: '60px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {f.answer}
                      </div>
                      {f.image_urls && f.image_urls.length > 0 && (
                        <div style={{ fontSize: '12px', color: 'var(--primary-dark)', marginTop: '4px' }}>
                          {f.image_urls.length} Attached Image(s)
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`status-badge ${f.is_active ? 'status-active' : 'status-inactive'}`}>
                        {f.is_active ? 'Active' : 'Hidden'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-outline" style={{ padding: '6px 12px' }} onClick={() => openModal(f)}>
                          <Edit2 size={14} /> Edit
                        </button>
                        <button className="btn btn-outline" style={{ padding: '6px 12px', borderColor: '#fca5a5', color: '#ef4444' }} onClick={() => handleDelete(f.id, f.topic)}>
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {faqs.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '32px' }}>No FAQs found. Add one to get started.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title">{editingId ? 'Edit FAQ' : 'Add New FAQ'}</h2>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Topic / Category</label>
                <input required className="form-input" value={formData.topic} onChange={e => setFormData({...formData, topic: e.target.value})} placeholder="e.g. Booking, Pricing, General" />
              </div>
              <div className="form-group">
                <label className="form-label">Example Question</label>
                <input required className="form-input" value={formData.question} onChange={e => setFormData({...formData, question: e.target.value})} placeholder="e.g. คลินิกเปิดกี่โมงคะ" />
              </div>
              <div className="form-group">
                <label className="form-label">Answer</label>
                <textarea required className="form-input" value={formData.answer} onChange={e => setFormData({...formData, answer: e.target.value})} placeholder="Full answer for the bot to read..." style={{ minHeight: '150px' }} />
              </div>
              <div className="form-group">
                <label className="form-label">Images (Optional)</label>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <input type="file" multiple accept="image/*" onChange={handleImageUpload} disabled={uploadingImage} />
                  {uploadingImage && <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Uploading...</span>}
                </div>
                {formData.image_urls && formData.image_urls.length > 0 && (
                  <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {formData.image_urls.map((url, idx) => (
                      <div key={idx} style={{ position: 'relative' }}>
                        <img src={url} alt={`FAQ Preview ${idx}`} style={{ height: '80px', width: '80px', borderRadius: '4px', objectFit: 'cover' }} />
                        <button type="button" onClick={() => setFormData({...formData, image_urls: formData.image_urls.filter((_, i) => i !== idx)})} style={{ position: 'absolute', top: '-8px', right: '-8px', background: 'red', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="checkbox" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} />
                  Active (Visible to Bot)
                </label>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '32px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
