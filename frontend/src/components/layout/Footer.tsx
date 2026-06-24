export function Footer() {
  return (
    <footer className="bg-surface-dark px-xl py-section text-on-dark-soft font-sans text-body-sm">
      <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-md md:flex-row">
        <span>&copy; 2026 PluginGen. All rights reserved.</span>
        <div className="flex gap-lg">
          <a href="#" className="transition-colors hover:text-on-dark">
            产品
          </a>
          <a href="#" className="transition-colors hover:text-on-dark">
            关于
          </a>
          <a href="#" className="transition-colors hover:text-on-dark">
            隐私
          </a>
        </div>
      </div>
    </footer>
  );
}
