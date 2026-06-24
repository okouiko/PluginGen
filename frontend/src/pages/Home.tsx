import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth-store';

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg bg-surface-card p-xl">
      <div className="mb-md text-2xl">{icon}</div>
      <h3 className="font-sans text-title-md text-ink mb-sm">{title}</h3>
      <p className="font-sans text-body-md text-body">{description}</p>
    </div>
  );
}

function CodeWindowCard({ code, filename }: { code: string; filename: string }) {
  return (
    <div className="rounded-lg bg-surface-dark p-lg font-mono text-code text-on-dark">
      <div className="mb-md flex items-center gap-xs">
        <div className="h-3 w-3 rounded-full bg-error" />
        <div className="h-3 w-3 rounded-full bg-warning" />
        <div className="h-3 w-3 rounded-full bg-success" />
        <span className="ml-sm font-sans text-caption text-on-dark-soft">
          {filename}
        </span>
      </div>
      <pre className="overflow-x-auto">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const unsub = useAuthStore.subscribe((state) => {
      setIsAuthenticated(!!state.token);
    });
    setIsAuthenticated(!!useAuthStore.getState().token);
    return unsub;
  }, []);

  const handleGetStarted = () => {
    navigate(isAuthenticated ? '/dashboard' : '/register');
  };

  return (
    <div>
      {/* Mobile hamburger menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 bg-canvas lg:hidden">
          <div className="flex items-center justify-between px-lg py-4">
            <span className="font-display text-title-md text-ink">PluginGen</span>
            <button
              onClick={() => setMenuOpen(false)}
              className="rounded-md p-sm text-ink hover:bg-surface-soft"
            >
              ✕
            </button>
          </div>
          <nav className="flex flex-col gap-sm px-lg">
            <a
              href="#features"
              onClick={() => setMenuOpen(false)}
              className="rounded-md px-md py-sm font-sans text-body-md text-ink transition-colors hover:bg-surface-soft"
            >
              功能介绍
            </a>
            <a
              href="#code-demo"
              onClick={() => setMenuOpen(false)}
              className="rounded-md px-md py-sm font-sans text-body-md text-ink transition-colors hover:bg-surface-soft"
            >
              代码展示
            </a>
            <Link
              to={isAuthenticated ? '/dashboard' : '/login'}
              onClick={() => setMenuOpen(false)}
              className="mt-md rounded-md bg-primary px-5 py-3 text-center font-sans text-button text-on-primary"
            >
              {isAuthenticated ? '工作台' : '登录'}
            </Link>
          </nav>
        </div>
      )}

      {/* Section 1: Hero */}
      <section className="bg-canvas py-section">
        <div className="mx-auto grid max-w-[1200px] items-center gap-xl px-md grid-cols-1 lg:grid-cols-2">
          <div>
            <h1 className="font-display text-display-md lg:text-display-xl text-ink mb-lg leading-[1.05] tracking-[-1.5px]">
              用 AI 创建你的
              <br />
              Minecraft 插件
            </h1>
            <p className="font-sans text-body-md text-body mb-xl" style={{ maxWidth: 512, writingMode: 'horizontal-tb' }}>
              无需配置 Java/Maven/IDE，在浏览器中完成从「我有一个想法」到「一个可运行的插件」的全过程。
            </p>
            <div className="flex gap-md">
              <button
                onClick={handleGetStarted}
                className="rounded-md bg-primary px-5 py-3 font-sans text-button text-on-primary transition-colors hover:bg-primary-active"
              >
                开始创建
              </button>
              <a
                href="#features"
                className="rounded-md border border-hairline bg-canvas px-5 py-3 font-sans text-button text-ink transition-colors hover:bg-surface-soft"
              >
                了解更多
              </a>
            </div>
          </div>
          <div className="rounded-xl bg-surface-card p-xl">
            <div className="flex items-center justify-center font-display text-display-md text-primary">
              ⚡
            </div>
            <p className="mt-md text-center font-sans text-body-sm text-muted">
              AI 驱动的 Minecraft 插件生成平台
            </p>
          </div>
        </div>
      </section>

      {/* Section 2: Features */}
      <section id="features" className="bg-surface-soft py-section">
        <div className="mx-auto max-w-[1200px] px-md">
          <h2 className="font-display text-display-md text-ink mb-xl text-center">
            从需求到上线，一站式完成
          </h2>
          <div className="grid grid-cols-1 gap-lg md:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon="🤖"
              title="AI 智能生成"
              description="用自然语言描述你想要的插件功能，AI 自动生成完整的可编译项目代码。"
            />
            <FeatureCard
              icon="🔧"
              title="在线编译检测"
              description="自动在云端编译你的插件，发现错误可一键修复，立即下载可运行的 JAR。"
            />
            <FeatureCard
              icon="👥"
              title="社区作品广场"
              description="将你的插件发布到作品广场，与其他创作者交流、获取反馈和灵感。"
            />
          </div>
        </div>
      </section>

      {/* Section 3: Code Demo */}
      <section id="code-demo" className="bg-canvas py-section">
        <div className="mx-auto max-w-[1200px] px-md">
          <h2 className="font-display text-display-md text-ink mb-xl text-center">
            看看 AI 生成的代码长什么样
          </h2>
          <CodeWindowCard
            filename="Main.java"
            code={`public class DailyReward extends JavaPlugin {\n    @Override\n    public void onEnable() {\n        getCommand("reward").setExecutor(new RewardCommand(this));\n        getServer().getPluginManager()\n            .registerEvents(new RewardListener(this), this);\n        saveDefaultConfig();\n    }\n\n    @Override\n    public void onDisable() {\n        getLogger().info("DailyReward disabled");\n    }\n}`}
          />
        </div>
      </section>

      {/* Section 4: CTA */}
      <section className="px-md py-section">
        <div className="mx-auto max-w-[1200px] rounded-lg bg-primary p-xxl text-center">
          <h2 className="font-display text-display-sm text-on-primary mb-lg">
            准备好创建你的第一个插件了吗？
          </h2>
          <button
            onClick={handleGetStarted}
            className="rounded-md bg-canvas px-5 py-3 font-sans text-button text-ink transition-colors hover:bg-surface-card"
          >
            立即开始 — 免费
          </button>
        </div>
      </section>
    </div>
  );
}
