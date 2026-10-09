import { useState } from 'react';
import api, { getErrorMessage } from '../services/api';
import Modal from './Modal';
import UserPicker from './UserPicker';
import { ErrorBanner, SubmitButton, inputClass } from './AuthLayout';

export default function NewGroupModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [members, setMembers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return setError('Group name is required');
    if (!members.length) return setError('Add at least one member');
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post('/conversations/group', {
        name: name.trim(),
        participantIds: members.map((m) => m._id),
      });
      onCreated(data.conversation);
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Modal title="New group" onClose={onClose}>
      <ErrorBanner message={error} />
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="group-name" className="mb-1.5 block text-sm font-medium text-slate-700">Group name</label>
          <input
            id="group-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={50}
            placeholder="e.g. Project team"
            className={inputClass}
            disabled={busy}
          />
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Members ({members.length})</span>
          {members.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {members.map((m) => (
                <span key={m._id} className="flex items-center gap-1 rounded-full bg-indigo-50 py-1 pl-3 pr-1.5 text-xs text-slate-800">
                  {m.name}
                  <button
                    type="button"
                    onClick={() => setMembers((list) => list.filter((x) => x._id !== m._id))}
                    aria-label={`Remove ${m.name}`}
                    className="rounded-full px-1 text-slate-500 hover:bg-slate-200 hover:text-slate-900"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
          <UserPicker
            label="Search members"
            excludeIds={members.map((m) => m._id)}
            onPick={(u) => setMembers((list) => [...list, u])}
          />
        </div>

        <SubmitButton loading={busy} loadingText="Creating...">Create group</SubmitButton>
      </form>
    </Modal>
  );
}