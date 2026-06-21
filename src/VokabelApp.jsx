import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Plus, Pencil, Trash2, X, ArrowLeftRight,
  RotateCcw, Check, Download, Upload, Layers, Search,
} from "lucide-react";

/* ──────────────────────────────────────────────────────────
   Vokabel — ドイツ語 ⇄ 英語 双方向フラッシュカード
   設計の核：ドイツ語名詞の「性」を色で記憶する仕組み
     der = 青 / die = 赤 / das = 緑
   この色分けは飾りではなく、性を思い出すための学習補助。
   ────────────────────────────────────────────────────────── */

const STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }

.vk-root {
  --desk: #15161B;
  --desk-2: #1C1E25;
  --paper: #FAF8F2;
  --paper-edge: #ECE7DA;
  --ink: #1A1A20;
  --ink-soft: #5C5C66;
  --line: #2A2C35;
  --der: #3B79B6;
  --die: #BE4763;
  --das: #2E9C6A;
  --neutral: #8A8A95;
  font-family: 'Inter', system-ui, sans-serif;
  background: radial-gradient(120% 90% at 50% -10%, #20222B 0%, var(--desk) 55%);
  color: #EDEAE2;
  min-height: 100dvh;
}

.vk-serif { font-family: 'Spectral', Georgia, serif; }
.vk-mono  { font-family: 'JetBrains Mono', monospace; }

.vk-btn { cursor: pointer; border: none; font-family: inherit; transition: transform .12s ease, background .15s ease, border-color .15s ease, opacity .15s; }
.vk-btn:active { transform: scale(.97); }
.vk-btn:focus-visible { outline: 2px solid #7FA8D6; outline-offset: 2px; }

.vk-icon-btn { display: grid; place-items: center; border-radius: 11px; transition: background .15s, color .15s; }
.vk-icon-btn:hover { background: rgba(255,255,255,.07); }

.vk-seg { transition: color .2s; }

.vk-card-shell { perspective: 1600px; }
.vk-card-inner {
  position: relative; width: 100%; height: 100%;
  transform-style: preserve-3d;
  transition: transform .55s cubic-bezier(.2,.8,.25,1);
}
.vk-card-inner.flipped { transform: rotateY(180deg); }
.vk-face {
  position: absolute; inset: 0;
  -webkit-backface-visibility: hidden; backface-visibility: hidden;
  border-radius: 22px; overflow: hidden;
  display: flex; flex-direction: column;
}
.vk-face.back { transform: rotateY(180deg); }

.vk-rate:hover { transform: translateY(-2px); }

.vk-row:hover { background: rgba(255,255,255,.04); }

.vk-input {
  width: 100%; background: #14151A; border: 1px solid #2E313B; color: #EDEAE2;
  border-radius: 12px; padding: 12px 14px; font-size: 15px; font-family: inherit;
  transition: border-color .15s, background .15s;
}
.vk-input:focus { outline: none; border-color: #5E84B3; background: #171922; }
.vk-input::placeholder { color: #595C66; }

@keyframes vk-pop { from { opacity: 0; transform: translateY(10px) scale(.985); } to { opacity: 1; transform: none; } }
.vk-pop { animation: vk-pop .35s cubic-bezier(.2,.8,.25,1) both; }

@keyframes vk-fade { from { opacity: 0 } to { opacity: 1 } }
.vk-fade { animation: vk-fade .3s ease both; }

@media (prefers-reduced-motion: reduce) {
  .vk-card-inner, .vk-pop, .vk-fade { transition: none !important; animation: none !important; }
}
`;

/* ─── 性の色 ─── */
const GENDERS = {
  der: { color: "#3B79B6", label: "männlich" },
  die: { color: "#BE4763", label: "weiblich" },
  das: { color: "#2E9C6A", label: "sächlich" },
};
const genderColor = (g) => (GENDERS[g] ? GENDERS[g].color : "#8A8A95");

/* ─── 初期データ ─── */
const SEED = [
  ["Haus", "das", "Häuser", "Das Haus am See ist sehr groß.", "house"],
  ["Katze", "die", "Katzen", "Die Katze schläft auf dem Sofa.", "cat"],
  ["Hund", "der", "Hunde", "Der Hund läuft schnell im Park.", "dog"],
  ["Stadt", "die", "Städte", "Berlin ist eine lebendige Stadt.", "city"],
  ["Tisch", "der", "Tische", "Das Buch liegt auf dem Tisch.", "table"],
  ["Buch", "das", "Bücher", "Ich lese gerade ein gutes Buch.", "book"],
  ["Frau", "die", "Frauen", "Die Frau arbeitet als Ärztin.", "woman"],
  ["Mann", "der", "Männer", "Der Mann trinkt seinen Kaffee.", "man"],
  ["Zeit", "die", "Zeiten", "Ich habe heute leider keine Zeit.", "time"],
  ["lernen", "", "—", "Ich lerne jeden Tag ein bisschen Deutsch.", "to learn"],
];

const freshStats = () => ({
  deToEn: { level: 0, seen: 0, lastSeen: 0 },
  enToDe: { level: 0, seen: 0, lastSeen: 0 },
});

const makeWord = (g) => ({
  id: "w-" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36),
  german: g[0], gender: g[1], plural: g[2], exampleDE: g[3], english: g[4],
  stats: freshStats(),
});

/* ─── 永続化（artifact storage、無ければメモリにフォールバック）─── */
const KEY = "vokabel:words:v1";
function loadWords() {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored) return JSON.parse(stored);
  } catch (_) {}
  return null;
}
function saveWords(words) {
  try {
    localStorage.setItem(KEY, JSON.stringify(words));
  } catch (_) {}
}

/* ─── 出題キュー：習熟度が低く、最近見ていない順 ─── */
function buildQueue(words, dir) {
  return words
    .map((w) => ({ w, s: w.stats[dir] }))
    .sort((a, b) => {
      if (a.s.level !== b.s.level) return a.s.level - b.s.level;
      return a.s.lastSeen - b.s.lastSeen;
    })
    .map((x) => x.w.id);
}

const MAX_LEVEL = 5;

/* ══════════════════════════════════════════════════════════ */
export default function App() {
  const [words, setWords] = useState(null);   // null = 読み込み中
  const [view, setView] = useState("study");  // study | manage
  const [dir, setDir] = useState("deToEn");   // deToEn | enToDe

  const [queue, setQueue] = useState([]);
  const [qPos, setQPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [sessionDone, setSessionDone] = useState({ gut: 0, nochmal: 0 });

  const [editing, setEditing] = useState(null); // word | "new" | null
  const [filter, setFilter] = useState("");

  /* 初回ロード */
  useEffect(() => {
    const stored = loadWords();
    if (stored && stored.length) {
      setWords(stored);
    } else {
      const seeded = SEED.map(makeWord);
      setWords(seeded);
      saveWords(seeded);
    }
  }, []);

  /* 保存（words 変化時） */
  const firstSave = useRef(true);
  useEffect(() => {
    if (words === null) return;
    if (firstSave.current) { firstSave.current = false; return; }
    saveWords(words);
  }, [words]);

  /* セッション開始 */
  const startSession = useCallback(() => {
    if (!words) return;
    setQueue(buildQueue(words, dir));
    setQPos(0);
    setFlipped(false);
    setSessionDone({ gut: 0, nochmal: 0 });
  }, [words, dir]);

  /* セッション開始 */
  useEffect(() => {
    if (words && words.length > 0) {
      startSession();
    }
  }, [dir, words, startSession]);

  const wordById = (id) => words?.find((w) => w.id === id);
  const currentId = queue[qPos];
  const current = currentId ? wordById(currentId) : null;

  /* 採点 */
  function rate(known) {
    if (!current) return;
    setWords((prev) =>
      prev.map((w) => {
        if (w.id !== current.id) return w;
        const s = { ...w.stats[dir] };
        s.seen += 1;
        s.lastSeen = Date.now();
        s.level = known ? Math.min(MAX_LEVEL, s.level + 1) : 0;
        return { ...w, stats: { ...w.stats, [dir]: s } };
      })
    );
    setSessionDone((d) => ({
      gut: d.gut + (known ? 1 : 0),
      nochmal: d.nochmal + (known ? 0 : 1),
    }));
    setFlipped(false);
    setTimeout(() => setQPos((p) => p + 1), 180);
  }

  /* 単語の保存／削除 */
  function upsertWord(data) {
    setWords((prev) => {
      if (data.id && prev.some((w) => w.id === data.id)) {
        return prev.map((w) => (w.id === data.id ? { ...w, ...data } : w));
      }
      const nw = {
        id: "w-" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36),
        stats: freshStats(), ...data,
      };
      return [nw, ...prev];
    });
    setEditing(null);
  }
  function deleteWord(id) {
    setWords((prev) => prev.filter((w) => w.id !== id));
  }

  /* 書き出し／読み込み */
  function exportJSON() {
    const blob = new Blob([JSON.stringify(words, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "vokabel-backup.json"; a.click();
    URL.revokeObjectURL(url);
  }
  function importJSON(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const arr = JSON.parse(reader.result);
        if (Array.isArray(arr)) {
          const cleaned = arr.map((w) => ({ ...w, stats: w.stats || freshStats() }));
          setWords(cleaned);
        }
      } catch (_) { alert("ファイルを読み込めませんでした。"); }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  if (words === null) {
    return (
      <div className="vk-root" style={{ display: "grid", placeItems: "center", padding: 24 }}>
        <style>{STYLE}</style>
        <div style={{ opacity: .6, fontSize: 14 }}>読み込み中…</div>
      </div>
    );
  }

  return (
    <div className="vk-root">
      <style>{STYLE}</style>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "18px 18px 32px", minHeight: "100dvh", display: "flex", flexDirection: "column" }}>

        {/* ── ヘッダー ── */}
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
            <span className="vk-serif" style={{ fontSize: 23, fontWeight: 600, letterSpacing: "-.01em" }}>Vokabel</span>
            <span className="vk-mono" style={{ fontSize: 10.5, color: "#6F727D", letterSpacing: ".08em" }}>DE · EN</span>
          </div>
          <nav style={{ display: "flex", gap: 4, background: "rgba(255,255,255,.05)", padding: 4, borderRadius: 12 }}>
            <TabBtn active={view === "study"} onClick={() => setView("study")}><Layers size={15} /> 学習</TabBtn>
            <TabBtn active={view === "manage"} onClick={() => setView("manage")}><Search size={15} /> 単語帳</TabBtn>
          </nav>
        </header>

        {view === "study"
          ? <StudyView
              dir={dir} setDir={setDir}
              current={current} flipped={flipped} setFlipped={setFlipped}
              rate={rate} qPos={qPos} total={queue.length}
              sessionDone={sessionDone} restart={startSession}
              hasWords={words.length > 0} goManage={() => { setView("manage"); setEditing("new"); }}
            />
          : <ManageView
              words={words} filter={filter} setFilter={setFilter}
              onAdd={() => setEditing("new")} onEdit={(w) => setEditing(w)}
              onDelete={deleteWord} onExport={exportJSON} onImport={importJSON}
            />
        }
      </div>

      {editing && (
        <WordForm
          word={editing === "new" ? null : editing}
          onSave={upsertWord}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  );
}

/* ─── タブ ─── */
function TabBtn({ active, onClick, children }) {
  return (
    <button className="vk-btn" onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 6, padding: "7px 13px",
        borderRadius: 9, fontSize: 13, fontWeight: 600,
        background: active ? "#EDEAE2" : "transparent",
        color: active ? "#16171C" : "#9A9DA6",
      }}>
      {children}
    </button>
  );
}

/* ════════ 学習ビュー ════════ */
function StudyView({ dir, setDir, current, flipped, setFlipped, rate, qPos, total, sessionDone, restart, hasWords, goManage }) {
  const progress = total ? Math.min(qPos, total) / total : 0;

  if (!hasWords) {
    return (
      <EmptyState
        title="まだ単語がありません"
        body="最初の単語を登録して学習を始めましょう。性・複数形・例文も記録できます。"
        action="単語を追加" onAction={goManage}
      />
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      {/* 方向トグル */}
      <DirectionToggle dir={dir} setDir={setDir} />

      {/* 進捗バー */}
      <div style={{ height: 4, background: "rgba(255,255,255,.07)", borderRadius: 99, margin: "16px 0 18px", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${progress * 100}%`, background: "linear-gradient(90deg,#3B79B6,#2E9C6A)", borderRadius: 99, transition: "width .4s ease" }} />
      </div>

      {qPos >= total
        ? <SessionComplete done={sessionDone} onRestart={restart} />
        : current && (
          <FlashCard
            key={current.id + dir}
            word={current} dir={dir} flipped={flipped}
            onFlip={() => setFlipped((f) => !f)} onRate={rate}
            counter={`${qPos + 1} / ${total}`}
          />
        )}
    </div>
  );
}

