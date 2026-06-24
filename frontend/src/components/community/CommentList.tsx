import { useState } from 'react';

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  user: {
    id: string;
    nickname: string;
    avatar: string;
  };
}

interface CommentListProps {
  comments: Comment[];
  onAddComment: (content: string) => Promise<void>;
}

export function CommentList({ comments, onAddComment }: CommentListProps) {
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!newComment.trim()) return;
    setSubmitting(true);
    try {
      await onAddComment(newComment.trim());
      setNewComment('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-md">
      <h3 className="font-sans text-title-sm text-ink">
        评论 ({comments.length})
      </h3>

      <div className="flex gap-sm">
        <input
          type="text"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="写下你的评论…"
          className="flex-1 rounded-md border border-hairline bg-canvas px-3.5 py-2 font-sans text-body-sm text-ink outline-none focus:border-primary focus:ring-3 focus:ring-primary/15"
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        />
        <button
          onClick={handleSubmit}
          disabled={submitting || !newComment.trim()}
          className="rounded-md bg-primary px-4 py-2 font-sans text-button text-on-primary transition-colors hover:bg-primary-active disabled:bg-primary-disabled"
        >
          发送
        </button>
      </div>

      <div className="space-y-sm">
        {comments.map((comment) => (
          <div
            key={comment.id}
            className="rounded-md bg-surface-soft p-sm"
          >
            <div className="flex items-center gap-sm">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-caption text-primary">
                {comment.user.nickname.charAt(0).toUpperCase()}
              </div>
              <span className="font-sans text-body-sm text-ink">
                {comment.user.nickname}
              </span>
              <span className="font-sans text-caption text-muted-soft">
                {new Date(comment.createdAt).toLocaleDateString('zh-CN')}
              </span>
            </div>
            <p className="mt-1 font-sans text-body-sm text-body">
              {comment.content}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
