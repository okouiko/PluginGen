import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth-store';
import { useNotificationStore } from '@/stores/notification-store';
import { QuotaDisplay } from '@/components/user/QuotaDisplay';

export function TopNav() {
  const { token, user } = useAuthStore();
  const isAuthenticated = !!token;
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === '/';


  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    useAuthStore.getState().logout();
    setDropdownOpen(false);
    navigate('/');
  };

  return (
    <nav className="flex h-16 items-center justify-between bg-canvas px-lg">
      <div className="flex items-center gap-md">
        <Link
          to="/"
          className="font-display text-title-md font-medium text-ink no-underline"
        >
          PluginGen
        </Link>
        {isHome && (
          <div className="hidden gap-sm lg:flex">
            <a
              href="#features"
              className="rounded-md px-md py-sm font-sans text-nav-link text-muted transition-colors hover:text-ink"
            >
              功能介绍
            </a>
            <a
              href="#code-demo"
              className="rounded-md px-md py-sm font-sans text-nav-link text-muted transition-colors hover:text-ink"
            >
              代码展示
            </a>
          </div>
        )}
      </div>

      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className="rounded-md p-sm text-ink hover:bg-surface-soft lg:hidden"
      >
        {mobileMenuOpen ? '✕' : '☰'}
      </button>

      {/* Desktop nav */}
      <div className="hidden items-center gap-sm lg:flex">
        <Link
          to="/workspace"
          className="rounded-md px-md py-sm font-sans text-nav-link text-muted transition-colors hover:text-ink"
        >
          作品广场
        </Link>
        {isAuthenticated && user ? (
          <>
            <Link
              to="/messages"
              className="relative rounded-md p-sm text-muted transition-colors hover:text-ink"
            >
              <NotificationBell />
            </Link>
            <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 rounded-md px-md py-sm transition-colors hover:bg-surface-soft"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-caption text-on-primary">
                {user.nickname.charAt(0).toUpperCase()}
              </div>
              <div className="text-left">
                <div className="font-sans text-nav-link text-ink">
                  {user.nickname}
                </div>
                <div className="flex items-center gap-1 font-sans text-caption text-muted">
                  Lv.{user.level} <QuotaDisplay />
                </div>
              </div>
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 top-full z-50 mt-xs w-44 rounded-lg border border-hairline bg-canvas py-xs shadow-lg">
                <Link
                  to="/dashboard"
                  onClick={() => setDropdownOpen(false)}
                  className="block px-md py-sm font-sans text-body-sm text-ink transition-colors hover:bg-surface-soft"
                >
                  工作台
                </Link>
                <Link
                  to="/daily"
                  onClick={() => setDropdownOpen(false)}
                  className="block px-md py-sm font-sans text-body-sm text-ink transition-colors hover:bg-surface-soft"
                >
                  每日签到
                </Link>
                {user?.id && (
                  <Link
                    to={`/user/${user.id}`}
                    onClick={() => setDropdownOpen(false)}
                    className="block px-md py-sm font-sans text-body-sm text-ink transition-colors hover:bg-surface-soft"
                  >
                    个人主页
                  </Link>
                )}
                <Link
                  to="/dashboard/settings"
                  onClick={() => setDropdownOpen(false)}
                  className="block px-md py-sm font-sans text-body-sm text-ink transition-colors hover:bg-surface-soft"
                >
                  设置
                </Link>
                <div className="my-xs border-t border-hairline" />
                <button
                  onClick={handleLogout}
                  className="block w-full px-md py-sm text-left font-sans text-body-sm text-error transition-colors hover:bg-surface-soft"
                >
                  登出
                </button>
              </div>
            )}
          </div>
          </>
        ) : (
          <>
            <Link
              to="/login"
              className="rounded-md px-md py-sm font-sans text-nav-link text-muted transition-colors hover:text-ink"
            >
              登录
            </Link>
            <Link
              to="/register"
              className="rounded-md bg-primary px-5 py-3 font-sans text-button text-on-primary transition-colors hover:bg-primary-active"
            >
              注册
            </Link>
          </>
        )}
      </div>

      {/* Mobile menu sheet */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 top-16 z-40 bg-canvas lg:hidden">
          <nav className="flex flex-col gap-sm px-lg py-md">
            {isAuthenticated && user ? (
              <>
                <div className="mb-md flex items-center gap-2 rounded-md bg-surface-soft px-md py-sm">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-caption text-on-primary">
                    {user.nickname.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-sans text-body-sm text-ink">
                      {user.nickname}
                    </div>
                    <div className="font-sans text-caption text-muted">
                      Lv.{user.level} 剩余 {user.dailyQuota}/20
                    </div>
                  </div>
                </div>
                <Link
                  to="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-md px-md py-sm font-sans text-body-md text-ink transition-colors hover:bg-surface-soft"
                >
                  工作台
                </Link>
                <Link
                  to="/daily"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-md px-md py-sm font-sans text-body-md text-ink transition-colors hover:bg-surface-soft"
                >
                  每日签到
                </Link>
                <Link
                  to="/dashboard/create"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-md px-md py-sm font-sans text-body-md text-ink transition-colors hover:bg-surface-soft"
                >
                  创建插件
                </Link>
                <Link
                  to="/dashboard/plugins"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-md px-md py-sm font-sans text-body-md text-ink transition-colors hover:bg-surface-soft"
                >
                  我的插件
                </Link>
                <Link
                  to="/workspace"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-md px-md py-sm font-sans text-body-md text-ink transition-colors hover:bg-surface-soft"
                >
                  作品广场
                </Link>
                {user?.id && (
                  <Link
                    to={`/user/${user.id}`}
                    onClick={() => setMobileMenuOpen(false)}
                    className="rounded-md px-md py-sm font-sans text-body-md text-ink transition-colors hover:bg-surface-soft"
                  >
                    个人主页
                  </Link>
                )}
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="mt-md rounded-md bg-error px-md py-sm text-left font-sans text-body-md text-on-primary"
                >
                  登出
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-md px-md py-sm font-sans text-body-md text-ink transition-colors hover:bg-surface-soft"
                >
                  登录
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="mt-sm rounded-md bg-primary px-5 py-3 text-center font-sans text-button text-on-primary"
                >
                  注册
                </Link>
              </>
            )}
            <div className="my-md border-t border-hairline" />
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-md px-md py-sm font-sans text-body-md text-muted transition-colors hover:bg-surface-soft"
            >
              功能介绍
            </a>
            <a
              href="#code-demo"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-md px-md py-sm font-sans text-body-md text-muted transition-colors hover:bg-surface-soft"
            >
              代码展示
            </a>
          </nav>
        </div>
      )}
    </nav>
  );
}

function NotificationBell() {
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  return (
    <span className="relative inline-flex">
      <span role="img" aria-label="通知">🔔</span>
      {unreadCount > 0 && (
        <span className="absolute -right-2 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-error px-1 font-sans text-caption text-on-primary">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </span>
  );
}
