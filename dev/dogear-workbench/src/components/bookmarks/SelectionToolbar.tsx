import { useState } from "react";

interface Props {
  count: number;
  onConfirm: () => void;
  onShelve: () => void;
  onBack: () => void;
  onAddTag: (tag: string) => void;
  onClear: () => void;
  onTrash: () => void;
}

export default function SelectionToolbar({
  count,
  onConfirm,
  onShelve,
  onBack,
  onAddTag,
  onClear,
  onTrash,
}: Props) {
  const [tagInput, setTagInput] = useState("");

  function submitTag(event: React.FormEvent) {
    event.preventDefault();
    onAddTag(tagInput);
    setTagInput("");
  }

  return (
    <div className="selection-bar show" role="group" aria-label="批量操作">
      <span className="selection-count">
        已选 <strong>{count}</strong> 条
      </span>
      <button type="button" className="mini-action accent" onClick={onConfirm}>
        确认收藏
      </button>
      <button type="button" className="mini-action accent" onClick={onShelve}>
        搁置
      </button>
      <button type="button" className="mini-action" onClick={onBack}>
        退回待处理
      </button>
      <form className="selection-tag-form" onSubmit={submitTag}>
        <input
          type="text"
          value={tagInput}
          placeholder="添加标签"
          aria-label="批量添加标签"
          onChange={(event) => setTagInput(event.target.value)}
        />
        <button type="submit" className="mini-action">
          添加
        </button>
      </form>
      <button type="button" className="mini-action ghost danger" onClick={onTrash}>
        移至回收站
      </button>
      <button type="button" className="mini-action ghost" onClick={onClear}>
        取消选择
      </button>
    </div>
  );
}