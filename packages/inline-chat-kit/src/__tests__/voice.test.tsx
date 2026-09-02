import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { ChatInput } from "../ChatInput/ChatInput";
import { useVoiceInput, type TranscribeHandler } from "../voice/useVoiceInput";

/**
 * Dictation, tested where jsdom can answer honestly.
 *
 * There is no `MediaRecorder`, no `getUserMedia` and no `AudioContext` here,
 * so all three are stood up as fakes. That is not a shortcut around the real
 * thing: what is under test is the state machine, the wiring and the release
 * of hardware, none of which is jsdom's to get right.
 *
 * **The microphone button itself is not driven here, and that is deliberate.**
 * It is a child of the composer's `AnimatePresence`, and Motion's animations
 * never complete in jsdom — an exit that never finishes leaves that presence
 * rendering stored children, and the flag its siblings come back on is
 * restored from an `onExitComplete` that never fires. Clicking it in here
 * tests jsdom's handling of Motion, not this kit. So the state machine is
 * driven through `useVoiceInput` directly, which has no Motion in it, and the
 * button's own states — its label, whether it is disabled, the refusal note —
 * are checked in a real browser by `tools/voice/check.mjs`, which reports
 * `denied` / "Microphone blocked" / disabled where this file cannot.
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

});

function Probe({ onTranscribe }: { onTranscribe?: TranscribeHandler }) {
  const [text, setText] = useState("");
  const [done, setDone] = useState("");
  const voice = useVoiceInput({ onTranscribe, onTranscript: setText, onDone: setDone });
  return (
    <div>
      <span data-testid="state">{voice.state}</span>
      <span data-testid="error">{voice.error ?? ""}</span>
      <span data-testid="text">{text}</span>
      <span data-testid="done">{done}</span>
      <button onClick={() => voice.toggle()}>toggle</button>
    </div>
  );
}

const at = (id: string) => screen.getByTestId(id).textContent;
const press = async (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole("button", { name: "toggle" }));

describe("a refusal", () => {
  it("is a state of its own, not an error", async () => {
    // The browser will not raise its prompt again, so this has to be somewhere
    // the composer can read and say so in words — "try again" would be a lie.
    getUserMedia.mockRejectedValueOnce(Object.assign(new Error("no"), { name: "NotAllowedError" }));
    const user = userEvent.setup();
    render(<Probe onTranscribe={async () => "ok"} />);
    await press(user);
    await waitFor(() => expect(at("state")).toBe("denied"));
    expect(at("error")).toBe("");
  });

  it("is told apart from a missing microphone", async () => {
    getUserMedia.mockRejectedValueOnce(Object.assign(new Error("none"), { name: "NotFoundError" }));
    const user = userEvent.setup();
    render(<Probe onTranscribe={async () => "ok"} />);
    await press(user);
    await waitFor(() => expect(at("state")).toBe("failed"));
    expect(at("error")).toMatch(/no microphone was found/i);
  });
});

describe("what comes back", () => {
  it("accumulates deltas rather than stacking them", async () => {
    const user = userEvent.setup();
    render(
      <Probe
        onTranscribe={async function* () {
          yield "one ";
          yield "two ";
          yield "three";
        }}
      />
    );
    await press(user);
    await waitFor(() => expect(at("state")).toBe("listening"));
    await act(async () => { recorder!.stop(); });
    // Not "one one two one two three": the caller is handed the whole run each
    // time, because it is putting this inside a string it already holds.
    await waitFor(() => expect(at("text")).toBe("one two three"));
    expect(at("done")).toBe("one two three");
  });

  it("treats an empty transcript as nothing said rather than as a failure", async () => {
    const user = userEvent.setup();
    render(<Probe onTranscribe={async () => ""} />);
    await press(user);
    await waitFor(() => expect(at("state")).toBe("listening"));
    await act(async () => { recorder!.stop(); });
    await waitFor(() => expect(at("state")).toBe("idle"));
    expect(at("error")).toBe("");
  });
});

describe("the hardware", () => {
  it("is handed back when the recording stops", async () => {
    const user = userEvent.setup();
    render(<Probe onTranscribe={async () => "ok"} />);
    await press(user);
    await waitFor(() => expect(at("state")).toBe("listening"));
    await act(async () => { recorder!.stop(); });
    // A leaked object URL costs memory. A microphone left open puts a recording
    // indicator in the reader's browser chrome and keeps it there.
    await waitFor(() => expect(stoppedTracks).toBe(1));
    expect(closedContexts).toBe(1);
  });

  it("is handed back when the component goes away mid-recording", async () => {
    const user = userEvent.setup();
    const view = render(<Probe onTranscribe={async () => "ok"} />);
    await press(user);
    await waitFor(() => expect(at("state")).toBe("listening"));
    view.unmount();
    expect(stoppedTracks).toBe(1);
  });
});
