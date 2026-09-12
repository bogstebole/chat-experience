# Skills in this repository

Two sets, and they answer different questions.

## `motion/`

The Motion library's own skill — how to write `motion/react` correctly, which
API to reach for, how to measure a runtime performance problem. It is about
**the tool**.

## The rest

Emil Kowalski's skills for design engineers, vendored from
[`emilkowalski/skills`](https://github.com/emilkowalski/skills) at commit
`d23d7f8` (2026-08-21), MIT licensed — see `LICENSE-emilkowalski`. They are
about **the judgement**: whether a thing should animate at all, which curve,
how long, from which origin, and when motion is the wrong answer.

| | |
| --- | --- |
| `emil-design-eng` | The philosophy the rest derive from. UI polish, component design, the invisible details. |
| `animate` | Build one animation, deciding in the order that decides whether it feels right. |
| `animate-expo` | The same for React Native and Expo. Kept for the open question about building this natively. |
| `review-animations` | Review motion code against a strict bar. Approval is earned. Explicit invocation only. |
| `improve-animations` | Audit a whole codebase's motion and produce a prioritised plan. Read-only. |
| `find-animation-opportunities` | Where motion is missing and would earn its place — and where it would not. |
| `animation-vocabulary` | The name for the effect you can describe but cannot name. |
| `apple-design` | Apple's interface and motion principles, translated for the web. |
| `prototype` | Several genuinely different versions behind a picker, to choose by feel. Explicit invocation only. |
| `pick-ui-library` | Which library for a given job. Explicit invocation only. |

Two of the upstream skills are not here: `ask-sonner` (this repo has no Sonner)
and `write-swift` (no Swift). Add them from upstream if that changes.

## Vendored rather than installed

`npx skills@latest add emilkowalski/skills` is the upstream install. These are
copied in instead, for two reasons.

A skill is **instructions that steer an agent** — the same surface as a prompt
injection, arriving from the network. Vendoring puts every line in the diff,
so a human reviews what the agent will be told, once, rather than trusting a
fetch. Scanned before they went in: no network calls, no shell execution, no
reach for credentials. The only mentions of "ignore previous instructions" are
the skills defending against it.

And it pins the version. An install command resolves to whatever is upstream
that day, so two people on this repo would get different advice from the same
command. This way the review standard is a fact about the commit.

To update: clone upstream, diff, copy, and say in the commit message what
changed and why the new advice is wanted.

## How they are used here

`review-animations` and `improve-animations` are read-only and marked
`disable-model-invocation`, so they run when asked for and not before. The
natural moments are a motion change going in, and the animation-polish pass
this project has deliberately deferred to the end.

The checks in `tools/` are not a substitute for them and do not overlap: those
measure whether an animation **runs** — that the pane's document is laid out
once rather than re-wrapping per frame, that the way-back button travels
instead of teleporting, that a sheet's drag dismisses it. None of them can say
whether the motion is *right*. That is what these are for.
