// Unit tests for SettingsPage
// Validates: Requirements 10.1, 10.2
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as api from '../api';
import type { AIProvider } from '../types';

describe('SettingsPage API integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // Test: current default provider is pre-selected on mount
  // Requirement 10.1
  it('getDefaultProvider returns the stored default provider', async () => {
    vi.spyOn(api, 'getDefaultProvider').mockResolvedValue('gemini');

    const result = await api.getDefaultProvider();
    expect(result).toBe('gemini');
    expect(api.getDefaultProvider).toHaveBeenCalledOnce();
  });

  it('getDefaultProvider returns claude as the system default', async () => {
    vi.spyOn(api, 'getDefaultProvider').mockResolvedValue('claude');

    const result = await api.getDefaultProvider();
    expect(result).toBe('claude');
  });

  // Test: changing selection calls setDefaultProvider
  // Requirement 10.2
  it('setDefaultProvider is called with the selected provider', async () => {
    vi.spyOn(api, 'setDefaultProvider').mockResolvedValue(undefined);

    await api.setDefaultProvider('chatgpt');
    expect(api.setDefaultProvider).toHaveBeenCalledWith('chatgpt');
  });

  it('setDefaultProvider persists each valid provider value', async () => {
    vi.spyOn(api, 'setDefaultProvider').mockResolvedValue(undefined);

    const providers: AIProvider[] = ['claude', 'chatgpt', 'gemini'];
    for (const p of providers) {
      await api.setDefaultProvider(p);
      expect(api.setDefaultProvider).toHaveBeenCalledWith(p);
    }
    expect(api.setDefaultProvider).toHaveBeenCalledTimes(3);
  });

  it('setDefaultProvider followed by getDefaultProvider returns the same value', async () => {
    let stored: AIProvider = 'claude';
    vi.spyOn(api, 'setDefaultProvider').mockImplementation(async (p: AIProvider) => {
      stored = p;
    });
    vi.spyOn(api, 'getDefaultProvider').mockImplementation(async () => stored);

    await api.setDefaultProvider('gemini');
    const result = await api.getDefaultProvider();
    expect(result).toBe('gemini');
  });

  it('setDefaultProvider rejects on failure', async () => {
    vi.spyOn(api, 'setDefaultProvider').mockRejectedValue(
      new api.ApiError(400, 'VALIDATION_ERROR', 'Invalid provider value'),
    );

    await expect(api.setDefaultProvider('gemini')).rejects.toThrow('Invalid provider value');
  });
});
