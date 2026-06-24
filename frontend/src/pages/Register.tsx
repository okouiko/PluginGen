import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const validate = () => {
    const errors: Record<string, string> = {};

    if (!email) errors.email = '请输入邮箱';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errors.email = '邮箱格式不正确';

    if (!nickname) errors.nickname = '请输入昵称';
    else if (nickname.length < 2 || nickname.length > 20)
      errors.nickname = '昵称 2-20 个字符';

    if (!password) errors.password = '请输入密码';
    else if (password.length < 8) errors.password = '密码至少 8 位';
    else if (!/(?=.*[a-zA-Z])(?=.*\d)/.test(password))
      errors.password = '密码至少包含 1 个字母和 1 个数字';

    if (password !== confirmPassword)
      errors.confirmPassword = '两次密码不一致';

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validate()) return;

    setLoading(true);
    try {
      await register(email, password, nickname);
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as {
          response?: { data?: { message?: string; details?: string[] } };
        };
        const details = axiosErr.response?.data?.details;
        if (details && details.length > 0) {
          setFieldErrors({ server: details[0] });
        } else {
          setError(axiosErr.response?.data?.message || '注册失败');
        }
      } else {
        setError('注册失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-[400px] px-lg py-section">
      <h1 className="font-display text-display-md text-ink text-center">注册</h1>
      <p className="mt-sm text-center font-sans text-body-md text-muted">
        创建你的 PluginGen 账号
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
            onChange={(e) => {
              setEmail(e.target.value);
              setFieldErrors((prev) => ({ ...prev, email: '' }));
            }}
            placeholder="请输入邮箱"
            className={`w-full rounded-md border bg-canvas px-3.5 py-2.5 font-sans text-body-md text-ink outline-none transition-colors focus:ring-3 ${
              fieldErrors.email
                ? 'border-error focus:border-error focus:ring-error/15'
                : 'border-hairline focus:border-primary focus:ring-primary/15'
            }`}
            autoComplete="email"
          />
          {fieldErrors.email && (
            <p className="mt-1 font-sans text-caption text-error">
              {fieldErrors.email}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="nickname"
            className="mb-xs block font-sans text-body-sm text-ink"
          >
            昵称
          </label>
          <input
            id="nickname"
            type="text"
            value={nickname}
            onChange={(e) => {
              setNickname(e.target.value);
              setFieldErrors((prev) => ({ ...prev, nickname: '' }));
            }}
            placeholder="2-20 个字符"
            className={`w-full rounded-md border bg-canvas px-3.5 py-2.5 font-sans text-body-md text-ink outline-none transition-colors focus:ring-3 ${
              fieldErrors.nickname
                ? 'border-error focus:border-error focus:ring-error/15'
                : 'border-hairline focus:border-primary focus:ring-primary/15'
            }`}
            autoComplete="nickname"
          />
          {fieldErrors.nickname && (
            <p className="mt-1 font-sans text-caption text-error">
              {fieldErrors.nickname}
            </p>
          )}
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
              onChange={(e) => {
                setPassword(e.target.value);
                setFieldErrors((prev) => ({ ...prev, password: '' }));
              }}
              placeholder="至少 8 位，含字母和数字"
              className={`w-full rounded-md border bg-canvas px-3.5 py-2.5 pr-10 font-sans text-body-md text-ink outline-none transition-colors focus:ring-3 ${
                fieldErrors.password
                  ? 'border-error focus:border-error focus:ring-error/15'
                  : 'border-hairline focus:border-primary focus:ring-primary/15'
              }`}
              autoComplete="new-password"
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
          {fieldErrors.password && (
            <p className="mt-1 font-sans text-caption text-error">
              {fieldErrors.password}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="confirmPassword"
            className="mb-xs block font-sans text-body-sm text-ink"
          >
            确认密码
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setFieldErrors((prev) => ({ ...prev, confirmPassword: '' }));
            }}
            placeholder="再次输入密码"
            className={`w-full rounded-md border bg-canvas px-3.5 py-2.5 font-sans text-body-md text-ink outline-none transition-colors focus:ring-3 ${
              fieldErrors.confirmPassword
                ? 'border-error focus:border-error focus:ring-error/15'
                : 'border-hairline focus:border-primary focus:ring-primary/15'
            }`}
            autoComplete="new-password"
          />
          {fieldErrors.confirmPassword && (
            <p className="mt-1 font-sans text-caption text-error">
              {fieldErrors.confirmPassword}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-primary px-5 py-3 font-sans text-button text-on-primary transition-colors hover:bg-primary-active disabled:cursor-not-allowed disabled:bg-primary-disabled"
        >
          {loading ? '注册中...' : '注册'}
        </button>
      </form>

      <p className="mt-lg text-center font-sans text-body-sm text-muted">
        已有账号？{' '}
        <Link
          to="/login"
          className="text-primary hover:text-primary-active underline"
        >
          立即登录
        </Link>
      </p>
    </div>
  );
}
