import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { ChatInput } from "../ChatInput/ChatInput";
import type { TranscribeHandler } from "../voice/useVoiceInput";

/**
 * Dictation, tested where jsdom can answer honestly.
 *
 * There is no `MediaRecorder`, no `getUserMedia` and no `AudioContext` here,
 * so all three are stood up as fakes. That is not a shortcut around the real
 * thing: what is under test is the state machine, the wiring and the release
 * of hardware, none of which is jsdom's to get right. The parts that need a
 * real microphone — whether the level meter reads a room, whether a browser
 * shows its prompt — are not asserted, because a passing tick for those would
 * be a lie about untested code.
 */

type Recorder = {
  state: string;
  mimeType: string;
  ondataavailable: ((e: { data: Blob }) => void) | null;
  onstop: (() => void) | null;
  start: () => void;
  stop: () => void;
};

let recorder: Recorder | null = null;
let stoppedTracks = 0;
let closedContexts = 0;
let getUserMedia: ReturnType<typeof vi.fn>;

const installMedia = () => {
  stoppedTracks = 0;
  closedContexts = 0;
  recorder = null;

  getUserMedia = vi.fn(async () => ({
    getTracks: () => [{ stop: () => { stoppedTracks += 1; } }],
  }));

  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia },
  });

  class FakeRecorder implements Recorder {
    state = "inactive";
    mimeType = "audio/webm";
    ondataavailable: ((e: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;
    constructor() {
      recorder = this as unknown as Recorder;
    }
    start() {
      this.state = "recording";
    }
    stop() {
      this.state = "inactive";
      this.ondataavailable?.({ data: new Blob(["audio"], { type: "audio/webm" }) });
      this.onstop?.();
    }
    static isTypeSupported() {
      return true;
    }
  }

  (window as unknown as { MediaRecorder: unknown }).MediaRecorder = FakeRecorder;
  (window as unknown as { AudioContext: unknown }).AudioContext = class {
    createAnalyser() {
      return { fftSize: 512, getByteTimeDomainData: () => {} };
    }
    createMediaStreamSource() {
      return { connect: () => {} };
    }
    close() {
      closedContexts += 1;
      return Promise.resolve();
    }
  };
};

const uninstallMedia = () => {
  Reflect.deleteProperty(navigator, "mediaDevices");
  Reflect.deleteProperty(window, "MediaRecorder");
  Reflect.deleteProperty(window, "AudioContext");
};

function Composer({ onTranscribe, initial = "" }: { onTranscribe?: TranscribeHandler; initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <ChatInput
      state={value ? "typing" : "idle"}
      value={value}
      onChange={setValue}
      onSubmit={() => {}}
      onTranscribe={onTranscribe}
      placeholder="Ask"
    />
  );
}

const mic = () => screen.queryByRole("button", { name: /dictate a message/i });

beforeEach(() => {
  installMedia();
  // The live region is one node shared by the whole page and it outlives a
  // render, so a message announced by one case is still sitting there for the
  // next one to find. Emptied rather than removed: `announce` reuses it.
  document
    .querySelectorAll('[data-inline-chat-kit="live-region"]')
    .forEach((node) => { node.textContent = ""; });
});
afterEach(uninstallMedia);

describe("whether there is a microphone at all", () => {
  it("offers none without a handler to transcribe with", () => {
    render(<Composer />);
    expect(mic()).toBeNull();
  });

  it("offers one when a handler is given", async () => {
    render(<Composer onTranscribe={async () => "ok"} />);
    await waitFor(() => expect(mic()).not.toBeNull());
  });

  it("offers none where the browser cannot record", async () => {
    // An insecure context, or a browser without `getUserMedia`. A button that
    // can only fail is worse than no button.
    uninstallMedia();
    render(<Composer onTranscribe={async () => "ok"} />);
    await new Promise((done) => setTimeout(done, 0));
    expect(mic()).toBeNull();
  });

  it("stays once there is text, because that is the case worth dictating into", async () => {
    // The first design put the microphone in the send glyph's slot, which is
    // empty exactly while the composer is — so it disappeared the moment
    // anything was typed, including the first dictated word. Dictating into a
    // half-written sentence is what "insert at the caret" is for.
    render(<Composer onTranscribe={async () => "ok"} initial="typed" />);
    await waitFor(() => expect(screen.getByRole("button", { name: /send message/i })).toBeTruthy());
    expect(mic()).not.toBeNull();
  });
});

describe("a refusal", () => {
  it("says so in words and stops offering the button", async () => {
    getUserMedia.mockRejectedValueOnce(
      Object.assign(new Error("no"), { name: "NotAllowedError" })
    );
    const user = userEvent.setup();
    render(<Composer onTranscribe={async () => "ok"} />);
    await waitFor(() => expect(mic()).not.toBeNull());
    await user.click(mic()!);

    // The browser will not raise its prompt again, so "try again" would be a
    // lie and silence would be worse. The control stays, disabled, beside a
    // line saying where to undo it.
    await waitFor(() =>
      expect(screen.getByText(/microphone access is blocked/i)).toBeTruthy()
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /microphone blocked/i })).toBeDisabled()
    );
  });

  it("is told apart from a missing microphone", async () => {
    getUserMedia.mockRejectedValueOnce(
      Object.assign(new Error("none"), { name: "NotFoundError" })
    );
    const user = userEvent.setup();
    render(<Composer onTranscribe={async () => "ok"} />);
    await waitFor(() => expect(mic()).not.toBeNull());
    await user.click(mic()!);
    await waitFor(() => expect(screen.getByText(/no microphone was found/i)).toBeTruthy());
  });
});

