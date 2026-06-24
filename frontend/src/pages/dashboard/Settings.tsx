import { useState } from 'react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import type { ApiResponse } from '@/types/api';

const API_KEY_STORAGE_KEY = 'plugingen_deepseek_api_key';

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [apiKey, setApiKey] = useState(() => {
    try {
      return localStorage.getItem(API_KEY_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });
  const [nickname, setNickname] = useState(user?.nickname || '');
  const [bio, setBio] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const handleSaveKey = async () => {
    setSavingKey(true);
    try {
      localStorage.setItem(API_KEY_STORAGE_KEY, apiKey);
      toast.success('API Key 已保存');
    } catch {
      toast.error('保存失败');
    } finally {
      setSavingKey(false);
    }
  };

  const handleClearKey = () => {
    setApiKey('');
    localStorage.removeItem(API_KEY_STORAGE_KEY);
    toast.success('API Key 已清除');
  };

  const handleSaveProfile = async () => {
    if (!nickname.trim()) {
      toast.error('昵称不能为空');
      return;
    }
    setSavingProfile(true);
    try {
      const res = await apiClient.patch<ApiResponse<{ id: string; nickname: string; bio: string | null }>>(
        '/user/profile',
        { nickname: nickname.trim(), bio: bio.trim() || undefined },
      );
      const updated = res.data.data;
      if (user) {
        setUser({ ...user, nickname: updated.nickname });
      }
      toast.success('个人资料已更新');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      toast.error(axiosErr?.response?.data?.message || '保存失败');
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="mx-auto max-w-[600px] px-lg py-section">
      <h1 className="font-display text-display-sm text-ink">设置</h1>
      <p className="mt-sm font-sans text-body-md text-muted">
        管理你的账户和 API 配置
      </p>

      <div className="mt-xl space-y-lg">
        {/* Profile Section */}
        <div className="rounded-lg border border-hairline bg-surface-card p-xl">
          <h2 className="font-sans text-title-md text-ink">个人资料</h2>
          <p className="mt-sm font-sans text-body-sm text-muted">
            修改你的昵称和个人简介
          </p>

          <div className="mt-md space-y-md">
            <div>
              <label className="mb-xs block font-sans text-body-sm text-ink">
                邮箱
              </label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full rounded-md border border-hairline bg-surface-soft px-3.5 py-2.5 font-sans text-body-md text-muted outline-none"
              />
            </div>

            <div>
              <label className="mb-xs block font-sans text-body-sm text-ink">
                昵称
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="2-20 个字符"
                maxLength={20}
                className="w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 font-sans text-body-md text-ink outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary/15"
              />
            </div>

            <div>
              <label className="mb-xs block font-sans text-body-sm text-ink">
                个人简介
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="介绍一下自己…"
                rows={3}
                maxLength={200}
                className="w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 font-sans text-body-md text-ink outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary/15"
              />
              <p className="mt-1 font-sans text-caption text-muted-soft">{bio.length}/200</p>
            </div>
          </div>

          <div className="mt-md">
            <button
              onClick={handleSaveProfile}
              disabled={savingProfile}
              className="rounded-md bg-primary px-5 py-2.5 font-sans text-button text-on-primary transition-colors hover:bg-primary-active disabled:bg-primary-disabled"
            >
              {savingProfile ? '保存中…' : '保存资料'}
            </button>
          </div>
        </div>

        {/* API Key Section */}
        <div className="rounded-lg border border-hairline bg-surface-card p-xl">
          <h2 className="font-sans text-title-md text-ink">DeepSeek API Key</h2>
          <p className="mt-sm font-sans text-body-sm text-muted">
            配置你的 DeepSeek API Key 用于 AI 生成插件。如果不配置，将使用系统默认 Key。
          </p>

          <div className="mt-md">
            <label className="mb-xs block font-sans text-body-sm text-ink">
              API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 font-sans text-body-md text-ink outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary/15 font-mono"
            />
          </div>

          <div className="mt-md flex gap-sm">
            <button
              onClick={handleSaveKey}
              disabled={savingKey}
              className="rounded-md bg-primary px-5 py-2.5 font-sans text-button text-on-primary transition-colors hover:bg-primary-active disabled:bg-primary-disabled"
            >
              {savingKey ? '保存中…' : '保存'}
            </button>
            <button
              onClick={handleClearKey}
              className="rounded-md border border-hairline bg-canvas px-5 py-2.5 font-sans text-button text-ink transition-colors hover:bg-surface-soft"
            >
              清除
            </button>
          </div>
        </div>

        {/* Info Section */}
        <div className="rounded-lg border border-hairline bg-surface-card p-xl">
          <h2 className="font-sans text-title-md text-ink">账户信息</h2>
          <p className="mt-sm font-sans text-body-sm text-muted">
            API Key 仅存储在浏览器本地，不会上传到服务器。
            生成插件时会使用此 Key 调用 DeepSeek API。
          </p>
          <div className="mt-md rounded-md bg-surface-soft px-md py-sm">
            <p className="font-sans text-body-sm text-muted">
              💡 获取 API Key: <a href="https://platform.deepseek.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary-active underline">platform.deepseek.com</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
