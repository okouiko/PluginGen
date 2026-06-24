import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-canvas">
      <div className="text-center">
        <h1 className="font-display text-display-lg text-ink mb-md">404</h1>
        <p className="font-sans text-body-md text-body mb-lg">页面不存在</p>
        <p className="font-sans text-body-sm text-muted mb-xl">
          你访问的页面可能已被删除或链接有误
        </p>
        <Link
          to="/"
          className="inline-block rounded-md bg-primary px-5 py-3 font-sans text-button text-on-primary transition-colors hover:bg-primary-active"
        >
          返回首页
        </Link>
      </div>
    </div>
  );
}
