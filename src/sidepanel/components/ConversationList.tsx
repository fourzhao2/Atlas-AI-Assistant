import type { Conversation } from '@/types';
import { ConversationItem } from './ConversationItem';

interface ConversationListProps {
  conversations: Conversation[];
  currentConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, title: string) => void;
}

export const ConversationList = ({ 
  conversations, 
  currentConversationId, 
  onSelectConversation,
  onDeleteConversation,
  onRenameConversation 
}: ConversationListProps) => {
  // Group conversations by time
  const groupConversations = () => {
    const now = Date.now();
    const oneDayAgo = now - 86400000;
    const oneWeekAgo = now - 604800000;

    const today: Conversation[] = [];
    const yesterday: Conversation[] = [];
    const earlier: Conversation[] = [];

    // Sort by updatedAt desc
    const sorted = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);

    sorted.forEach(conv => {
      if (conv.updatedAt > oneDayAgo) {
        today.push(conv);
      } else if (conv.updatedAt > oneWeekAgo) {
        yesterday.push(conv);
      } else {
        earlier.push(conv);
      }
    });

    return { today, yesterday, earlier };
  };

  const { today, yesterday, earlier } = groupConversations();

  const renderGroup = (title: string, convs: Conversation[]) => {
    if (convs.length === 0) return null;

    return (
      <div className="mb-4">
        <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          {title}
        </div>
        <div className="space-y-1">
          {convs.map(conv => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              isActive={conv.id === currentConversationId}
              onClick={() => onSelectConversation(conv.id)}
              onDelete={() => onDeleteConversation(conv.id)}
              onRename={(title) => onRenameConversation(conv.id, title)}
            />
          ))}
        </div>
      </div>
    );
  };

  if (conversations.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400 text-sm">
        暂无对话
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full">
      {renderGroup('今天', today)}
      {renderGroup('最近7天', yesterday)}
      {renderGroup('更早', earlier)}
    </div>
  );
};

