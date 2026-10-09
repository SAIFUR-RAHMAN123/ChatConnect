import { useState } from 'react';
import api, { getErrorMessage } from '../services/api';
import { formatLastSeen } from '../utils/format';
import Modal from './Modal';
import Avatar from './Avatar';
import UserPicker from './UserPicker';
import { ErrorBanner, inputClass } from './AuthLayout';

export default function GroupInfoModal({ conversation, members, meId, onClose, onChanged, onLeft }) {
  const isAdmin = conversation.admin === meId;
  const [name, setName] = useState(conversation.name);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const base = `/conversations/${conversation._id}`;

  const run = async (fn) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const rename = (e) => {
    e.preventDefault();
    if (!name.trim() || name.trim() === conversation.name) return;
    run(async () => {
      await api.patch(base, { name: name.trim() });
      await onChanged();
    });
  };
  const addMember = (u) =>
    run(async () => {
      await api.post(`${base}/members`, { userIds: [u._id] });
      await onChanged();
    });
  const removeMember = (u) =>
    run(async () => {
      await api.delete(`${base}/members/${u._id}`);
      await onChanged();
    });
  const leave = () =>
    run(async () => {
      await api.delete(`${base}/members/${meId}`);
      onLeft(conversation._id);
    });

  const sorted = [...members].sort((a, b) => (b._id === conversation.admin) - (a._id === conversation.admin));

  return (
    <Modal title="Group info" onClose={onClose}>
      <ErrorBanner message={error} />

      {isAdmin ? (
        <form onSubmit={rename} className="mb-4 flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={50}
            aria-label="Group name"
            className={inputClass}
            disabled={busy}
          />
          <button
            type="submit"
            disabled={busy || !name.trim() || name.trim() === conversation.name}
            className="shrink-0 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Rename
          </button>
        </form>
      ) : (
        <p className="mb-4 text-lg font-semibold">{conversation.name}</p>
      )}

      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{members.length} members</h3>
      <ul className="mb-4 divide-y divide-slate-100">
        {sorted.map((u) => {
          const me = u._id === meId;
          return (
            <li key={u._id} className="flex items-center gap-3 py-2">
              <Avatar user={u} size="sm" showStatus />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {u.name}
                  {me && <span className="ml-1 text-slate-400">(You)</span>}
                  {u._id === conversation.admin && (
                    <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-medium text-accent">Admin</span>
                  )}
                </p>
                <p className={`truncate text-xs ${u.isOnline || me ? 'text-emerald-600' : 'text-slate-500'}`}>
                  {u.isOnline || me ? '🟢 Online' : formatLastSeen(u.lastSeen)}
                </p>
              </div>
              {isAdmin && !me && (
                <button
                  onClick={() => removeMember(u)}
                  disabled={busy}
                  aria-label={`Remove ${u.name}`}
                  className="rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  Remove
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {isAdmin && (
        <div className="mb-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Add members</h3>
          <UserPicker label="Add members" excludeIds={members.map((m) => m._id)} onPick={addMember} />
        </div>
      )}

      {confirmLeave ? (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm">
          <span className="text-red-700">Leave this group?</span>
          <span className="flex gap-2">
            <button onClick={leave} disabled={busy} className="font-semibold text-red-600 hover:underline">Yes, leave</button>
            <button onClick={() => setConfirmLeave(false)} className="text-slate-600 hover:underline">Cancel</button>
          </span>
        </div>
      ) : (
        <button
          onClick={() => setConfirmLeave(true)}
          className="w-full rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
        >
          Leave group
        </button>
      )}
    </Modal>
  );
}