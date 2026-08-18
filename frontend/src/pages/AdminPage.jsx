import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../api/endpoints';

export default function AdminPage() {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [userList, statsData] = await Promise.all([adminApi.users(), adminApi.stats()]);
      setUsers(userList);
      setStats(statsData);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load admin data');
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleRoleChange = async (user, role) => {
    setUpdating(true);
    setError('');
    try {
      await adminApi.changeRole(user.id, role);
      await refresh();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update role');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-6 text-xl font-semibold text-slate-900 dark:text-white">Admin</h1>

      {stats && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Users', stats.users],
            ['Documents', stats.documents],
            ['Ready', stats.documents_ready],
            ['Failed', stats.documents_failed],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-xl border border-slate-200 bg-white p-4 text-center dark:border-slate-800 dark:bg-slate-900"
            >
              <p className="text-2xl font-semibold text-slate-900 dark:text-white">{value}</p>
              <p className="text-xs text-slate-400">{label}</p>
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 p-2 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400 dark:border-slate-800">
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                  {user.full_name}
                </td>
                <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{user.email}</td>
                <td className="px-4 py-3">
                  <select
                    value={user.role}
                    disabled={updating}
                    onChange={(e) => handleRoleChange(user, e.target.value)}
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                  >
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      user.is_active
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
                    }`}
                  >
                    {user.is_active ? 'active' : 'inactive'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}