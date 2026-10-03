// F1-foundation.md「下: イベントログ」。ボタンを押すとonToggleLayerのように
// 発火したイベント名が時刻付きで並ぶ。
export interface EventLogEntry {
  name: string;
  at: Date;
}

function formatTime(at: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(at.getHours())}:${pad(at.getMinutes())}:${pad(at.getSeconds())}`;
}

export function EventLog({ entries }: { entries: EventLogEntry[] }) {
  return (
    <div className="flex h-32 shrink-0 flex-col gap-1 overflow-y-auto border-t border-white/10 bg-slate-900 p-2 text-xs text-slate-200">
      <h2 className="font-semibold text-slate-400">イベントログ</h2>
      {entries.length === 0 && <p className="text-slate-500">まだ何も起きていません</p>}
      {/* 新しいものを上に。キーは発生順に単調増加するインデックスで良い(同名の
          イベントが同じ時刻に複数回起きても区別できる)。 */}
      {entries
        .slice()
        .reverse()
        .map((entry, i) => (
          <div key={entries.length - i} className="flex gap-2 font-mono">
            <span className="text-slate-500">{formatTime(entry.at)}</span>
            <span>{entry.name}</span>
          </div>
        ))}
    </div>
  );
}