describe("what comes back", () => {
  it("lands where the caret was, not at the end", async () => {
    const user = userEvent.setup();
    // Started from a value rather than typed in: the editor is
    // `contenteditable="plaintext-only"`, and jsdom does not implement
    // `isContentEditable`, which is the property user-event checks before it
    // will type. Typing is covered by the composer's own tests, in a real
    // browser; what this one is about is where the transcript goes.
    render(<Composer onTranscribe={async () => "spoken"} initial="before after" />);
    await waitFor(() => expect(mic()).not.toBeNull());

    const editor = document.querySelector("[contenteditable]") as HTMLElement;
    expect(editor.textContent).toBe("before after");

    // Caret between the two words.
    const range = document.createRange();
    range.setStart(editor.firstChild!, 7);
    range.collapse(true);
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);
    // The event a browser raises for this. The composer listens for it because
    // pressing the microphone takes focus off the editor and the selection
    // with it, so the position has to be remembered before the press.
    document.dispatchEvent(new Event("selectionchange"));

    await user.click(mic()!);
    await act(async () => {
      recorder!.stop();
    });

    // Not "before afterspoken", which is what appending to the end gives, and
    // which loses the point of dictating into a half-written message.
    await waitFor(() => expect(editor.textContent).toBe("before spokenafter"));
  });

  it("accumulates deltas rather than stacking them", async () => {
    const user = userEvent.setup();
    render(
      <Composer
        onTranscribe={async function* () {
          yield "one ";
          yield "two ";
          yield "three";
        }}
      />
    );
    await waitFor(() => expect(mic()).not.toBeNull());
    await user.click(mic()!);
    await act(async () => {
      recorder!.stop();
    });

    const editor = document.querySelector("[contenteditable]") as HTMLElement;
    // Not "one one two one two three", which is what putting each delta in
    // beside the last one produces.
    await waitFor(() => expect(editor.textContent).toBe("one two three"));
  });

  it("treats an empty transcript as nothing said rather than as a failure", async () => {
    const user = userEvent.setup();
    render(<Composer onTranscribe={async () => ""} />);
    await waitFor(() => expect(mic()).not.toBeNull());
    await user.click(mic()!);
    await act(async () => {
      recorder!.stop();
    });
    await waitFor(() => expect(mic()).not.toBeNull());
    // Only what is on the page: the live region is a running log and still
    // holds whatever the case before this one announced.
    expect(
      screen.queryByText(/could not/i, { ignore: '[data-inline-chat-kit="live-region"],script,style' })
    ).toBeNull();
  });
});

describe("the hardware", () => {
  it("is handed back when the recording stops", async () => {
    const user = userEvent.setup();
    render(<Composer onTranscribe={async () => "ok"} />);
    await waitFor(() => expect(mic()).not.toBeNull());
    await user.click(mic()!);
    await act(async () => {
      recorder!.stop();
    });

    // A leaked object URL costs memory. A microphone left open puts a
    // recording indicator in the reader's browser chrome and keeps it there.
    await waitFor(() => expect(stoppedTracks).toBe(1));
    expect(closedContexts).toBe(1);
  });

  it("is handed back when the composer goes away mid-recording", async () => {
    const user = userEvent.setup();
    const view = render(<Composer onTranscribe={async () => "ok"} />);
    await waitFor(() => expect(mic()).not.toBeNull());
    await user.click(mic()!);
    await waitFor(() => expect(getUserMedia).toHaveBeenCalled());
    view.unmount();
    expect(stoppedTracks).toBe(1);
  });
});
