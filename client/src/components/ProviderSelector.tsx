import { useId } from 'react';
import type { AIProvider } from '../types';

interface Props {
  value: AIProvider;
  onChange: (provider: AIProvider) => void;
  disabled?: boolean;
  /** If provided, only these providers will be shown as options. */
  availableProviders?: AIProvider[];
}

export const PROVIDER_OPTIONS: { value: AIProvider; label: string }[] = [
  { value: 'claude', label: 'Claude' },
  { value: 'chatgpt', label: 'ChatGPT' },
  { value: 'gemini', label: 'Gemini' },
];

export function useProviderDefault(lastProvider: AIProvider | null): AIProvider {
  return lastProvider ?? 'claude';
}

export default function ProviderSelector({ value, onChange, disabled, availableProviders }: Props) {
  const id = useId();
  const selectId = `provider-selector-${id}`;
  const options = availableProviders
    ? PROVIDER_OPTIONS.filter((opt) => availableProviders.includes(opt.value))
    : PROVIDER_OPTIONS;

  return (
    <span className="inline-flex items-center gap-2">
      <label htmlFor={selectId} className="text-sm font-medium text-base-content/70 whitespace-nowrap">
        AI Provider:
      </label>
      <select
        id={selectId}
        value={value}
        onChange={(e) => onChange(e.target.value as AIProvider)}
        disabled={disabled}
        aria-disabled={disabled}
        className="select select-bordered select-sm"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </span>
  );
}
