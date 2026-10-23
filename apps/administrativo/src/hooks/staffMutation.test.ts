import { describe, expect, it, vi } from "vitest";
import type { ApiRequestContext } from "@grownupsvet/api-client";
import { createStaffMutationRunner } from "./staffMutation";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function setup() {
  let active = 1;
  const runner = createStaffMutationRunner({
    captureContext: () => ({ generation: active, token: `token-${active}` }),
    isContextCurrent: (context) => context.generation === active,
  });
  const callbacks = {
    onStarted: vi.fn(),
    onResolved: vi.fn(),
    onRejected: vi.fn(),
    onFinished: vi.fn(),
  };
  return {
    runner,
    callbacks,
    switchSession: () => {
      active += 1;
    },
  };
}

describe("staff mutation coordination", () => {
  it("captures one session before writing and rejects double submissions", async () => {
    const { runner, callbacks } = setup();
    const request = deferred<string>();
    const write = vi.fn((_context: ApiRequestContext) => request.promise);
    const first = runner.run({ ...callbacks, write });
    await runner.run({ ...callbacks, write });
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith({ generation: 1, token: "token-1" });
    request.resolve("saved");
    await first;
    expect(callbacks.onResolved).toHaveBeenCalledWith("saved", {
      generation: 1,
      token: "token-1",
    });
    expect(callbacks.onFinished).toHaveBeenCalledTimes(1);
  });
  it("ignores a successful A write after B signs in: no success, navigation, follow-up reads or pending state update", async () => {
    const { runner, callbacks, switchSession } = setup();
    const request = deferred<string>();
    const first = runner.run({ ...callbacks, write: () => request.promise });
    switchSession();
    request.resolve("saved-A");
    await first;
    expect(callbacks.onResolved).not.toHaveBeenCalled();
    expect(callbacks.onRejected).not.toHaveBeenCalled();
    expect(callbacks.onFinished).not.toHaveBeenCalled();
  });
  it("ignores an A failure after B signs in", async () => {
    const { runner, callbacks, switchSession } = setup();
    const request = deferred<string>();
    const first = runner.run({ ...callbacks, write: () => request.promise });
    switchSession();
    request.reject(new Error("A lost response"));
    await first;
    expect(callbacks.onRejected).not.toHaveBeenCalled();
    expect(callbacks.onFinished).not.toHaveBeenCalled();
  });
  it("drops all continuations on unmount without pretending the server write rolled back", async () => {
    const { runner, callbacks } = setup();
    const request = deferred<string>();
    const first = runner.run({ ...callbacks, write: () => request.promise });
    runner.cancel();
    request.resolve("server saved");
    await first;
    expect(callbacks.onResolved).not.toHaveBeenCalled();
    expect(callbacks.onFinished).not.toHaveBeenCalled();
  });
  it("does not repeat a failed operation automatically and permits an explicit new operation", async () => {
    const { runner, callbacks } = setup();
    const failure = new TypeError("Lost response");
    const write = vi.fn().mockRejectedValue(failure);
    await runner.run({ ...callbacks, write });
    expect(write).toHaveBeenCalledTimes(1);
    expect(callbacks.onRejected).toHaveBeenCalledWith(failure);
    await runner.run({ ...callbacks, write: async () => "manually confirmed" });
    expect(callbacks.onResolved).toHaveBeenCalledTimes(1);
  });
  it("a late cancelled operation cannot release the lock of a newer operation", async () => {
    const { runner, callbacks } = setup();
    const old = deferred<string>();
    const newer = deferred<string>();
    const first = runner.run({ ...callbacks, write: () => old.promise });
    runner.cancel();
    const second = runner.run({ ...callbacks, write: () => newer.promise });
    old.resolve("old");
    await first;
    const duplicate = vi.fn(async () => "duplicate");
    await runner.run({ ...callbacks, write: duplicate });
    expect(duplicate).not.toHaveBeenCalled();
    newer.resolve("new");
    await second;
    expect(callbacks.onResolved).toHaveBeenCalledTimes(1);
    expect(callbacks.onResolved.mock.calls[0][0]).toBe("new");
  });
});
