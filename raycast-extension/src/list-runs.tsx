import { useEffect, useState } from 'react';
import { Action, ActionPanel, List, showToast, Toast, open } from '@raycast/api';
import fetch from 'node-fetch';

interface Conversation {
  id: string;
  title: string;
  isActive?: boolean;
  // ...any other fields
}

export default function Command() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchConversations() {
      try {
        const res = await fetch("http://127.0.0.1:3001/conversations");
        const json = await res.json();
        setConversations(json.conversations || []);
      } catch (error) {
        console.error(error);
        showToast({
          style: Toast.Style.Failure,
          title: "Failed to fetch conversations",
        });
      } finally {
        setLoading(false);
      }
    }
    fetchConversations();
  }, []);

  async function openConversation(conversationId: string) {
    const url = `wraperator://schedule?conversationId=${conversationId}`;

    showToast({
      style: Toast.Style.Success,
      title: "Scheduling task",
      message: "Opening Wraperator..."
    });

    // Open the URL which will be handled by the Electron app
    open(url);
  }

  return (
    <List isLoading={loading}>
      {conversations.map((conversation) => (
        <List.Item
          key={conversation.id}
          title={conversation.title || conversation.id}
          icon={{
            source: {
              light: conversation.isActive ? "icon_active_32.png" : conversation.isUnread ? "icon_unread@2x.png" : "icon_white.png",
              dark: conversation.isActive ? "icon_active_32.png" : conversation.isUnread ? "icon_unread@2x.png" : "icon_white.png",
            },
          }}
          accessories={[
            { icon: conversation.isActive ? { source: "🟢" } : { source: "" } },
            { text: conversation.last_message.content.parts[0].substring(0, 60) + "..." }
          ]}
          actions={
            <ActionPanel>
              <Action 
                title="Open in Operator"
                onAction={() => openConversation(conversation.id)}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}