import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect') || '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('请填写邮箱和密码');
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      navigate(redirect, { replace: true });
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } };
        setError(axiosErr.response?.data?.message || '邮箱或密码错误');
      } else {
        setError('邮箱或密码错误');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-[400px] px-lg py-section">
      <h1 className="font-display text-display-md text-ink text-center">登录</h1>
      <p className="mt-sm text-center font-sans text-body-md text-muted">
        欢迎回到 PluginGen
      </p>

      <form onSubmit={handleSubmit} className="mt-xl space-y-md">
        {error && (
          <div className="rounded-md bg-error/10 px-md py-sm font-sans text-body-sm text-error">
            {error}
          </div>
        )}

        <div>
          <label
            htmlFor="email"
            className="mb-xs block font-sans text-body-sm text-ink"
          >
            邮箱
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="请输入邮箱"
            className="w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 font-sans text-body-md text-ink outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary/15"
            autoComplete="email"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-xs block font-sans text-body-sm text-ink"
          >
            密码
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              className="w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 pr-10 font-sans text-body-md text-ink outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary/15"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
              tabIndex={-1}
            >
              {showPassword ? '🙈' : '👁'}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-primary px-5 py-3 font-sans text-button text-on-primary transition-colors hover:bg-primary-active disabled:cursor-not-allowed disabled:bg-primary-disabled"
        >
          {loading ? '登录中...' : '登录'}
        </button>
      </form>

      <p className="mt-lg text-center font-sans text-body-sm text-muted">
        还没有账号？{' '}
        <Link
          to="/register"
          className="text-primary hover:text-primary-active underline"
        >
          立即注册
        </Link>
      </p>
    </div>
  );
}