function DirectionToggle({ dir, setDir }) {
  return (
    <button className="vk-btn" onClick={() => setDir(dir === "deToEn" ? "enToDe" : "deToEn")}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
        background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)",
        borderRadius: 13, padding: "11px 16px", width: "100%",
      }}>
      <Side label="DE" active={dir === "deToEn"} sub="ドイツ語" />
      <ArrowLeftRight size={16} color="#7E818B" />
      <Side label="EN" active={dir === "enToDe"} sub="英語" />
      <span style={{ marginLeft: 4, fontSize: 11.5, color: "#7E818B" }}>を見て答える</span>
    </button>
  );
}
function Side({ label, active, sub }) {
  return (
    <span style={{ display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1.1 }}>
      <span className="vk-mono" style={{ fontSize: 14, fontWeight: 500, color: active ? "#F2EFE7" : "#62656F" }}>{label}</span>
      <span style={{ fontSize: 9, color: active ? "#9DA1AB" : "#52555E", marginTop: 2 }}>{sub}</span>
    </span>
  );
}

/* ─── フラッシュカード本体 ─── */
function FlashCard({ word, dir, flipped, onFlip, onRate, counter }) {
  const gc = genderColor(word.gender);
  const isNoun = !!word.gender;
  // 表＝問題、裏＝答え。方向で中身が変わる
  const germanIsPrompt = dir === "deToEn";

  return (
    <div className="vk-pop" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <div className="vk-card-shell" style={{ flex: 1, minHeight: 340, height: 340, position: "relative" }}>
        <div className={"vk-card-inner" + (flipped ? " flipped" : "")} onClick={onFlip} role="button" tabIndex={0}
          onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); onFlip(); } }}
          style={{ cursor: "pointer", position: "absolute", inset: 0 }}>

          {/* 表 */}
          <div className="vk-face" style={faceStyle(germanIsPrompt ? gc : "#8A8A95")}>
            {germanIsPrompt
              ? <GermanFace word={word} gc={gc} isNoun={isNoun} counter={counter} prompt />
              : <EnglishFace word={word} counter={counter} prompt />}
          </div>

          {/* 裏 */}
          <div className="vk-face back" style={faceStyle(germanIsPrompt ? "#8A8A95" : gc)}>
            {germanIsPrompt
              ? <EnglishFace word={word} counter={counter} />
              : <GermanFace word={word} gc={gc} isNoun={isNoun} counter={counter} />}
          </div>
        </div>
      </div>

      {/* 操作部 */}
      <div style={{ marginTop: 18 }}>
        {!flipped
          ? <button className="vk-btn" onClick={onFlip}
              style={{ width: "100%", padding: "15px", borderRadius: 14, background: "#EDEAE2", color: "#16171C", fontWeight: 600, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <RotateCcw size={16} /> 答えを見る
            </button>
          : <div className="vk-fade" style={{ display: "flex", gap: 10 }}>
              <RateBtn onClick={() => onRate(false)} tone="again">もう一度<span>Nochmal</span></RateBtn>
              <RateBtn onClick={() => onRate(true)} tone="good">覚えた<span>Gut</span></RateBtn>
            </div>}
      </div>
    </div>
  );
}

