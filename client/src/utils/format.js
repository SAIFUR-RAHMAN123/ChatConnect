export const formatTime = (date) =>
  new Date(date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const dayDiff = (date) => Math.round((startOfDay(new Date()) - startOfDay(new Date(date))) / 86400000);

// "Today" / "Yesterday" / "Mon, Oct 5"
export const formatDay = (date) => {
  const diff = dayDiff(date);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return new Date(date).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
};

// compact time for the conversation list
export const formatListTime = (date) => {
  const diff = dayDiff(date);
  if (diff === 0) return formatTime(date);
  if (diff === 1) return 'Yesterday';
  return new Date(date).toLocaleDateString([], { month: 'short', day: 'numeric' });
};

export const formatLastSeen = (date) => {
  if (!date) return 'Offline';
  const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (mins < 1) return 'Last seen just now';
  if (mins < 60) return `Last seen ${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Last seen ${hrs} hr${hrs > 1 ? 's' : ''} ago`;
  return `Last seen ${formatDay(date).toLowerCase()} at ${formatTime(date)}`;
};

export const formatSize = (bytes = 0) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

// One-line preview of a message for the conversation list
export const previewText = (msg, meId, nameOf, isGroup) => {
  if (!msg) return 'No messages yet';
  let body;
  if (msg.deleted) body = 'This message was deleted';
  else if (msg.type === 'image') body = msg.content ? `📷 ${msg.content}` : '📷 Photo';
  else if (msg.type === 'file') body = `📎 ${msg.attachment?.originalName || 'File'}`;
  else body = msg.content;
  if (msg.sender === meId) return `You: ${body}`;
  return isGroup ? `${nameOf(msg.sender)}: ${body}` : body;
};

export const initials = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('') || '?';