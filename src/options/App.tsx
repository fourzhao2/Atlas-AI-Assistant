import React, { useEffect, useState } from 'react';
import { storage } from '@/services/storage';
import { aiService } from '@/services/ai-service';
import type { AIProviderType, AIProviderConfig, UserPreference } from '@/types';

export const App: React.FC = () => {
  const [preferences, setPreferences] = useState<UserPreference>({
    defaultProvider: 'openai',
    theme: 'system',
    autoSummarize: false,
    agentMode: false,
    memoryEnabled: true,
  });

  const [providers, setProviders] = useState<Record<AIProviderType, AIProviderConfig | null>>({
    openai: null,
    anthropic: null,
    gemini: null,
  });

  const [editingProvider, setEditingProvider] = useState<AIProviderType | null>(null);
  const [tempConfig, setTempConfig] = useState<Partial<AIProviderConfig>>({});
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'providers' | 'advanced'>('general');

  useEffect(() => {
    const init = async () => {
      const prefs = await storage.getPreferences();
      setPreferences(prefs);

      const configs = await storage.getAllProviderConfigs();
      setProviders(configs);

      // Set theme
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      const activeTheme = prefs.theme === 'system' ? systemTheme : prefs.theme;
      document.documentElement.classList.toggle('dark', activeTheme === 'dark');
    };

    init();
  }, []);

  const handleSavePreferences = async () => {
    await storage.setPreferences(preferences);
    
    // Update theme
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const activeTheme = preferences.theme === 'system' ? systemTheme : preferences.theme;
    document.documentElement.classList.toggle('dark', activeTheme === 'dark');
    
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleEditProvider = (provider: AIProviderType) => {
    setEditingProvider(provider);
    setTempConfig(providers[provider] || {});
  };

  const handleSaveProvider = async () => {
    if (!editingProvider || !tempConfig.apiKey) return;

    const config: AIProviderConfig = {
      apiKey: tempConfig.apiKey,
      model: tempConfig.model,
      baseUrl: tempConfig.baseUrl,
    };

    await storage.setProviderConfig(editingProvider, config);
    await aiService.refreshProvider(editingProvider);

    setProviders({
      ...providers,
      [editingProvider]: config,
    });

    setEditingProvider(null);
    setTempConfig({});
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleDeleteProvider = async (provider: AIProviderType) => {
    if (confirm(`确定要删除 ${provider.toUpperCase()} 配置吗？`)) {
      await chrome.storage.local.remove([`provider_${provider}`]);
      await aiService.refreshProvider(provider);
      
      setProviders({
        ...providers,
        [provider]: null,
      });

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  const handleClearAllData = async () => {
    if (confirm('确定要清除所有数据吗？此操作不可恢复！')) {
      await storage.clearAllData();
      window.location.reload();
    }
  };

  const getProviderName = (provider: AIProviderType): string => {
    switch (provider) {
      case 'openai': return 'OpenAI GPT';
      case 'anthropic': return 'Anthropic Claude';
      case 'gemini': return 'Google Gemini';
    }
  };

  const getDefaultModel = (provider: AIProviderType): string => {
    switch (provider) {
      case 'openai': return 'gpt-4-turbo-preview';
      case 'anthropic': return 'claude-3-5-sonnet-20241022';
      case 'gemini': return 'gemini-pro';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-primary-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">
              A
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Atlas 设置
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            配置您的 AI 助手和偏好设置
          </p>
        </div>

        {saved && (
          <div className="mb-4 p-4 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100 rounded-lg animate-fade-in">
            ✅ 设置已保存
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('general')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'general'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            常规设置
          </button>
          <button
            onClick={() => setActiveTab('providers')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'providers'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            AI 提供商
          </button>
          <button
            onClick={() => setActiveTab('advanced')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'advanced'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            高级设置
          </button>
        </div>

        {/* General Settings */}
        {activeTab === 'general' && (
          <div className="space-y-6">
            <div className="card">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
                基本设置
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    默认 AI 提供商
                  </label>
                  <select
                    value={preferences.defaultProvider}
                    onChange={(e) => setPreferences({ ...preferences, defaultProvider: e.target.value as AIProviderType })}
                    className="input-field"
                  >
                    <option value="openai">OpenAI GPT</option>
                    <option value="anthropic">Anthropic Claude</option>
                    <option value="gemini">Google Gemini</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    主题
                  </label>
                  <select
                    value={preferences.theme}
                    onChange={(e) => setPreferences({ ...preferences, theme: e.target.value as 'light' | 'dark' | 'system' })}
                    className="input-field"
                  >
                    <option value="system">跟随系统</option>
                    <option value="light">浅色</option>
                    <option value="dark">深色</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="autoSummarize"
                    checked={preferences.autoSummarize}
                    onChange={(e) => setPreferences({ ...preferences, autoSummarize: e.target.checked })}
                    className="w-4 h-4 text-primary-600"
                  />
                  <label htmlFor="autoSummarize" className="text-sm text-gray-700 dark:text-gray-300">
                    自动总结新页面
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="memoryEnabled"
                    checked={preferences.memoryEnabled}
                    onChange={(e) => setPreferences({ ...preferences, memoryEnabled: e.target.checked })}
                    className="w-4 h-4 text-primary-600"
                  />
                  <label htmlFor="memoryEnabled" className="text-sm text-gray-700 dark:text-gray-300">
                    启用记忆系统
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="agentMode"
                    checked={preferences.agentMode}
                    onChange={(e) => setPreferences({ ...preferences, agentMode: e.target.checked })}
                    className="w-4 h-4 text-primary-600"
                  />
                  <label htmlFor="agentMode" className="text-sm text-gray-700 dark:text-gray-300">
                    启用代理模式（实验性功能）
                  </label>
                </div>

                <button onClick={handleSavePreferences} className="btn-primary">
                  保存设置
                </button>
              </div>
            </div>
          </div>
        )}

        {/* AI Providers */}
        {activeTab === 'providers' && (
          <div className="space-y-6">
            {(['openai', 'anthropic', 'gemini'] as AIProviderType[]).map((provider) => (
              <div key={provider} className="card">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    {getProviderName(provider)}
                  </h2>
                  {providers[provider] && (
                    <span className="text-sm text-green-600 dark:text-green-400">
                      ✓ 已配置
                    </span>
                  )}
                </div>

                {editingProvider === provider ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                        API Key *
                      </label>
                      <input
                        type="password"
                        value={tempConfig.apiKey || ''}
                        onChange={(e) => setTempConfig({ ...tempConfig, apiKey: e.target.value })}
                        placeholder="sk-..."
                        className="input-field"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                        模型（可选）
                      </label>
                      <input
                        type="text"
                        value={tempConfig.model || ''}
                        onChange={(e) => setTempConfig({ ...tempConfig, model: e.target.value })}
                        placeholder={getDefaultModel(provider)}
                        className="input-field"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        留空使用默认模型：{getDefaultModel(provider)}
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                        自定义 API 地址（可选）
                      </label>
                      <input
                        type="text"
                        value={tempConfig.baseUrl || ''}
                        onChange={(e) => setTempConfig({ ...tempConfig, baseUrl: e.target.value })}
                        placeholder={provider === 'openai' ? 'https://api.openai.com' : ''}
                        className="input-field"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        用于兼容 OpenAI API 的第三方服务（如 New API）
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button onClick={handleSaveProvider} className="btn-primary">
                        保存
                      </button>
                      <button
                        onClick={() => setEditingProvider(null)}
                        className="btn-secondary"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditProvider(provider)}
                      className="btn-primary"
                    >
                      {providers[provider] ? '编辑' : '配置'}
                    </button>
                    {providers[provider] && (
                      <button
                        onClick={() => handleDeleteProvider(provider)}
                        className="btn-secondary text-red-600 dark:text-red-400"
                      >
                        删除
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Advanced Settings */}
        {activeTab === 'advanced' && (
          <div className="space-y-6">
            <div className="card">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
                数据管理
              </h2>
              
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    清除所有数据包括：聊天历史、记忆、总结和洞察。
                  </p>
                  <button
                    onClick={handleClearAllData}
                    className="btn-secondary text-red-600 dark:text-red-400"
                  >
                    清除所有数据
                  </button>
                </div>
              </div>
            </div>

            <div className="card">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
                关于
              </h2>
              
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                <p><strong>版本:</strong> 1.0.0</p>
                <p><strong>描述:</strong> AI 驱动的浏览器助手</p>
                <p><strong>功能:</strong> 多 AI 支持、网页总结、智能代理、记忆系统</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

