import { useEffect, useRef, useState } from 'react';
import EmojiPicker from './EmojiPicker';
import { formatSize } from '../utils/format';

const MAX = 2000;
const MAX_FILE = 5 * 1024 * 1024;
const ACCEPT = '.png,.jpg,.jpeg,.gif,.webp,.pdf,.txt,.csv,.zip,.docx,.xlsx,.pptx';

export default function MessageInput({
  onSend, onSendFile, onTypingStart, onTypingStop, onError, editing, onCancelEdit, onSaveEdit,
}) {
  const [text, setText] = useState('');
  const [staged, setStaged] = useState(null); // file waiting to be sent
  const [showEmoji, setShowEmoji] = useState(false);
  const areaRef = useRef(null);
  const fileRef = useRef(null);
  const typing = useRef(false);
  const timer = useRef(null);
  // keep latest callbacks so the unmount cleanup never uses stale ones
  const cbs = useRef({ onTypingStop });
  cbs.current = { onTypingStop };

  const stopTyping = () => {
    clearTimeout(timer.current);
    if (typing.current) {
      typing.current = false;
      cbs.current.onTypingStop();
    }
  };

  useEffect(() => () => stopTyping(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const resize = () => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  // entering edit mode loads the message into the box
  useEffect(() => {
    if (editing) {
      setText(editing.content);
      setStaged(null);
      stopTyping();
      requestAnimationFrame(() => {
        resize();
        areaRef.current?.focus();
      });
    }
  }, [editing]); // eslint-disable-line react-hooks/exhaustive-deps

  const onChange = (e) => {
    const value = e.target.value;
    setText(value);
    resize();
    if (editing) return;
    if (!value.trim()) return stopTyping();
    if (!typing.current) {
      typing.current = true;
      onTypingStart();
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(stopTyping, 1500);
  };

  const cancelEdit = () => {
    setText('');
    requestAnimationFrame(resize);
    onCancelEdit();
  };

  const submit = () => {
    const value = text.trim();
    if (editing) {
      if (!value) return;
      onSaveEdit(editing._id, value);
      setText('');
      requestAnimationFrame(resize);
      return;
    }
    if (staged) {
      stopTyping();
      onSendFile(staged, value);
      setStaged(null);
    } else if (value) {
      stopTyping();
      onSend(value);
    } else return;
    setText('');
    requestAnimationFrame(resize);
    areaRef.current?.focus();
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    } else if (e.key === 'Escape' && editing) {
      cancelEdit();
    }
  };

  const pickFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow picking the same file again
    if (!file) return;
    if (file.size > MAX_FILE) return onError('File too large (max 5 MB)');
    setStaged(file);
    areaRef.current?.focus();
  };

  const addEmoji = (emoji) => {
    const el = areaRef.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    const next = text.slice(0, start) + emoji + text.slice(end);
    if (next.length > MAX) return;
    setText(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + emoji.length, start + emoji.length);
      resize();
    });
  };

  const canSend = editing ? Boolean(text.trim()) : Boolean(text.trim() || staged);
  const iconBtn =
    'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-40';

  return (
    <div className="relative border-t border-slate-200 bg-surface">
      {editing && (
        <div className="flex items-center justify-between bg-indigo-50 px-4 py-1.5 text-xs text-slate-700">
          <span>✏️ Editing message</span>
          <button onClick={cancelEdit} className="font-medium text-accent hover:underline">Cancel</button>
        </div>
      )}
      {staged && (
        <div className="flex items-center justify-between gap-3 bg-slate-100 px-4 py-1.5 text-xs text-slate-700">
          <span className="truncate">📎 {staged.name} · {formatSize(staged.size)}</span>
          <button onClick={() => setStaged(null)} aria-label="Remove attachment" className="font-medium text-accent hover:underline">Remove</button>
        </div>
      )}
      {showEmoji && <EmojiPicker onPick={addEmoji} onClose={() => setShowEmoji(false)} />}

      <form
        onSubmit={(e) => { e.preventDefault(); submit(); }}
        className="flex items-end gap-1.5 p-3 sm:px-4"
      >
        <input ref={fileRef} type="file" accept={ACCEPT} onChange={pickFile} className="hidden" data-testid="file-input" />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={Boolean(editing)} aria-label="Attach file" title="Attach file" className={iconBtn}>
          📎
        </button>
        <button type="button" data-emoji-toggle onClick={() => setShowEmoji((v) => !v)} aria-label="Add emoji" title="Add emoji" className={iconBtn}>
          😊
        </button>
        <textarea
          ref={areaRef}
          value={text}
          onChange={onChange}
          onKeyDown={onKeyDown}
          rows={1}
          maxLength={MAX}
          placeholder={staged ? 'Add a caption...' : 'Type message...'}
          aria-label="Message"
          className="max-h-30 min-h-10 flex-1 resize-none rounded-2xl border border-slate-300 bg-surface px-4 py-2.5 text-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
        />
        <button
          type="submit"
          disabled={!canSend}
          className="h-10 rounded-full bg-indigo-600 px-5 text-sm font-medium text-white transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {editing ? 'Save' : 'Send'}
        </button>
      </form>
    </div>
  );
}