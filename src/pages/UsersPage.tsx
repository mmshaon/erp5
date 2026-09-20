// src/pages/UsersPage.tsx
import { useEffect, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { isSuperUser } from '../lib/auth'
import { api } from '../lib/api'

interface User {
  id: string; username: string; full_name: string; email: string;
  role: string; department: string; is_active: boolean; last_login: string;
}
interface EditForm { full_name:string; email:string; role:string; department:string; password:string }

export default function UsersPage() {
  const { user } = useAuth()
  const su = isSuperUser(user)

  const [users,   setUsers]   = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [success, setSuccess] = useState('')

  // New user
  const [showNew, setShowNew] = useState(false)
  const [newForm, setNewForm] = useState({ username:'', email:'', full_name:'', password:'', role:'staff', department:'' })
  const [saving,  setSaving]  = useState(false)

  // Edit user
  const [editUser, setEditUser] = useState<User | null>(null)
  const [editForm, setEditForm] = useState<EditForm>({ full_name:'', email:'', role:'staff', department:'', password:'' })
  const [editSaving, setEditSaving] = useState(false)

  useEffect(() => {
    if (!su) { setLoading(false); return }
    reload()
  }, [su])

  function reload() {
    setLoading(true)
    api.get<{ users: User[] }>('/users')
      .then(d => setUsers(d.users))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  function flash(msg: string) { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }

  async function toggleActive(u: User) {
    try {
      await api.patch(`/users/${u.id}`, { is_active: !u.is_active })
      setUsers(p => p.map(x => x.id === u.id ? { ...x, is_active: !u.is_active } : x))
      flash(`${u.full_name} ${u.is_active ? 'deactivated' : 'activated'}.`)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Update failed') }
  }

  async function createUser() {
    if (!newForm.username || !newForm.email || !newForm.full_name || !newForm.password) {
      setError('All fields except Department are required.'); return
    }
    setError(''); setSaving(true)
    try {
      const data = await api.post<{ user: User }>('/users', newForm)
      setUsers(p => [data.user, ...p])
      setShowNew(false)
      setNewForm({ username:'', email:'', full_name:'', password:'', role:'staff', department:'' })
      flash('User created successfully.')
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to create user') }
    finally { setSaving(false) }
  }

  function openEdit(u: User) {
    setEditUser(u)
    setEditForm({ full_name:u.full_name, email:u.email, role:u.role, department:u.department||'', password:'' })
    setError('')
  }

  async function saveEdit() {
    if (!editUser) return
    if (!editForm.full_name.trim() || !editForm.email.trim()) { setError('Full name and email are required.'); return }
    setError(''); setEditSaving(true)
    try {
      const body: Record<string,string> = {
        full_name:  editForm.full_name.trim(),
        email:      editForm.email.trim(),
        role:       editForm.role,
        department: editForm.department.trim(),
      }
      if (editForm.password.trim()) body.password = editForm.password.trim()
      await api.patch(`/users/${editUser.id}`, body)
      setUsers(p => p.map(x => x.id === editUser.id ? { ...x, ...body } : x))
      setEditUser(null)
      flash('User updated successfully.')
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Update failed') }
    finally { setEditSaving(false) }
  }

  if (!su) return (
    <div className="glass" style={{ padding:'2rem', textAlign:'center', color:'var(--text-muted)' }}>
      User management requires superuser privileges.
    </div>
  )

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.25rem', gap:'0.75rem', flexWrap:'wrap' }}>
        <h1 className="page-title">Users</h1>
        <button className="btn btn-primary" onClick={() => { setShowNew(p => !p); setError('') }}>
          {showNew ? '✕ Cancel' : '+ New User'}
        </button>
      </div>

      {error   && <div className="alert-error">{error}</div>}
      {success && <div className="alert-success">{success}</div>}

      {/* New user form */}
      {showNew && (
        <div className="glass" style={{ padding:'1.25rem', marginBottom:'1.25rem' }}>
          <div className="section-label">Create New User</div>
          <div className="form-grid">
            <div className="form-row"><label className="label">Full Name *</label><input className="input" value={newForm.full_name} onChange={e=>setNewForm(p=>({...p,full_name:e.target.value}))} placeholder="e.g. Ahmed Al-Rashidi" /></div>
            <div className="form-row"><label className="label">Username *</label><input className="input mono" value={newForm.username} onChange={e=>setNewForm(p=>({...p,username:e.target.value.toLowerCase()}))} placeholder="e.g. ahmed.rashidi" /></div>
            <div className="form-row"><label className="label">Email *</label><input className="input" type="email" value={newForm.email} onChange={e=>setNewForm(p=>({...p,email:e.target.value}))} placeholder="user@company.com" /></div>
            <div className="form-row"><label className="label">Password *</label><input className="input" type="password" value={newForm.password} onChange={e=>setNewForm(p=>({...p,password:e.target.value}))} placeholder="Minimum 8 characters" /></div>
            <div className="form-row">
              <label className="label">Role *</label>
              <select className="input" value={newForm.role} onChange={e=>setNewForm(p=>({...p,role:e.target.value}))}>
                <option value="staff">Staff</option>
                <option value="manager">Manager</option>
                <option value="superuser">Superuser</option>
              </select>
            </div>
            <div className="form-row"><label className="label">Department</label><input className="input" value={newForm.department} onChange={e=>setNewForm(p=>({...p,department:e.target.value}))} placeholder="Optional" /></div>
          </div>
          <div style={{ marginTop:'1rem' }}>
            <button className="btn btn-primary" onClick={createUser} disabled={saving}>{saving ? 'Creating…' : '✓ Create User'}</button>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editUser && (
        <div style={{ position:'fixed', inset:0, background:'rgba(2,13,20,0.85)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
          <div className="glass" style={{ width:'100%', maxWidth:520, padding:'1.5rem', maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.25rem' }}>
              <h2 style={{ fontFamily:'Syne,sans-serif', fontSize:'1.1rem', fontWeight:700, color:'var(--text)', margin:0 }}>Edit User</h2>
              <button onClick={() => setEditUser(null)} style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:'1.4rem', lineHeight:1 }}>✕</button>
            </div>
            {error && <div className="alert-error">{error}</div>}
            <div className="form-grid">
              <div className="form-row"><label className="label">Full Name *</label><input className="input" value={editForm.full_name} onChange={e=>setEditForm(p=>({...p,full_name:e.target.value}))} /></div>
              <div className="form-row"><label className="label">Email *</label><input className="input" type="email" value={editForm.email} onChange={e=>setEditForm(p=>({...p,email:e.target.value}))} /></div>
              <div className="form-row">
                <label className="label">Role</label>
                <select className="input" value={editForm.role} onChange={e=>setEditForm(p=>({...p,role:e.target.value}))}>
                  <option value="staff">Staff</option>
                  <option value="manager">Manager</option>
                  <option value="superuser">Superuser</option>
                </select>
              </div>
              <div className="form-row"><label className="label">Department</label><input className="input" value={editForm.department} onChange={e=>setEditForm(p=>({...p,department:e.target.value}))} placeholder="Optional" /></div>
              <div className="form-row col-span-2">
                <label className="label">New Password <span style={{ color:'var(--muted)', textTransform:'none', letterSpacing:0 }}>(leave blank to keep current)</span></label>
                <input className="input" type="password" value={editForm.password} onChange={e=>setEditForm(p=>({...p,password:e.target.value}))} placeholder="Enter to change password" />
              </div>
            </div>
            <div style={{ display:'flex', gap:'0.75rem', marginTop:'1.25rem' }}>
              <button className="btn btn-secondary" onClick={() => setEditUser(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveEdit} disabled={editSaving}>{editSaving ? 'Saving…' : '✓ Save Changes'}</button>
            </div>
          </div>
        </div>
      )}

      {loading && <div style={{ color:'var(--text-muted)', padding:'1rem' }}>Loading users…</div>}

      {!loading && (
        <div className="glass table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Username</th>
                <th>Role</th>
                <th>Dept</th>
                <th>Last Login</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign:'center', color:'var(--muted)', padding:'2.5rem' }}>No users found</td></tr>
              )}
              {users.map(u => (
                <tr key={u.id}>
                  <td style={{ fontWeight:500 }}>{u.full_name}</td>
                  <td><span className="mono" style={{ color:'var(--text-muted)', fontSize:'0.82rem' }}>{u.username}</span></td>
                  <td>
                    <span style={{
                      color: u.role==='superuser'?'var(--cyan)':u.role==='manager'?'var(--warning)':'var(--text-muted)',
                      fontSize:'0.78rem', textTransform:'uppercase', letterSpacing:'0.05em', fontWeight:600,
                    }}>{u.role}</span>
                  </td>
                  <td style={{ color:'var(--text-muted)', fontSize:'0.85rem' }}>{u.department || '—'}</td>
                  <td style={{ color:'var(--muted)', fontSize:'0.8rem', whiteSpace:'nowrap' }}>
                    {u.last_login ? new Date(u.last_login).toLocaleDateString('en-GB') : 'Never'}
                  </td>
                  <td>
                    <span className={`badge ${u.is_active ? 'badge-approved' : 'badge-rejected'}`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display:'flex', gap:'0.4rem', flexWrap:'wrap' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(u)}>Edit</button>
                      {u.id !== user?.id && (
                        <button
                          className={`btn btn-sm ${u.is_active ? 'btn-danger' : 'btn-success'}`}
                          onClick={() => toggleActive(u)}
                        >
                          {u.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
