import { type ReactNode } from "react";
import { motion, type Variants } from "motion/react";
import { Button } from "../Button/Button";
import { InlineChatBanner } from "./InlineChatBanner";
import { INLINE_CHAT_FEATURE_STATUS } from "./featureStatus";
import styles from "./IntroLanding.module.css";

/**
 * The page in front of the demo: what this is, what works, and a way in.
 *
 * Two copies of it before this, in the playground and on the website, along
 * with two copies of its stylesheet. The stylesheet is the reason it is worth
 * moving rather than leaving: it reached for `--color-bg-page`,
 * `--font-geist-sans` and `--font-jetbrains-mono`, none of which the kit
 * defines — so it rendered correctly only in a host that happened to have
 * them, and silently fell back to a serif on a white page in one that did
 * not. It is on `--ick-` tokens now, which the kit ships.
 *
 * What a host still gives it: the logo, and where "back" goes. Its identity.
 */

/** How the intro arrives, and how it leaves for the chat. Exposed so a tuning
    panel can reach it; every number has a default that works. */
export interface IntroMotion {
  staggerIn?: number;
  stiffness?: number;
  damping?: number;
  offsetIn?: number;
  blurIn?: number;
  staggerOut?: number;
  durationOut?: number;
  offsetOut?: number;
  blurOut?: number;
}

export interface IntroLandingProps {
  /** The host's mark. Nothing is drawn in its place if it is left off. */
  logo?: ReactNode;
  /** The way back out, rendered as given — an `<a>`, a framework `<Link>`. */
  back?: ReactNode;
  onStart: () => void;
  welcome?: string;
  title?: string;
  version?: string;
  description?: string;
  /** What the demo can actually do. Defaults to the kit's own list. */
  status?: typeof INLINE_CHAT_FEATURE_STATUS;
  motionConfig?: IntroMotion;
}

const DEFAULTS: Required<IntroMotion> = {
  staggerIn: 0.07,
  stiffness: 100,
  damping: 36,
  offsetIn: -10,
  blurIn: 10,
  staggerOut: 0.07,
  durationOut: 0.28,
  offsetOut: -10,
  blurOut: 10,
};

export function IntroLanding({
  logo,
  back,
  onStart,
  welcome = "Welcome",
  title = "This is inline chat experience",
  version = "v1.0.0",
  description = "Exploration of having the input be the same as response. Or better said input morphing into chat bubble and maintains the continuous experience.",
  status = INLINE_CHAT_FEATURE_STATUS,
  motionConfig,
}: IntroLandingProps) {
  const m = { ...DEFAULTS, ...motionConfig };

  const container: Variants = {
    hidden: {},
    visible: { transition: { staggerChildren: m.staggerIn } },
    exit: { transition: { staggerChildren: m.staggerOut, staggerDirection: -1 as const } },
  };

  const item: Variants = {
    hidden: { opacity: 0, filter: `blur(${m.blurIn}px)`, y: m.offsetIn },
    visible: {
      opacity: 1,
      filter: "blur(0px)",
      y: 0,
      transition: { type: "spring", stiffness: m.stiffness, damping: m.damping },
    },
    exit: {
      opacity: 0,
      filter: `blur(${m.blurOut}px)`,
      y: m.offsetOut,
      transition: { duration: m.durationOut, ease: [0.4, 0, 1, 1] as const },
    },
  };

  return (
    <motion.div
      key="intro"
      className={styles.page}
      variants={container}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <div className={styles.container}>
        <div className={styles.infoContainer}>
          {logo && <motion.div variants={item}>{logo}</motion.div>}
          <div className={styles.content}>
            <div className={styles.introContent}>
              <motion.div className={styles.nameContent} variants={item}>
                <span className={styles.welcome}>{welcome}</span>
                <span className={styles.title}>{title}</span>
              </motion.div>
              <motion.span className={styles.version} variants={item}>
                {version}
              </motion.span>
            </div>
            <motion.p className={styles.description} variants={item}>
              {description}
            </motion.p>
          </div>
        </div>

        <motion.div variants={item} className={styles.bannerWrapper}>
          <InlineChatBanner status={status} />
        </motion.div>

        {/* Three empty slots, so the button waits three beats rather than
            arriving with the paragraph above it. A `delay` would do the same
            thing and then drift the moment the stagger changes; these move
            with it. */}
        <motion.div variants={item} style={{ display: "none" }} />
        <motion.div variants={item} style={{ display: "none" }} />
        <motion.div variants={item} style={{ display: "none" }} />

        <motion.div variants={item} className={styles.buttonWrapper}>
          <Button variant="glass" size="m" onClick={onStart}>
            Start experience
          </Button>
          {back}
        </motion.div>
      </div>
    </motion.div>
  );
}
