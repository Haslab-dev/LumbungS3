import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, UserCheck, UserX, Trash2, Loader2, AlertCircle, ShieldAlert, Search, RefreshCw } from 'lucide-react';
import api from '../../lib/api';

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
}

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get('/auth/users');
      setUsers(res.data);
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError('Access denied. Only the super admin can manage users.');
      } else {
        setError(err.response?.data?.error || 'Failed to fetch users.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const toggleStatus = async (user: User) => {
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    setActionLoading(user.id + '-status');
    try {
      await api.patch(`/auth/users/${user.id}/status`, { status: newStatus });
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: newStatus } : u));
      showSuccess(`${user.username} has been ${newStatus === 'active' ? 'activated' : 'deactivated'}.`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update user status.');
    } finally {
      setActionLoading(null);
    }
  };

  const deleteUser = async (user: User) => {
    if (!confirm(`Are you sure you want to permanently delete "${user.username}"?`)) return;
    setActionLoading(user.id + '-delete');
    try {
      await api.delete(`/auth/users/${user.id}`);
      setUsers(prev => prev.filter(u => u.id !== user.id));
      showSuccess(`${user.username} has been deleted.`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete user.');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredUsers = users.filter(u =>
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">User Management</h2>
          <p className="text-sm text-slate-400 mt-1">Manage registered accounts — activate, deactivate or remove users.</p>
        </div>
        <button
          onClick={fetchUsers}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition-all border border-slate-700 cursor-pointer"
        >
          <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Alerts */}
      <AnimatePresence>
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-emerald-300 text-sm"
          >
            <UserCheck size={16} className="shrink-0" />
            {successMsg}
          </motion.div>
        )}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-3 bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 text-rose-300 text-sm"
          >
            {error.includes('denied') ? <ShieldAlert size={16} className="shrink-0" /> : <AlertCircle size={16} className="shrink-0" />}
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Users', value: users.length, color: 'text-indigo-400' },
          { label: 'Active', value: users.filter(u => u.status === 'active').length, color: 'text-emerald-400' },
          { label: 'Inactive', value: users.filter(u => u.status === 'inactive').length, color: 'text-rose-400' },
        ].map(stat => (
          <div key={stat.label} className="glass-card rounded-2xl p-4 border border-white/5">
            <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold mb-1">{stat.label}</p>
            <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          placeholder="Search by username or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-slate-900/60 border border-slate-700/50 rounded-xl pl-11 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-slate-600 text-sm"
        />
      </div>

      {/* User Table */}
      <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-slate-400">
            <Loader2 size={20} className="animate-spin" />
            <span>Loading users...</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <Users size={40} className="mb-3 opacity-30" />
            <p className="font-medium">{search ? 'No users match your search' : 'No users registered yet'}</p>
            <p className="text-xs mt-1 text-slate-600">New users appear here when they register an account.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left px-6 py-4 text-[11px] text-slate-500 uppercase tracking-widest font-bold">User</th>
                  <th className="text-left px-6 py-4 text-[11px] text-slate-500 uppercase tracking-widest font-bold hidden sm:table-cell">Email</th>
                  <th className="text-left px-6 py-4 text-[11px] text-slate-500 uppercase tracking-widest font-bold">Status</th>
                  <th className="text-left px-6 py-4 text-[11px] text-slate-500 uppercase tracking-widest font-bold hidden md:table-cell">Joined</th>
                  <th className="text-right px-6 py-4 text-[11px] text-slate-500 uppercase tracking-widest font-bold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredUsers.map(user => (
                  <motion.tr
                    key={user.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="hover:bg-slate-800/30 transition-colors group"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-indigo-600/20 border border-indigo-500/20 flex items-center justify-center text-indigo-400 text-sm font-bold shrink-0">
                          {user.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{user.username}</p>
                          <p className="text-xs text-slate-500">{user.role}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-400 hidden sm:table-cell">{user.email}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                        user.status === 'active'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${user.status === 'active' ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                        {user.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500 hidden md:table-cell">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {/* Toggle Status */}
                        <button
                          onClick={() => toggleStatus(user)}
                          disabled={actionLoading === user.id + '-status'}
                          title={user.status === 'active' ? 'Deactivate user' : 'Activate user'}
                          className={`p-2 rounded-xl transition-all cursor-pointer border ${
                            user.status === 'active'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                          } disabled:opacity-50`}
                        >
                          {actionLoading === user.id + '-status'
                            ? <Loader2 size={14} className="animate-spin" />
                            : user.status === 'active' ? <UserX size={14} /> : <UserCheck size={14} />
                          }
                        </button>
                        {/* Delete */}
                        <button
                          onClick={() => deleteUser(user)}
                          disabled={actionLoading === user.id + '-delete'}
                          title="Delete user permanently"
                          className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-all cursor-pointer disabled:opacity-50"
                        >
                          {actionLoading === user.id + '-delete'
                            ? <Loader2 size={14} className="animate-spin" />
                            : <Trash2 size={14} />
                          }
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
