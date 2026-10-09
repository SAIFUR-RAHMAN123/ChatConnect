import { useState } from 'react';
import ChatHeader from './ChatHeader';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import TypingIndicator from './TypingIndicator';
import Lightbox from './Lightbox';
import GroupInfoModal from './GroupInfoModal';

export default function ChatWindow({
  conversation, participant, members, messages, meId, loading, error, hasMore, loadingMore,
  typingNames, onLoadMore, onReload, onSend, onSendFile, onRetry, onTyping, onBack,
  onEditSave, onDelete, onReact, onError, onGroupChanged, onGroupLeft,
}) {
  const id = conversation._id;
  // the window is re-mounted per conversation (key), so this local state resets automatically
  const [editing, setEditing] = useState(null);
  const [image, setImage] = useState(null);
  const [showInfo, setShowInfo] = useState(false);

  const nameOf = (userId) => members.find((u) => u._id === userId)?.name || 'Former member';

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <ChatHeader
        conversation={conversation}
        participant={participant}
        members={members}
        meId={meId}
        onBack={onBack}
        onOpenInfo={() => setShowInfo(true)}
      />
      <MessageList
        conversationId={id}
        messages={messages}
        meId={meId}
        isGroup={conversation.isGroup}
        nameOf={nameOf}
        loading={loading}
        error={error}
        hasMore={hasMore}
        loadingMore={loadingMore}
        onLoadMore={onLoadMore}
        onRetry={(m) => (m && m.tempId ? onRetry(m) : onReload())}
        onReact={onReact}
        onEdit={setEditing}
        onDelete={onDelete}
        onOpenImage={setImage}
      />
      <div className="bg-slate-50">{typingNames.length > 0 && <TypingIndicator names={typingNames} />}</div>
      <MessageInput
        onSend={onSend}
        onSendFile={onSendFile}
        onError={onError}
        editing={editing}
        onCancelEdit={() => setEditing(null)}
        onSaveEdit={async (messageId, text) => {
          if (await onEditSave(messageId, text, editing)) setEditing(null);
        }}
        onTypingStart={() => onTyping('typing:start', id)}
        onTypingStop={() => onTyping('typing:stop', id)}
      />

      {image && <Lightbox message={image} onClose={() => setImage(null)} />}
      {showInfo && (
        <GroupInfoModal
          conversation={conversation}
          members={members}
          meId={meId}
          onClose={() => setShowInfo(false)}
          onChanged={onGroupChanged}
          onLeft={onGroupLeft}
        />
      )}
    </div>
  );
}