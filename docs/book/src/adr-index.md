# 設計判断の索引

ADR（Architecture Decision Record、設計判断の記録）は、**なぜ**その設計になったかの
一次資料です。この本の各章は「何をしているか」を中心に書いていますが、「なぜ」を
知りたくなったら、ここから該当の ADR に飛んでください。

| ADR | 内容 | 一言で |
|---|---|---|
| [ADR-0001](https://github.com/dOtOb9/ui-forge/blob/main/TaskSheets/ADR-0001-design.md) | テキストベースの UMG を作る | `.ui`(JSON) → TSX 生成。コメントは書けない代わりに正規化で差分を読めるようにする |

ui-forge はまだ新しいツールなので、今のところ ADR は1個だけです。「却下した案」節に
Slint・実行時解釈のみ・独自 DSL のような採用しなかった選択肢の理由が残っています。

## タスクシートとの関係

ADR が「なぜ」を記録するのに対し、`TaskSheets/F1`〜のタスクシートは「何を、どう
実装し、何を確認したか」という作業記録です。

| タスクシート | 状態 | 内容 |
|---|---|---|
| [`F1-foundation.md`](https://github.com/dOtOb9/ui-forge/blob/main/TaskSheets/F1-foundation.md) | 完了 | 形式・生成器・プレビュー（編集なし）。この本の大部分が対象にしている範囲 |
| [`P1-platforms.md`](https://github.com/dOtOb9/ui-forge/blob/main/TaskSheets/P1-platforms.md) | 進行中 | Windows / Android / Web 対応。合流後に[プラットフォーム](./platforms.md)の章を書く |
| [`B1-book.md`](https://github.com/dOtOb9/ui-forge/blob/main/TaskSheets/B1-book.md) | — | この本自体の作業記録 |

本書の各章は主に ADR とコードを突き合わせて書いていますが、実装時に選んだ理由や
退けた案の詳細はタスクシートの「実装記録」節にしかないことが多いので、気になる
箇所はそちらも参照してください。

## まず読むファイル

- [`TaskSheets/ADR-0001-design.md`](https://github.com/dOtOb9/ui-forge/blob/main/TaskSheets/ADR-0001-design.md) — すべての前提
- [`TaskSheets/F1-foundation.md`](https://github.com/dOtOb9/ui-forge/blob/main/TaskSheets/F1-foundation.md) — 実装記録。選んだ理由と退けた案
