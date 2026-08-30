"use client";

import { useId, type HTMLAttributes, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown } from "lucide-react";
import { useDisclosure } from "../disclosure/useDisclosure";
import { prefersReducedMotion } from "../reducedMotion/reducedMotion";
import styles from "./Sources.module.css";

/** Where a claim came from. */
export interface Source {
  id: string;
  title: string;
  /** Opened when the entry is a link. Without one it is a row, not a link. */
  url?: string;
  /** A domain, a filename, a page — whatever names where this is. */
  origin?: string;
  /** The passage in the source that carries the claim. */
  quote?: string;
}

type Labels = { title: string; one: string; many: string };

const LABELS: Labels = { title: "Sources", one: "source", many: "sources" };

export interface SourcesProps extends Omit<HTMLAttributes<HTMLElement>, "title" | "onSelect"> {
  sources: Source[];
  /** Heads the list. Defaults to `labels.title`. */
  title?: ReactNode;
  /** Offer to fold the list to its own row. */
  collapsible?: boolean;
  /**
   * The one just arrived at, from a citation in the text.
   *
   * Marked rather than scrolled to: the list is directly under the answer, and
   * moving the page under somebody who clicked a marker in a sentence they
   * were reading loses them the sentence.
   */
  activeId?: string | null;
  onSelect?: (source: Source, index: number) => void;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  labels?: Partial<Labels>;
}

/**
 * What the answer was drawn from, numbered to match the markers in it.
 *
 * Open by default. Sources are the difference between an answer somebody can
 * check and one they have to trust, and folding that away by default says the
 * opposite of what a citation is for.
 */
export function Sources({
  sources,
  title,
  collapsible = false,
  activeId = null,
  onSelect,
  open,
  defaultOpen,
  onOpenChange,
  labels,
  className,
  ...rest
}: SourcesProps) {
  const label = { ...LABELS, ...labels };
  const listId = useId();
  const still = prefersReducedMotion();

  const disclosure = useDisclosure({ open, defaultOpen, onOpenChange, preferOpen: true });
  const isOpen = collapsible ? disclosure.isOpen : true;

  const count = `${sources.length} ${sources.length === 1 ? label.one : label.many}`;

  const head = (
    <>
      <span className={styles.title}>{title ?? label.title}</span>
      <span className={styles.count}>{count}</span>
      {collapsible && <ChevronDown className={styles.chevron} size={14} aria-hidden />}
    </>
  );

  return (
    <section className={[styles.sources, className ?? ""].filter(Boolean).join(" ")} {...rest}>
      {collapsible ? (
        <button
          type="button"
          className={styles.header}
          onClick={disclosure.toggle}
          /* Inside an answer this sits on the highlighter's surface, where a
             pointerdown starts drawing a marker. The click is for the row. */
          onPointerDown={(event) => event.stopPropagation()}
          aria-expanded={isOpen}
          aria-controls={listId}
        >
          {head}
        </button>
      ) : (
        <div className={`${styles.header} ${styles.static}`}>{head}</div>
      )}

      {/* Always rendered, so `aria-controls` always points at something. */}
      <div id={listId} className={styles.listOuter}>
        <AnimatePresence initial={false}>
          {isOpen && sources.length > 0 && (
            <motion.div
              key="list"
              className={styles.listWrap}
              initial={still ? { opacity: 0 } : { height: 0, opacity: 0 }}
              animate={still ? { opacity: 1 } : { height: "auto", opacity: 1 }}
              exit={still ? { opacity: 0 } : { height: 0, opacity: 0 }}
              transition={{ duration: still ? 0.12 : 0.22, ease: [0.32, 0.72, 0, 1] }}
            >
              <ol className={styles.list}>
                {sources.map((source, i) => {
                  const number = i + 1;
                  const active = source.id === activeId;
                  const body = (
                    <>
                      {/* The same square the marker in the text wears, so the
                          two read as one thing counted twice. */}
                      <span className={styles.number} data-active={active || undefined}>
                        {number}
                      </span>
                      <span className={styles.body}>
                        <span className={styles.name}>{source.title}</span>
                        {source.origin && <span className={styles.origin}>{source.origin}</span>}
                        {source.quote && <span className={styles.quote}>{source.quote}</span>}
                      </span>
                    </>
                  );

                  return (
                    <li
                      key={source.id}
                      className={styles.item}
                      data-active={active || undefined}
                      id={`${listId}-${source.id}`}
                    >
                      {source.url ? (
                        <a
                          className={styles.entry}
                          href={source.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          onClick={() => onSelect?.(source, number)}
                          onPointerDown={(event) => event.stopPropagation()}
                        >
                          {body}
                        </a>
                      ) : (
                        <div className={styles.entry}>{body}</div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
