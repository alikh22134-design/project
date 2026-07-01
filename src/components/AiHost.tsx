import { useState } from 'react';

type AiHostProps = {
  thinking: boolean;
  text: string;
};

export default function AiHost({ thinking, text }: AiHostProps) {
  const [excited, setExcited] = useState(false);
  const isSpeaking = !thinking && text.length > 0;

  function reactToClick() {
    setExcited(false);
    window.setTimeout(() => setExcited(true), 0);
    window.setTimeout(() => setExcited(false), 900);
  }

  return (
    <div className="ai-host-row">
      <button
        aria-label="AI угадыватель"
        className={`ai-host${thinking ? ' ai-host--thinking' : ''}${isSpeaking ? ' ai-host--speaking' : ''}${excited ? ' ai-host--excited' : ''}`}
        onClick={reactToClick}
        type="button"
      >
        <div className="ai-host__aura" />
        <div className="ai-host__head">
          <div className="ai-host__wrap" />
          <div className="ai-host__gem" />
          <div className="ai-host__face">
            <span className="ai-host__eye" />
            <span className="ai-host__eye" />
            <span className="ai-host__smile" />
          </div>
        </div>
        <div className="ai-host__shoulders" />
        <div className="ai-host__spark ai-host__spark--one" />
        <div className="ai-host__spark ai-host__spark--two" />
        <div className="ai-host__spark ai-host__spark--three" />
      </button>
      <p className="ai-host-speech" key={thinking ? 'thinking' : text}>
        {thinking ? 'Думаю...' : text}
      </p>
    </div>
  );
}
