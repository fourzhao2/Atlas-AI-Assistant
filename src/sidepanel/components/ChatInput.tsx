import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { ImageAttachment, ImageMediaType } from '@/types';

interface ChatInputProps {
  onSend: (message: string, images?: ImageAttachment[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

// 支持的图片类型
const SUPPORTED_IMAGE_TYPES: ImageMediaType[] = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_IMAGES = 5; // 最多5张图片

/**
 * 将 File 转换为 ImageAttachment
 */
async function fileToImageAttachment(file: File): Promise<ImageAttachment | null> {
  if (!SUPPORTED_IMAGE_TYPES.includes(file.type as ImageMediaType)) {
    console.warn('[ChatInput] 不支持的图片类型:', file.type);
    return null;
  }
  
  if (file.size > MAX_IMAGE_SIZE) {
    console.warn('[ChatInput] 图片太大:', file.size);
    return null;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      // 移除 data:image/xxx;base64, 前缀
      const base64Data = dataUrl.split(',')[1];
      
      // 获取图片尺寸
      const img = new Image();
      img.onload = () => {
        resolve({
          id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          data: base64Data,
          mediaType: file.type as ImageMediaType,
          name: file.name,
          size: file.size,
          width: img.width,
          height: img.height,
        });
      };
      img.onerror = () => {
        // 即使获取尺寸失败，也返回基本信息
        resolve({
          id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          data: base64Data,
          mediaType: file.type as ImageMediaType,
          name: file.name,
          size: file.size,
        });
      };
      img.src = dataUrl;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

export const ChatInput: React.FC<ChatInputProps> = ({ 
  onSend, 
  disabled = false,
  placeholder = '输入消息...'
}) => {
  const [input, setInput] = useState('');
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * 处理添加图片
   */
  const handleAddImages = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const remainingSlots = MAX_IMAGES - images.length;
    
    if (remainingSlots <= 0) {
      alert(`最多只能添加 ${MAX_IMAGES} 张图片`);
      return;
    }
    
    const filesToProcess = fileArray.slice(0, remainingSlots);
    const newImages: ImageAttachment[] = [];
    
    for (const file of filesToProcess) {
      const attachment = await fileToImageAttachment(file);
      if (attachment) {
        newImages.push(attachment);
      }
    }
    
    if (newImages.length > 0) {
      setImages(prev => [...prev, ...newImages]);
    }
    
    if (fileArray.length > remainingSlots) {
      alert(`只添加了 ${remainingSlots} 张图片，已达到上限 ${MAX_IMAGES} 张`);
    }
  }, [images.length]);

  /**
   * 移除图片
   */
  const handleRemoveImage = useCallback((id: string) => {
    setImages(prev => prev.filter(img => img.id !== id));
  }, []);

  /**
   * 处理粘贴事件 - 支持粘贴图片
   */
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const imageFiles: File[] = [];
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          imageFiles.push(file);
        }
      }
    }

    if (imageFiles.length > 0) {
      e.preventDefault(); // 阻止默认粘贴行为
      await handleAddImages(imageFiles);
    }
  }, [handleAddImages]);

  /**
   * 处理拖放
   */
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
      if (imageFiles.length > 0) {
        await handleAddImages(imageFiles);
      }
    }
  }, [handleAddImages]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedInput = input.trim();
    
    // 验证：至少有文本或图片
    if (!trimmedInput && images.length === 0) {
      return;
    }
    
    if (trimmedInput.length > 10000) {
      alert('消息太长了！请限制在10000字符以内。');
      return;
    }
    
    if (!disabled) {
      onSend(trimmedInput, images.length > 0 ? images : undefined);
      setInput('');
      setImages([]); // 清空图片
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [input]);

  const charCount = input.length;
  const isOverLimit = charCount > 10000;
  const hasContent = input.trim() || images.length > 0;
  
  return (
    <form 
      onSubmit={handleSubmit} 
      className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {/* 🖼️ 图片预览区域 */}
      {images.length > 0 && (
        <div className="px-4 pt-3 flex gap-2 flex-wrap">
          {images.map((img) => (
            <div 
              key={img.id} 
              className="relative group w-16 h-16 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700"
            >
              <img 
                src={`data:${img.mediaType};base64,${img.data}`}
                alt={img.name || '图片'}
                className="w-full h-full object-cover"
              />
              {/* 删除按钮 */}
              <button
                type="button"
                onClick={() => handleRemoveImage(img.id)}
                className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                title="移除图片"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              {/* 图片大小标签 */}
              {img.size && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[8px] text-center py-0.5">
                  {(img.size / 1024).toFixed(0)}KB
                </div>
              )}
            </div>
          ))}
          {/* 添加更多图片按钮 */}
          {images.length < MAX_IMAGES && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 flex items-center justify-center text-gray-400 hover:text-blue-500 transition-colors"
              title="添加更多图片"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          )}
        </div>
      )}

      <div className="flex gap-2 p-4">
        {/* 🖼️ 上传图片按钮 */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || images.length >= MAX_IMAGES}
          className="p-2 self-end text-gray-500 hover:text-blue-500 dark:text-gray-400 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title={images.length >= MAX_IMAGES ? `最多 ${MAX_IMAGES} 张图片` : '上传图片 (支持拖放/粘贴)'}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </button>
        
        {/* 隐藏的文件输入 */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) {
              handleAddImages(e.target.files);
              e.target.value = ''; // 重置以允许重复选择同一文件
            }
          }}
        />

        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={images.length > 0 ? '添加描述（可选）...' : placeholder}
            disabled={disabled}
            rows={1}
            className={`w-full resize-none input-field max-h-32 min-h-[42px] ${isOverLimit ? 'border-red-500 dark:border-red-400' : ''}`}
          />
          {charCount > 0 && (
            <div className={`absolute bottom-2 right-2 text-xs ${
              isOverLimit 
                ? 'text-red-600 dark:text-red-400 font-semibold' 
                : charCount > 8000
                  ? 'text-orange-600 dark:text-orange-400'
                  : 'text-gray-400 dark:text-gray-500'
            }`}>
              {charCount}/10000
            </div>
          )}
        </div>
        <button
          type="submit"
          disabled={disabled || !hasContent || isOverLimit}
          className="btn-primary px-6 self-end"
          title={isOverLimit ? '消息太长了' : '发送 (Enter)'}
        >
          发送
        </button>
      </div>
      <div className="px-4 pb-2 text-xs text-gray-500 dark:text-gray-400">
        提示: 按 Enter 发送，Shift + Enter 换行 {images.length > 0 && `| 已添加 ${images.length}/${MAX_IMAGES} 张图片`}
      </div>
    </form>
  );
};

