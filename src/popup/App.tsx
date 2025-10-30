import React, { useEffect, useState } from 'react';
import { storage } from '@/services/storage';
import { getPageContent, sendMessage } from '@/utils/messaging';
import type { UserPreference, PageContent } from '@/types';

export const App: React.FC = () => {
  const [preferences, setPreferences] = useState<UserPreference | null>(null);
  const [currentPage, setCurrentPage] = useState<PageContent | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const init = async () => {
      const prefs = await storage.getPreferences();
      setPreferences(prefs);
      
      // Set theme
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      const activeTheme = prefs.theme === 'system' ? systemTheme : prefs.theme;
      document.documentElement.classList.toggle('dark', activeTheme === 'dark');
      
      // Get current page
      const response = await getPageContent();
      if (response.success && response.data) {
        setCurrentPage(response.data as PageContent);
      }
    };

    init();
  }, []);

  const handleOpenSidePanel = async () => {
    await sendMessage({ type: 'OPEN_SIDEPANEL' });
    window.close();
  };

  const handleQuickAction = async (action: string) => {
    setLoading(true);
    await sendMessage({ type: 'OPEN_SIDEPANEL' });
    
    // Send action to side panel
    setTimeout(() => {
      chrome.runtime.sendMessage({
        type: 'TRIGGER_ACTION',
        payload: { action },
      });
      window.close();
    }, 100);
  };

  const handleSummarize = async () => {
    if (!currentPage) return;
    
    setLoading(true);
    const response = await sendMessage({
      type: 'SUMMARIZE_PAGE',
      payload: currentPage,
    });
    
    setLoading(false);
    
    if (response.success) {
      // Open side panel to show summary
      await handleOpenSidePanel();
    } else {
      alert(`总结失败: ${response.error}`);
    }
  };

  const handleOpenSettings = () => {
    chrome.runtime.openOptionsPage();
    window.close();
  };

  if (!preferences) {
    return (
      <div className="w-80 h-96 flex items-center justify-center">
        <div className="animate-pulse-slow">加载中...</div>
      </div>
    );
  }

  return (
    <div className="w-80 h-auto bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center text-white font-bold">
            A
          </div>
          <h1 className="text-lg font-semibold">Atlas AI</h1>
        </div>
        {currentPage && (
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {currentPage.title}
          </p>
        )}
      </div>

      {/* Quick Actions */}
      <div className="p-4 space-y-2">
        <button
          onClick={handleOpenSidePanel}
          disabled={loading}
          className="w-full btn-primary text-left flex items-center gap-2"
        >
          <span>💬</span>
          <span>打开 AI 助手</span>
        </button>

        <button
          onClick={handleSummarize}
          disabled={loading || !currentPage}
          className="w-full btn-secondary text-left flex items-center gap-2"
        >
          <span>📝</span>
          <span>总结此页面</span>
        </button>

        <button
          onClick={() => handleQuickAction('translate')}
          disabled={loading}
          className="w-full btn-secondary text-left flex items-center gap-2"
        >
          <span>🌐</span>
          <span>翻译内容</span>
        </button>

        <button
          onClick={() => handleQuickAction('explain')}
          disabled={loading}
          className="w-full btn-secondary text-left flex items-center gap-2"
        >
          <span>💡</span>
          <span>解释说明</span>
        </button>
      </div>

      {/* Settings */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          当前 AI: {preferences.defaultProvider.toUpperCase()}
        </div>
        <button
          onClick={handleOpenSettings}
          className="w-full btn-secondary text-sm"
        >
          ⚙️ 设置
        </button>
      </div>

      {loading && (
        <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-pulse-slow mb-2">处理中...</div>
          </div>
        </div>
      )}
    </div>
  );
};

