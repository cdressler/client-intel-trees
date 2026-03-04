import { useCallback, useEffect, useState } from 'react';
import type { AIProvider } from '../types';
import { getDefaultProvider, setDefaultProvider } from '../api';
import ProviderSelector from './ProviderSelector';
import { useToast } from './Toast';

export default function SettingsPage() {
  const { showToast } = useToast();
  const [provider, setProvider] = useState<AIProvider>('claude');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDefaultProvider()
      .then(setProvider)
      .catch((err) => showToast(err instanceof Error ? err.message : 'Failed to load settings'))
      .finally(() => setLoading(false));
  }, [showToast]);

  const handleChange = useCallback(
    async (value: AIProvider) => {
      const prev = provider;
      setProvider(value);
      try {
        await setDefaultProvider(value);
      } catch (err) {
        setProvider(prev);
        showToast(err instanceof Error ? err.message : 'Failed to save setting');
      }
    },
    [provider, showToast],
  );

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Settings</h2>
      <div className="card bg-base-200 p-6">
        <h3 className="text-sm font-medium mb-3">Default AI Provider</h3>
        <ProviderSelector value={provider} onChange={handleChange} />
      </div>
    </div>
  );
}