function faceStyle(edge) {
  return {
    background: "linear-gradient(180deg,#FBF9F3,#F3EFE4)",
    color: "#1A1A20",
    borderLeft: `6px solid ${edge}`,
    boxShadow: "0 18px 40px -16px rgba(0,0,0,.6), 0 2px 0 rgba(255,255,255,.04)",
  };
}

/* ドイツ語の面（辞書エントリ風） */
function GermanFace({ word, gc, isNoun, counter, prompt }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "22px 24px" }}>
      <FaceTag text={prompt ? "Deutsch" : "Antwort"} sub={counter} color={gc} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 14 }}>
        <div>
          {isNoun && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span className="vk-serif" style={{ fontSize: 20, fontWeight: 600, fontStyle: "italic", color: gc }}>{word.gender}</span>
              <span style={{ fontSize: 10.5, letterSpacing: ".06em", color: gc, opacity: .8, textTransform: "uppercase" }}>{GENDERS[word.gender].label}</span>
            </div>
          )}
          <div className="vk-serif" style={{ fontSize: 40, fontWeight: 600, lineHeight: 1.05, letterSpacing: "-.015em", color: "#16161B" }}>
            {word.german}
          </div>
          {isNoun && word.plural && word.plural !== "—" && (
            <div className="vk-mono" style={{ fontSize: 13, color: "#76747A", marginTop: 8 }}>
              Pl. {word.plural}
            </div>
          )}
        </div>
        {word.exampleDE && (
          <div className="vk-serif" style={{ fontStyle: "italic", fontSize: 16, lineHeight: 1.5, color: "#494750", borderLeft: "2px solid " + gc, paddingLeft: 12 }}>
            {word.exampleDE}
          </div>
        )}
      </div>
    </div>
  );
}

