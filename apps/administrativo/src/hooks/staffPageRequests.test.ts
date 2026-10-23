import { describe, expect, it, vi } from "vitest";
import type { Page } from "@grownupsvet/api-client";
import { createStaffPageRequestRunner } from "./staffPageRequests";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((accept, deny) => {
    resolve = accept;
    reject = deny;
  });
  return { promise, resolve, reject };
}

const page: Page<string> = {
  items: ["new query"],
  page: 0,
  size: 20,
  totalElements: 1,
  totalPages: 1,
};
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

describe("staff page request coordination", () => {
  it("reuses the confirmed initial page without a duplicate request, including effect replay", async () => {
    const run = createStaffPageRequestRunner<string>("all:0");
    const load = vi.fn(async () => page);
    const callbacks = {
      onStarted: vi.fn(),
      onResolved: vi.fn(),
      onRejected: vi.fn(),
    };
    const request = {
      queryKey: "all:0",
      forceReload: false,
      load,
      ...callbacks,
    };
    run(request)();
    run(request);
    await flush();
    expect(load).not.toHaveBeenCalled();
    expect(callbacks.onStarted).not.toHaveBeenCalled();

    run({ ...request, forceReload: true });
    await vi.waitFor(() =>
      expect(callbacks.onResolved).toHaveBeenCalledWith(page),
    );
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("ignores a previous filter/date response that arrives after the new query", async () => {
    const run = createStaffPageRequestRunner<string>();
    const older = deferred<Page<string>>();
    const newer = deferred<Page<string>>();
    let oldSignal!: AbortSignal;
    const onResolved = vi.fn();
    const onRejected = vi.fn();
    const callbacks = { onStarted: vi.fn(), onResolved, onRejected };
    run({
      queryKey: "2026-10-22:2",
      forceReload: false,
      load: (signal) => {
        oldSignal = signal;
        return older.promise;
      },
      ...callbacks,
    });
    await flush();
    run({
      queryKey: "2026-10-23:0",
      forceReload: false,
      load: () => newer.promise,
      ...callbacks,
    });
    await flush();
    newer.resolve(page);
    await vi.waitFor(() => expect(onResolved).toHaveBeenCalledOnce());
    older.resolve({ ...page, items: ["old query"] });
    await flush();
    expect(oldSignal.aborted).toBe(true);
    expect(onResolved).toHaveBeenCalledExactlyOnceWith(page);
    expect(onRejected).not.toHaveBeenCalled();
  });

  it("isolates a retry of the same query from a late error and late cleanup", async () => {
    const run = createStaffPageRequestRunner<string>();
    const older = deferred<Page<string>>();
    const newer = deferred<Page<string>>();
    let newSignal!: AbortSignal;
    const callbacks = {
      onStarted: vi.fn(),
      onResolved: vi.fn(),
      onRejected: vi.fn(),
    };
    const cancelOlder = run({
      queryKey: "ACTIVE:1",
      forceReload: true,
      load: () => older.promise,
      ...callbacks,
    });
    await flush();
    run({
      queryKey: "ACTIVE:1",
      forceReload: true,
      load: (signal) => {
        newSignal = signal;
        return newer.promise;
      },
      ...callbacks,
    });
    await flush();
    cancelOlder();
    older.reject(new Error("late failure"));
    newer.resolve(page);
    await vi.waitFor(() =>
      expect(callbacks.onResolved).toHaveBeenCalledExactlyOnceWith(page),
    );
    expect(newSignal.aborted).toBe(false);
    expect(callbacks.onRejected).not.toHaveBeenCalled();
  });

  it("does not reuse the original seed after leaving its filter/page", async () => {
    const run = createStaffPageRequestRunner<string>("all:0");
    const load = vi.fn(async () => page);
    const callbacks = {
      onStarted: vi.fn(),
      onResolved: vi.fn(),
      onRejected: vi.fn(),
    };
    run({ queryKey: "ACTIVE:0", forceReload: false, load, ...callbacks });
    await vi.waitFor(() =>
      expect(callbacks.onResolved).toHaveBeenCalledTimes(1),
    );
    run({ queryKey: "all:0", forceReload: false, load, ...callbacks });
    await vi.waitFor(() =>
      expect(callbacks.onResolved).toHaveBeenCalledTimes(2),
    );
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("never publishes results after teardown", async () => {
    const run = createStaffPageRequestRunner<string>();
    const pending = deferred<Page<string>>();
    const callbacks = {
      onStarted: vi.fn(),
      onResolved: vi.fn(),
      onRejected: vi.fn(),
    };
    const cancel = run({
      queryKey: "all:0",
      forceReload: false,
      load: () => pending.promise,
      ...callbacks,
    });
    await flush();
    cancel();
    pending.resolve(page);
    await flush();
    expect(callbacks.onResolved).not.toHaveBeenCalled();
    expect(callbacks.onRejected).not.toHaveBeenCalled();
  });
});
