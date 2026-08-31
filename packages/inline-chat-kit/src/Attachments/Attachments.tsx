"use client";

import { X } from "lucide-react";
import { FileText, Film, Music, Image as ImageIcon, File } from "lucide-react";
import type { HTMLAttributes } from "react";
import { Button } from "../Button/Button";
import styles from "./Attachments.module.css";

/** Something sent along with a message. */
export interface Attachment {
  id: string;
  /** The filename, shown when there is no picture to show instead. */
  name: string;
  /**
   * What to draw for it. An object URL, a data URL, or a remote one.
   *
   * Only used when `type` is an image. Anything else gets its name and a
   * glyph, because a thumbnail of a PDF at 64px is a grey rectangle.
   */
  url?: string;
  /** The MIME type. Decides between a picture and a name. */
  type?: string;
  /** In bytes. Shown beside the name. */
  size?: number;
}

type Labels = { remove: string };
const LABELS: Labels = { remove: "Remove" };

export interface AttachmentsProps extends Omit<HTMLAttributes<HTMLUListElement>, "onRemove"> {
  attachments: Attachment[];
  /**
   * Leave it out and they are a record rather than a control — which is what
   * they are once the message has been sent.
   */
  onRemove?: (id: string) => void;
  labels?: Partial<Labels>;
}

/**
 * `1.2 MB`, and nothing for a size nobody supplied.
 *
 * Powers of two, because that is what a file browser says and this number is
 * only ever compared to one of those.
 */
export function formatSize(bytes?: number): string {
  if (bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

const isImage = (a: Attachment) => Boolean(a.url) && (a.type ?? "").startsWith("image/");

/** A picture of the kind of thing it is, for the ones with no picture. */
function Glyph({ type }: { type?: string }) {
  const kind = (type ?? "").split("/")[0];
  const props = { size: 16, "aria-hidden": true } as const;
  if (kind === "image") return <ImageIcon {...props} />;
  if (kind === "video") return <Film {...props} />;
  if (kind === "audio") return <Music {...props} />;
  if (type === "application/pdf" || kind === "text") return <FileText {...props} />;
  return <File {...props} />;
}

/**
 * What is going along with the message.
 *
 * An image shows itself; everything else shows its name, because a thumbnail
 * of a PDF at this size is a grey rectangle with a corner turned down and
 * tells you less than the filename does.
 *
 * The same row draws them in the composer and under the message once it has
 * been sent — with `onRemove` in the first case and without in the second,
 * which is the whole difference between a control and a record.
 */
export function Attachments({
  attachments,
  onRemove,
  labels,
  className,
  ...rest
}: AttachmentsProps) {
  const label = { ...LABELS, ...labels };
  if (attachments.length === 0) return null;

  return (
    <ul className={[styles.list, className ?? ""].filter(Boolean).join(" ")} {...rest}>
      {attachments.map((file) => {
        const size = formatSize(file.size);
        return (
          <li
            key={file.id}
            className={styles.item}
            data-picture={isImage(file) || undefined}
          >
            {isImage(file) ? (
              /* A background rather than an `<img>`: it has to fill a square
                 crop, and the name is already on the element for anybody who
                 is not looking at it. */
              <span
                className={styles.picture}
                style={{ backgroundImage: `url(${file.url})` }}
                role="img"
                aria-label={file.name}
              />
            ) : (
              <>
                <span className={styles.glyph}>
                  <Glyph type={file.type} />
                </span>
                <span className={styles.body}>
                  <span className={styles.name}>{file.name}</span>
                  {size && <span className={styles.size}>{size}</span>}
                </span>
              </>
            )}

            {onRemove && (
              <span className={styles.remove}>
                <Button
                  variant="glass"
                  size="s"
                  onClick={() => onRemove(file.id)}
                  /* In the composer this sits on the highlighter's surface,
                     where a pointerdown starts drawing a marker. */
                  onPointerDown={(event) => event.stopPropagation()}
                  aria-label={`${label.remove} ${file.name}`}
                  icon={<X size={14} aria-hidden />}
                />
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