/* 英語の面 */
function EnglishFace({ word, counter, prompt }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "22px 24px" }}>
      <FaceTag text={prompt ? "English" : "Answer"} sub={counter} color="#8A8A95" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-.02em", color: "#16161B", textAlign: "center" }}>
          {word.english}
        </div>
        {!prompt && word.gender && (
          <div className="vk-mono" style={{ marginTop: 10, fontSize: 12, color: genderColor(word.gender) }}>
            {word.gender} {word.german}
          </div>
        )}
      </div>
    </div>
  );
}

function FaceTag({ text, sub, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color }}>{text}</span>
      <span className="vk-mono" style={{ fontSize: 11, color: "#A8A39A" }}>{sub}</span>
    </div>
  );
}

function RateBtn({ onClick, tone, children }) {
  const styles = tone === "good"
    ? { bg: "rgba(46,156,106,.14)", bd: "rgba(46,156,106,.4)", fg: "#7BD3A6" }
    : { bg: "rgba(190,71,99,.13)", bd: "rgba(190,71,99,.4)", fg: "#E58AA0" };
  return (
    <button className="vk-btn vk-rate" onClick={onClick}
      style={{ flex: 1, padding: "14px", borderRadius: 14, background: styles.bg, border: `1px solid ${styles.bd}`, color: styles.fg, fontWeight: 600, fontSize: 15, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      {children[0]}
      <span className="vk-mono" style={{ fontSize: 10, opacity: .6, fontWeight: 400 }}>{children[1]}</span>
    </button>
  );
}

/* ─── セッション完了 ─── */
function SessionComplete({ done, onRestart }) {
  return (
    <div className="vk-pop" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 18, padding: 20 }}>
      <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(46,156,106,.15)", display: "grid", placeItems: "center" }}>
        <Check size={30} color="#7BD3A6" />
      </div>
      <div>
        <div className="vk-serif" style={{ fontSize: 24, fontWeight: 600 }}>ひと回り完了</div>
        <div style={{ fontSize: 14, color: "#9A9DA6", marginTop: 6 }}>
          覚えた {done.gut} ・ もう一度 {done.nochmal}
        </div>
      </div>
      <button className="vk-btn" onClick={onRestart}
        style={{ padding: "12px 22px", borderRadius: 13, background: "#EDEAE2", color: "#16171C", fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
        <RotateCcw size={16} /> もう一周する
      </button>
    </div>
  );
}

/* ════════ 単語帳ビュー ════════ */
function ManageView({ words, filter, setFilter, onAdd, onEdit, onDelete, onExport, onImport }) {
  const q = filter.trim().toLowerCase();
  const list = q
    ? words.filter((w) => (w.german + " " + w.english).toLowerCase().includes(q))
    : words;

  return (
    <div className="vk-fade" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={15} color="#62656F" style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)" }} />
          <input className="vk-input" style={{ paddingLeft: 36 }} placeholder="検索…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
        <button className="vk-btn" onClick={onAdd}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 16px", borderRadius: 12, background: "#EDEAE2", color: "#16171C", fontWeight: 600, fontSize: 14 }}>
          <Plus size={17} /> 追加
        </button>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, padding: "0 2px" }}>
        <span style={{ fontSize: 12, color: "#6F727D" }}>{list.length} 語</span>
        <div style={{ display: "flex", gap: 4 }}>
          <label className="vk-btn vk-icon-btn" style={{ width: 34, height: 34, color: "#9A9DA6", cursor: "pointer" }} title="読み込み">
            <Upload size={15} />
            <input type="file" accept="application/json" onChange={onImport} style={{ display: "none" }} />
          </label>
          <button className="vk-btn vk-icon-btn" style={{ width: 34, height: 34, color: "#9A9DA6" }} title="書き出し" onClick={onExport}>
            <Download size={15} />
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7 }}>
        {list.length === 0 && (
          <div style={{ textAlign: "center", color: "#62656F", fontSize: 14, padding: "40px 0" }}>該当する単語がありません</div>
        )}
        {list.map((w) => (
          <WordRow key={w.id} word={w} onEdit={() => onEdit(w)} onDelete={() => onDelete(w.id)} />
        ))}
      </div>
    </div>
  );
}

