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
    console.log('[Popup] 点击打开侧边栏按钮');
    try {
      const response = await sendMessage({ type: 'OPEN_SIDEPANEL' });
      console.log('[Popup] 侧边栏打开响应:', response);
      
      if (response.success) {
        console.log('[Popup] ✅ 侧边栏打开成功');
        // 延迟一下再关闭 popup，让用户看到侧边栏打开
        setTimeout(() => {
          window.close();
        }, 200);
      } else {
        console.error('[Popup] ❌ 侧边栏打开失败:', response.error);
        alert('打开侧边栏失败: ' + (response.error || '未知错误'));
      }
    } catch (error) {
      console.error('[Popup] ❌ 打开侧边栏异常:', error);
      alert('打开侧边栏异常: ' + (error instanceof Error ? error.message : '未知错误'));
    }
  };

  const handleQuickAction = async (action: string) => {
    setLoading(true);
    
    // 先打开侧边栏
    const response = await sendMessage({ type: 'OPEN_SIDEPANEL' });
    
    if (response.success) {
      // 等待侧边栏完全打开
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // 发送操作消息
      chrome.runtime.sendMessage({
        type: 'TRIGGER_ACTION',
        payload: { action },
      });
      
      // 再稍等一下再关闭弹窗
      setTimeout(() => {
        window.close();
      }, 100);
    } else {
      setLoading(false);
      alert('打开侧边栏失败: ' + (response.error || '未知错误'));
    }
  };

  const handleSummarize = async () => {
    console.log('[Popup] 点击总结按钮');
    setLoading(true);
    
    try {
      // 先打开侧边栏
      const openResponse = await sendMessage({ type: 'OPEN_SIDEPANEL' });
      console.log('[Popup] 打开侧边栏响应:', openResponse);
      
      if (openResponse.success) {
        // 等待侧边栏加载完成
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // 发送总结消息
        console.log('[Popup] 发送 SHOW_PAGE_SUMMARY 消息');
        chrome.runtime.sendMessage({
          type: 'SHOW_PAGE_SUMMARY',
          payload: currentPage,
        });
        
        // 延迟关闭 popup
        setTimeout(() => {
          window.close();
        }, 200);
      } else {
        setLoading(false);
        alert('打开侧边栏失败: ' + (openResponse.error || '未知错误'));
      }
    } catch (error) {
      console.error('[Popup] 总结操作失败:', error);
      setLoading(false);
      alert('操作失败: ' + (error instanceof Error ? error.message : '未知错误'));
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

