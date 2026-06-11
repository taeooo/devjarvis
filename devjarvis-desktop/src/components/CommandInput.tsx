import { FormEvent, useState } from 'react';

type CommandInputProps = {
  disabled?: boolean;
  onSubmit: (text: string) => void;
};

export function CommandInput({ disabled = false, onSubmit }: CommandInputProps) {
  const [text, setText] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = text.trim();
    if (!normalized || disabled) {
      return;
    }

    onSubmit(normalized);
    setText('');
  }

  return (
    <form className="command-input-bar" onSubmit={handleSubmit} aria-label="Text command fallback">
      <span className="input-prompt" aria-hidden="true">›</span>
      <input
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="예: 이 화면 왜 그런거야? / 이 에러 원인 분석해줘"
        disabled={disabled}
        autoComplete="off"
      />
      <button type="submit" disabled={disabled || text.trim().length === 0}>
        전송
      </button>
    </form>
  );
}
