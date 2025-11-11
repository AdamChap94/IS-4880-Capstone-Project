export default function MessageRow({ text, flagged }) {
  return (
    <div className="row">
      <div className="content">{text}</div>
      {flagged && <span className="badge">flagged</span>}
      <style>{`
        .row{display:flex;gap:.5rem;align-items:flex-start;padding:.5rem 0;border-bottom:1px solid #eee}
        .content{white-space:pre-wrap;word-break:break-word;flex:1}
        .badge{font-size:.75rem;padding:2px 6px;border:1px solid #d4b106;background:#fffbe6;border-radius:6px}
      `}</style>
    </div>
  );
}
