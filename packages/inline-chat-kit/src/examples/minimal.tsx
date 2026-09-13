/**
 * The smallest thing that is actually a chat.
 *
 * ## Why this is a source file and not a fenced block in the docs
 *
 * `getting-started.md` quotes this file verbatim, and a test asserts the two
 * are identical character for character. So the first code a newcomer copies
 * is compiled by `tsc -b` on every build, like everything else here — a
 * getting-started whose example no longer compiles is worse than none, because
 * it fails for somebody who has no way to tell whether the mistake is theirs.
 *
 * Nothing imports it, so the library build never reaches it and it ships
 * nothing. It exists to be typechecked and quoted.
 */
import { ChatExperience } from "../index";

export function MinimalChat() {
  return (
    <ChatExperience
      /* The one thing that has to be yours. Return a string, a promise of one,
         or an async iterable of deltas — the kit has no answers of its own. */
      onSend={async (message) => `You said: ${message}`}
      /* Shown in the header until a question has been asked; after that the
         header carries the first question, so somebody arriving at a
         conversation in progress can see what it is about. */
      title="Chat"
      placeholder="Ask anything…"
      /* Before anybody has asked. The openers are sent rather than typed into
         the box: one that only fills the input asks somebody to press send on
         a sentence they did not write. */
      empty={{
        title: "Ask me anything",
        description: "Or press one of these.",
        suggestions: ["What can you do?", "Write me a haiku"],
      }}
    />
  );
}
