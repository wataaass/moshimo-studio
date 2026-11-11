# moshimo-studio

@DECISIONS.md

「もしも〜だったら？」の3D検証ショート動画を、コードから書き出す仕組み。

新しい動画を作るとき、既存の動画を直すときは `moshimo-video` スキルの手順に従う。

## 構成
- `src/engine.js` 共通の土台（描画設定、字幕）／`src/util.js` 純粋な計算（テスト対象）
- `scenes/<名前>.js` 動画1本ぶんの内容。`duration` と `build(stage)` を export し、`build` は「時刻 t を受けてその瞬間の状態にする関数」を返す
- `scenes/<名前>.facts.js` その動画で使う数字と計算（テスト対象）／`scenes/<名前>.md` 台本と出典
- `scenes/<名前>.timing.js` 映像と音で共有する時刻表（拍に合わせる）
- `scenes/<名前>.audio.js` その動画の BGM と効果音（`buildAudio()` を export）／`src/synth.js` 音を合成する道具
- `render.cjs` シーンを1コマずつ描いて mp4 にし、音を付ける

## 確認コマンド
- `npm run check` 文法チェック、テスト、試し書き出し（静止画3枚）をまとめて実行
- `npm run preview` 見た目の確認用に静止画を `out/` に出す（半分の解像度）
- `node tools/audio-report.js <シーン名>` 音の点検（帯域のバランス、系統ごとの音量、時刻ごとの立ち上がり）
- `node render.cjs <シーン名> --audio-only` 書き出し済みの mp4 に音だけ付け直す（音を直したときはこれで足りる）
- `node render.cjs <シーン名>` 本番の mp4 を `out/` に出す（10秒ぶんで約2分半。30秒を超えるものはバックグラウンドで実行する）

## 守ること
- アニメーションは時刻 t だけで決める。CSS アニメーションや `Math.random()`、実時間は使わない（コマ書き出しでずれる）。乱数は `rng(seed)` を使う
- 字幕は上 200px 前後と 1300〜1650px に置く（ショートの UI に隠れない範囲）
- 字幕に出す数字は `facts.js` の計算と合わせ、テストで確かめる。出典が取れない数字は使わない
- 場面の時刻は `timing.js` に置いて映像と音で共有し、拍の上に置く。音は耳で確認できないので、`tools/audio-report.js` で確かめ、未確認であることを報告に書く
- 見た目を変えたら、静止画を書き出して目で確認してから報告する
