import { useMemo, useState } from "react";
import { useDialKit } from "dialkit";
import { defaultFoldMotion, defaultInlineAnimConfig } from "inline-chat-kit";
import { ChatExperienceDemo } from "inline-chat-kit/demo";
import { Logo } from "../demo/Logo";
import { requestedTheme } from "../demo/showcase";

/**
 * The playground's view of the demo — which is the demo, plus the dial.
 *
 * It used to be 865 lines, and the website's copy of it was 890. Both of them
 * were the same assembly written twice: the same anchor, the same header, the
 * same empty state, the same highlights sheet, drifting apart a fix at a time.
 * That assembly is `ChatExperience` in the kit now, and the scripted demo
 * around it is `inline-chat-kit/demo`, so this file is what is genuinely the
 * playground's: the tuning panel, and the logo.
 *
 * The dial is the reason this is not three lines. Every number it holds is
 * passed down as a prop, which is what makes the panel able to move anything
 * at all — handed the frozen defaults instead, as it was for a while, every
 * slider in it was read-only in practice.
 */
export function ChatExperience() {
  const dial = useDialKit("Animation Setup", {
    "Entrance Animation": {
      staggerDelay: [0.07, 0, 0.5],
      stiffness: [100, 50, 800],
      damping: [36, 5, 100],
      yOffset: [-10, -100, 100],
      blur: [10, 0, 50],
    },
    "Start Experience": {
      staggerDelay: [0.07, 0, 0.5],
      duration: [0.28, 0, 1],
      yOffset: [-10, -100, 100],
      blur: [10, 0, 50],
    },
    "Chat Feed": {
      delay: [0.3, 0, 1.5],
    },
    /* The pill itself, and with it the text inside — the editor rides this
       same spring by way of a `layout="position"`.

       Two things are visible here and neither is new. The height overshoots:
       measured through an entrance, the pill goes 44 to 45.28 and back to 44,
       which is the spring being underdamped, and everything centred in it bobs
       by that pixel. And the text arrives late — up to 26px below its place
       mid-flight — because a spring on a layout *delta* and a spring on the
       parent's own transform do not lock together while the parent is itself
       moving. Raising `damping` settles both. */
    "Composer Bubble": {
      stiffness: [defaultInlineAnimConfig.bubble.stiffness, 50, 900],
      damping: [defaultInlineAnimConfig.bubble.damping, 5, 100],
      mass: [defaultInlineAnimConfig.bubble.mass, 0.05, 2],
    },
    /* The composer's three controls — the microphone, the plus and the send
       glyph — as they leave for a second line and come back.

       `exitDuration` is the one that was unreachable: the leaving tween was a
       literal 0.15 in three places, so the dial could tune everything that
       brings the row back and nothing that takes it away.

       The staggers are one beat each, applied right to left: the send glyph
       waits none, the plus one, the microphone two. Move `staggerEnter` and
       all three move together. */
    "Composer Buttons": {
      exitDuration: [defaultInlineAnimConfig.wrap.exitDuration, 0, 1],
      staggerExit: [defaultInlineAnimConfig.button.staggerExit, 0, 0.4],
      staggerEnter: [defaultInlineAnimConfig.button.staggerEnter, 0, 0.4],
      addVisualDuration: [defaultInlineAnimConfig.addButton.visualDuration, 0.05, 1.2],
      addBounce: [defaultInlineAnimConfig.addButton.bounce, 0, 0.9],
      sendVisualDuration: [defaultInlineAnimConfig.enterButton.visualDuration, 0.05, 1.2],
      sendBounce: [defaultInlineAnimConfig.enterButton.bounce, 0, 0.9],
      slideInDelay: [defaultInlineAnimConfig.wrap.slideInDelay, 0, 600],
    },
    /* The question group's fold. `visualDuration` is how long the box *looks*
       like it takes — Motion solves the spring for it — and `bounce` is how
       far it overshoots. Two numbers you can answer a question with, rather
       than a stiffness and a damping that between them describe the same
       spring without telling you how long it is.

       The row numbers are the same idea one level down: rows arrive one after
       the next, each a little above its place and settling into it. `fadeIn`
       and `fadeOut` are tweens on purpose — opacity is bounded, so a spring on
       it overshoots into a clamp and spends the overshoot sitting still. */
    "Question Fold": {
      visualDuration: [defaultFoldMotion.visualDuration, 0.1, 1.2],
      bounce: [defaultFoldMotion.bounce, 0, 0.8],
      rowDuration: [defaultFoldMotion.rowDuration, 0.1, 1.2],
      rowBounce: [defaultFoldMotion.rowBounce, 0, 0.8],
      rowOffset: [defaultFoldMotion.rowOffset, -60, 60],
      stagger: [defaultFoldMotion.stagger, 0, 0.25],
      fadeIn: [defaultFoldMotion.fadeIn, 0, 0.6],
      fadeOut: [defaultFoldMotion.fadeOut, 0, 0.6],
      fadeInDelay: [defaultFoldMotion.fadeInDelay, 0, 0.4],
    },
  });

  const composer = dial["Composer Buttons"];
  const bubble = dial["Composer Bubble"];
  const animationConfig = useMemo(
    () => ({
      ...defaultInlineAnimConfig,
      bubble: {
        ...defaultInlineAnimConfig.bubble,
        stiffness: bubble.stiffness,
        damping: bubble.damping,
        mass: bubble.mass,
      },
      button: {
        ...defaultInlineAnimConfig.button,
        staggerEnter: composer.staggerEnter,
        staggerExit: composer.staggerExit,
      },
      addButton: {
        ...defaultInlineAnimConfig.addButton,
        visualDuration: composer.addVisualDuration,
        bounce: composer.addBounce,
      },
      enterButton: {
        ...defaultInlineAnimConfig.enterButton,
        visualDuration: composer.sendVisualDuration,
        bounce: composer.sendBounce,
      },
      wrap: {
        ...defaultInlineAnimConfig.wrap,
        exitDuration: composer.exitDuration,
        slideInDelay: composer.slideInDelay,
      },
    }),
    [
      bubble.stiffness,
      bubble.damping,
      bubble.mass,
      composer.staggerEnter,
      composer.staggerExit,
      composer.addVisualDuration,
      composer.addBounce,
      composer.sendVisualDuration,
      composer.sendBounce,
      composer.exitDuration,
      composer.slideInDelay,
    ]
  );

  /* Seeded from `?theme=`, and kept here so the header's toggle still works:
     handing `theme` down without `onThemeChange` makes it a controlled value
     with nothing to change it, and the toggle becomes a button that does
     nothing. */
  const [theme, setTheme] = useState(requestedTheme);

  const entrance = dial["Entrance Animation"];
  const leaving = dial["Start Experience"];
  const introMotion = useMemo(
    () => ({
      staggerIn: entrance.staggerDelay,
      stiffness: entrance.stiffness,
      damping: entrance.damping,
      offsetIn: entrance.yOffset,
      blurIn: entrance.blur,
      staggerOut: leaving.staggerDelay,
      durationOut: leaving.duration,
      offsetOut: leaving.yOffset,
      blurOut: leaving.blur,
    }),
    [
      entrance.staggerDelay,
      entrance.stiffness,
      entrance.damping,
      entrance.yOffset,
      entrance.blur,
      leaving.staggerDelay,
      leaving.duration,
      leaving.yOffset,
      leaving.blur,
    ]
  );

  return (
    <ChatExperienceDemo
      logo={<Logo />}
      back={<a href="/">Back to home</a>}
      /* `?theme=dark` sets the starting theme, so a recording can be made of
         either without touching a control on the way in. */
      theme={theme}
      onThemeChange={setTheme}
      cursor
      animationConfig={animationConfig}
      foldMotion={dial["Question Fold"]}
      feedDelay={dial["Chat Feed"].delay}
      introMotion={introMotion}
    />
  );
}
