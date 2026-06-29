import { useEffect, useState } from 'react';
import { Plus, Edit2, X, AlertCircle, Trash2 } from 'lucide-react';
import { supabase } from '../supabase';

export default function ServicesPage() {
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    category: '',
    name: '',
    description: '',
    target_audience: '',
    cautions: '',
    base_price: '',
    image_url: '',
    is_active: true
  });
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('clinic_services')
        .select('*')
        .order('category', { ascending: true });
        
      if (error) throw error;
      setServices(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete the service "${name}"?`)) {
      return;
    }
    
    try {
      const { error } = await supabase
        .from('clinic_services')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      
      setServices(services.filter(s => s.id !== id));
    } catch (err: any) {
      alert(`Error deleting service: ${err.message}`);
    }
  };

  const openModal = (service: any = null) => {
    if (service) {
      setEditingId(service.id);
      setFormData({
        category: service.category,
        name: service.name,
        description: service.description || '',
        target_audience: service.target_audience || '',
        cautions: service.cautions || '',
        base_price: service.base_price || '',
        image_url: service.image_url || '',
        is_active: service.is_active
      });
    } else {
      setEditingId(null);
      setFormData({
        category: '', name: '', description: '', target_audience: '', cautions: '', base_price: '', image_url: '', is_active: true
      });
    }
    setIsModalOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;

    setUploadingImage(true);
    try {
      const { error: uploadError } = await supabase.storage
        .from('promotions')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('promotions').getPublicUrl(fileName);
      setFormData({ ...formData, image_url: data.publicUrl });
    } catch (error: any) {
      alert('Error uploading image: ' + error.message);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        const { error } = await supabase
          .from('clinic_services')
          .update({ ...formData, base_price: Number(formData.base_price) })
          .eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('clinic_services')
          .insert([{ ...formData, base_price: Number(formData.base_price) }]);
        if (error) throw error;
      }
      setIsModalOpen(false);
      fetchServices();
    } catch (err: any) {
      alert('Error saving data: ' + err.message);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Clinic Services</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Manage the services and promotions that the AI Bot uses to answer customers.</p>
        </div>
        <button className="btn btn-primary" onClick={() => openModal()}>
          <Plus size={18} /> Add Service
        </button>
      </div>

      {error && (
        <div style={{ padding: '16px', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={20} /> {error}
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading services...</div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Service Name</th>
                  <th>Base Price (THB)</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {services.map((s) => (
                  <tr key={s.id}>
                    <td><span style={{ fontWeight: 500, color: 'var(--primary-dark)' }}>{s.category}</span></td>
                    <td>{s.name}</td>
                    <td>{s.base_price ? s.base_price.toLocaleString() : '-'}</td>
                    <td>
                      <span className={`status-badge ${s.is_active ? 'status-active' : 'status-inactive'}`}>
                        {s.is_active ? 'Active' : 'Hidden'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-outline" style={{ padding: '6px 12px' }} onClick={() => openModal(s)}>
                          <Edit2 size={14} /> Edit
                        </button>
                        <button className="btn btn-outline" style={{ padding: '6px 12px', borderColor: '#fca5a5', color: '#ef4444' }} onClick={() => handleDelete(s.id, s.name)}>
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {services.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '32px' }}>No services found. Add one to get started.</td>
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
              <h2 className="modal-title">{editingId ? 'Edit Service' : 'Add New Service'}</h2>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Category</label>
                <input required className="form-input" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} placeholder="e.g. Botox, Filler, Surgery" />
              </div>
              <div className="form-group">
                <label className="form-label">Service Name</label>
                <input required className="form-input" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Botox Korea 50U" />
              </div>
              <div className="form-group">
                <label className="form-label">Base Price (THB)</label>
                <input required type="number" className="form-input" value={formData.base_price} onChange={e => setFormData({...formData, base_price: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Description / Selling Point</label>
                <textarea className="form-input" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Brief description to convince the customer..." />
              </div>
              <div className="form-group">
                <label className="form-label">Promotional Image (Artwork)</label>
                {formData.image_url && (
                  <div style={{ marginBottom: '12px' }}>
                    <img src={formData.image_url} alt="Promo" style={{ maxWidth: '100px', borderRadius: '8px' }} />
                  </div>
                )}
                <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploadingImage} />
                {uploadingImage && <span style={{ marginLeft: '12px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Uploading...</span>}
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