function WordRow({ word, onEdit, onDelete }) {
  const gc = genderColor(word.gender);
  const [confirm, setConfirm] = useState(false);
  // 双方向の平均習熟度
  const lvl = (word.stats.deToEn.level + word.stats.enToDe.level) / 2;
  return (
    <div className="vk-row" style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 12px", borderRadius: 13, background: "rgba(255,255,255,.025)", border: "1px solid rgba(255,255,255,.05)" }}>
      <div style={{ width: 3, alignSelf: "stretch", borderRadius: 99, background: gc, minHeight: 30 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          {word.gender && <span className="vk-serif" style={{ fontStyle: "italic", fontSize: 13, color: gc }}>{word.gender}</span>}
          <span className="vk-serif" style={{ fontSize: 17, fontWeight: 600, color: "#EDEAE2", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{word.german}</span>
        </div>
        <div style={{ fontSize: 12.5, color: "#83868F", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{word.english}</div>
      </div>
      <LevelDots level={lvl} />
      {confirm ? (
        <div style={{ display: "flex", gap: 4 }}>
          <button className="vk-btn vk-icon-btn" style={{ width: 32, height: 32, color: "#E58AA0", background: "rgba(190,71,99,.12)" }} onClick={onDelete}><Check size={15} /></button>
          <button className="vk-btn vk-icon-btn" style={{ width: 32, height: 32, color: "#9A9DA6" }} onClick={() => setConfirm(false)}><X size={15} /></button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 2 }}>
          <button className="vk-btn vk-icon-btn" style={{ width: 32, height: 32, color: "#9A9DA6" }} onClick={onEdit}><Pencil size={14} /></button>
          <button className="vk-btn vk-icon-btn" style={{ width: 32, height: 32, color: "#9A9DA6" }} onClick={() => setConfirm(true)}><Trash2 size={14} /></button>
        </div>
      )}
    </div>
  );
}

function LevelDots({ level }) {
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: i < Math.round(level) ? "#2E9C6A" : "rgba(255,255,255,.13)" }} />
      ))}
    </div>
  );
}

