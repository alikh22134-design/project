import { useEffect, useRef } from 'react';
import { ChatLine } from '../lib/characterAi';

type MessageListProps = {
  messages: ChatLine[];
  loading: boolean;
};

export default function MessageList({ messages, loading }: MessageListProps) {
  const messagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = messagesRef.current;
    if (!element) return;

    element.scrollTop = element.scrollHeight;
  }, [messages, loading]);

  return (
    <div className="messages" aria-live="polite" ref={messagesRef}>
      {messages.map((message, index) => (
        <div className={getMessageClass(message.author)} key={index}>
          {message.author === 'ai' && <span className="chat-avatar" />}
          <div className={getBubbleClass(message.author, index)}>
            {message.text}
          </div>
        </div>
      ))}
      {loading && (
        <div className="message-row message-row--ai">
          <span className="chat-avatar chat-avatar--thinking" />
          <div className="bubble bubble--ai">Думаю...</div>
        </div>
      )}
    </div>
  );
}

function getMessageClass(author: ChatLine['author']) {
  return `message-row message-row--${author}`;
}

function getBubbleClass(author: ChatLine['author'], index: number) {
  if (author !== 'ai') return `bubble bubble--${author}`;

  const variant = (index % 3) + 1;
  return `bubble bubble--ai bubble--ai-${variant}`;
}
