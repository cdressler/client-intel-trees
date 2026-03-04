import type { AIProvider } from '../types';
import { providerDisplayName } from './ResearchSection';

const AVAILABLE_PROVIDERS: AIProvider[] = ['claude', 'chatgpt', 'gemini'];

export interface MultiProviderSelectorProps {
  selectedProviders: AIProvider[];
  onChange: (providers: AIProvider[]) => void;
  disabled?: boolean;
}

export function toggleProvider(
  current: AIProvider[],
  provider: AIProvider,
  checked: boolean,
): AIProvider[] {
  if (checked) {
    return current.includes(provider) ? current : [...current, provider];
  }
  return current.filter((p) => p !== provider);
}

export function getAvailableProviders(): AIProvider[] {
  return AVAILABLE_PROVIDERS;
}

export default function MultiProviderSelector({
  selectedProviders,
  onChange,
  disabled = false,
}: MultiProviderSelectorProps) {
  const handleToggle = (provider: AIProvider, checked: boolean) => {
    onChange(toggleProvider(selectedProviders, provider, checked));
  };

  return (
    <div className="flex items-center gap-4 flex-wrap" role="group" aria-label="Select AI providers">
      {AVAILABLE_PROVIDERS.map((p) => (
        <label key={p} className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="checkbox checkbox-sm checkbox-primary"
            checked={selectedProviders.includes(p)}
            onChange={(e) => handleToggle(p, e.target.checked)}
            disabled={disabled}
            aria-label={providerDisplayName(p)}
          />
          <span className="text-sm">{providerDisplayName(p)}</span>
        </label>
      ))}
    </div>
  );
}
