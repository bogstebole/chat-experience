import { useState } from "react";
import { type InlineAnimConfig, defaultInlineAnimConfig } from "../ChatInput/ChatInput";
import styles from "./AnimationPanel.module.css";

interface Props {
  config: InlineAnimConfig;
  onChange: (config: InlineAnimConfig) => void;
}

interface SliderDef {
  key: keyof InlineAnimConfig;
  label: string;
  min: number;
  max: number;
  step: number;
}

const GROUPS: { title: string; desc: string; rows: SliderDef[] }[] = [
  {
    title: "Bubble Spring",
    desc: "Controls how the pill morphs into the chat bubble when you hit send — the stretch, overshoot, and settle.",
    rows: [
      { key: "bubbleStiffness", label: "stiffness", min: 50,  max: 600, step: 1   },
      { key: "bubbleDamping",   label: "damping",   min: 5,   max: 60,  step: 0.5 },
      { key: "bubbleMass",      label: "mass",      min: 0.1, max: 3,   step: 0.05 },
    ],
  },
  {
    title: "Glyph Exit",
    desc: "The stop icon inside the pill sliding left into the text as the AI finishes. x sets how far it travels.",
    rows: [
      { key: "glyphExitX",         label: "x",         min: -80, max: 0,   step: 1   },
      { key: "glyphExitStiffness", label: "stiffness", min: 50,  max: 600, step: 1   },
      { key: "glyphExitDamping",   label: "damping",   min: 5,   max: 60,  step: 0.5 },
      { key: "glyphExitMass",      label: "mass",      min: 0.1, max: 3,   step: 0.05 },
    ],
  },
  {
    title: "Ripple",
    desc: "A brief horizontal squish on the bubble surface the moment the glyph lands — like it absorbed the impact.",
    rows: [
      { key: "rippleScaleX",   label: "scaleX",   min: 1,   max: 1.06, step: 0.001 },
      { key: "rippleDuration", label: "duration", min: 0.1, max: 1,    step: 0.01  },
    ],
  },
  {
    title: "Pulse",
    desc: "The inner glass highlight brightening at the same moment as the ripple — the light flash on impact.",
    rows: [
      { key: "pulseDuration", label: "duration (ms)", min: 50, max: 600, step: 10 },
    ],
  },
];

function fmt(key: keyof InlineAnimConfig, val: number): string {
  if (key === "rippleScaleX")   return val.toFixed(3);
  if (key === "rippleDuration") return val.toFixed(2) + "s";
  if (key === "pulseDuration")  return val + "ms";
  if (key === "bubbleMass" || key === "glyphExitMass") return val.toFixed(2);
  return String(val);
}

function copyText(config: InlineAnimConfig): string {
  return `{
  bubbleSpring:  { stiffness: ${config.bubbleStiffness}, damping: ${config.bubbleDamping}, mass: ${config.bubbleMass} },
  glyphExit:     { x: ${config.glyphExitX}, stiffness: ${config.glyphExitStiffness}, damping: ${config.glyphExitDamping}, mass: ${config.glyphExitMass} },
  ripple:        { scaleX: ${config.rippleScaleX.toFixed(3)}, duration: ${config.rippleDuration.toFixed(2)} },
  pulseDuration: ${config.pulseDuration},
}`;
}

export function AnimationPanel({ config, onChange }: Props) {
  const [copied, setCopied] = useState(false);

  const set = (key: keyof InlineAnimConfig, val: number) =>
    onChange({ ...config, [key]: val });

  const handleCopy = () => {
    navigator.clipboard.writeText(copyText(config)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  const handleReset = () => onChange(defaultInlineAnimConfig);

  return (
    <aside className={styles.panel}>
      <header className={styles.header}>
        <span className={styles.title}>inline config</span>
        <button className={styles.resetBtn} onClick={handleReset} title="Reset to defaults">
          reset
        </button>
      </header>

      {GROUPS.map((group) => (
        <section key={group.title} className={styles.group}>
          <p className={styles.groupTitle}>{group.title}</p>
          <p className={styles.groupDesc}>{group.desc}</p>
          {group.rows.map(({ key, label, min, max, step }) => (
            <label key={key} className={styles.row}>
              <div className={styles.rowMeta}>
                <span className={styles.label}>{label}</span>
                <span className={styles.value}>{fmt(key, config[key])}</span>
              </div>
              <input
                type="range"
                className={styles.slider}
                min={min}
                max={max}
                step={step}
                value={config[key]}
                onChange={(e) => set(key, parseFloat(e.target.value))}
              />
            </label>
          ))}
        </section>
      ))}

      <div className={styles.footer}>
        <button className={`${styles.copyBtn} ${copied ? styles.copied : ""}`} onClick={handleCopy}>
          {copied ? "copied!" : "copy config"}
        </button>
      </div>
    </aside>
  );
}
