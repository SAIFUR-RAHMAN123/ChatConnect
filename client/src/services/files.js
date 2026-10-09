import api from './api';

// Attachments are only served to conversation members, so they are fetched with the JWT
// (an <img src> cannot send headers) and shown through a temporary blob URL.
const cache = new Map(); // messageId -> Promise<blobUrl>

export const getFileUrl = (messageId) => {
  if (!cache.has(messageId)) {
    cache.set(
      messageId,
      api
        .get(`/messages/${messageId}/file`, { responseType: 'blob' })
        .then((res) => URL.createObjectURL(res.data))
        .catch((err) => {
          cache.delete(messageId);
          throw err;
        })
    );
  }
  return cache.get(messageId);
};

export const downloadFile = async (message) => {
  const url = await getFileUrl(message._id);
  const a = document.createElement('a');
  a.href = url;
  a.download = message.attachment?.originalName || 'file';
  document.body.appendChild(a);
  a.click();
  a.remove();
};

export const clearFileCache = () => {
  cache.forEach((p) => p.then((url) => URL.revokeObjectURL(url)).catch(() => {}));
  cache.clear();
};