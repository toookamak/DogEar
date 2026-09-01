interface Props {
  onClear?: () => void;
}

export default function EmptyState({ onClear }: Props) {
  return (
    <div className="empty-state">
      <div className="empty-glyph">⌕</div>
      <p className="empty-title">没有符合当前筛选条件的书签</p>
      <p className="empty-hint">试试调整标签 / 来源，或清除筛选条件</p>
      {onClear && (
        <button type="button" className="primary-action" onClick={onClear}>
          清除筛选
        </button>
      )}
    </div>
  );
}