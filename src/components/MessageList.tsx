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

    const scrollToBottom = () => {
      element.scrollTop = element.scrollHeight;
    };

    scrollToBottom();
    const frame = window.requestAnimationFrame(scrollToBottom);
    const timeout = window.setTimeout(scrollToBottom, 80);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [messages, loading]);

  return (
    <div className="messages" aria-live="polite" ref={messagesRef}>
      {messages.map((message, index) => (
        <div className={getMessageClass(message.author)} key={index}>
          <div className={getBubbleClass(message.author, index)}>
            {message.image && (
              <img className="bubble-image" src={message.image.data} alt={message.image.name} />
            )}
            {message.text && <span>{message.text}</span>}
          </div>
        </div>
      ))}
      {loading && (
        <div className="message-row message-row--ai">
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