/* ════════ 入力フォーム（追加・編集）════════ */
function WordForm({ word, onSave, onCancel }) {
  const [f, setF] = useState({
    german: word?.german || "",
    gender: word?.gender || "",
    plural: word?.plural || "",
    exampleDE: word?.exampleDE || "",
    english: word?.english || "",
  });
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const valid = f.german.trim() && f.english.trim();

  function submit() {
    if (!valid) return;
    onSave({ id: word?.id, ...f, german: f.german.trim(), english: f.english.trim() });
  }

  return (
    <div className="vk-fade" onClick={onCancel}
      style={{ position: "fixed", inset: 0, background: "rgba(8,9,12,.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }}>
      <div className="vk-pop" onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 460, background: "#17181E", borderTopLeftRadius: 24, borderTopRightRadius: 24, border: "1px solid rgba(255,255,255,.08)", padding: "20px 18px calc(20px + env(safe-area-inset-bottom))" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <span className="vk-serif" style={{ fontSize: 19, fontWeight: 600 }}>{word ? "単語を編集" : "新しい単語"}</span>
          <button className="vk-btn vk-icon-btn" style={{ width: 34, height: 34, color: "#9A9DA6" }} onClick={onCancel}><X size={18} /></button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Field label="ドイツ語 *">
            <input className="vk-input" value={f.german} onChange={set("german")} placeholder="Haus" autoFocus />
          </Field>

          <div>
            <Label>性（名詞のみ）</Label>
            <div style={{ display: "flex", gap: 7 }}>
              {["", "der", "die", "das"].map((g) => (
                <button key={g || "none"} className="vk-btn"
                  onClick={() => setF((p) => ({ ...p, gender: g }))}
                  style={{
                    flex: 1, padding: "10px 0", borderRadius: 11, fontSize: 14, fontWeight: 600,
                    fontFamily: g ? "'Spectral',serif" : "inherit", fontStyle: g ? "italic" : "normal",
                    background: f.gender === g ? (g ? genderColor(g) : "#3A3D47") : "rgba(255,255,255,.05)",
                    color: f.gender === g ? "#fff" : "#8A8D96",
                    border: "1px solid " + (f.gender === g ? "transparent" : "rgba(255,255,255,.07)"),
                  }}>
                  {g || "なし"}
                </button>
              ))}
            </div>
          </div>

          <Field label="複数形">
            <input className="vk-input" value={f.plural} onChange={set("plural")} placeholder="Häuser" />
          </Field>
          <Field label="例文（ドイツ語）">
            <textarea className="vk-input" rows={2} value={f.exampleDE} onChange={set("exampleDE")} placeholder="Das Haus ist groß." style={{ resize: "none", lineHeight: 1.5 }} />
          </Field>
          <Field label="英語の意味 *">
            <input className="vk-input" value={f.english} onChange={set("english")} placeholder="house" />
          </Field>
        </div>

        <button className="vk-btn" onClick={submit} disabled={!valid}
          style={{ width: "100%", marginTop: 18, padding: "14px", borderRadius: 14, background: valid ? "#EDEAE2" : "#2A2C34", color: valid ? "#16171C" : "#5A5D66", fontWeight: 600, fontSize: 15, cursor: valid ? "pointer" : "not-allowed" }}>
          {word ? "保存する" : "追加する"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return <div><Label>{label}</Label>{children}</div>;
}
function Label({ children }) {
  return <div style={{ fontSize: 12, color: "#83868F", marginBottom: 6, fontWeight: 500 }}>{children}</div>;
}

/* ─── 空状態 ─── */
function EmptyState({ title, body, action, onAction }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 14, padding: 24 }}>
      <div style={{ width: 60, height: 60, borderRadius: 16, background: "rgba(255,255,255,.05)", display: "grid", placeItems: "center" }}>
        <Layers size={26} color="#7E818B" />
      </div>
      <div>
        <div className="vk-serif" style={{ fontSize: 21, fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: 14, color: "#9A9DA6", marginTop: 6, maxWidth: 280, lineHeight: 1.55 }}>{body}</div>
      </div>
      <button className="vk-btn" onClick={onAction}
        style={{ padding: "12px 20px", borderRadius: 13, background: "#EDEAE2", color: "#16171C", fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
        <Plus size={17} /> {action}
      </button>
    </div>
  );
}
