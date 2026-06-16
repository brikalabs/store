import { describe, expect, test } from "bun:test";
import { TransactionManager } from "./manager";
import {
  afterCommit,
  inTransaction,
  onCommit,
  onComplete,
  onRollback,
  transaction,
} from "./transaction";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Replace console.error for the duration of `fn` (some tests provoke logged faults). */
async function muteErrors(fn: () => Promise<void>): Promise<void> {
  const original = console.error;
  console.error = () => {};
  try {
    await fn();
  } finally {
    console.error = original;
  }
}

describe("basics", () => {
  test("an empty transaction commits and returns the body's value", async () => {
    expect(inTransaction()).toBe(false);
    const result = await transaction(async () => 42);
    expect(result).toBe(42);
    expect(inTransaction()).toBe(false); // context cleared afterward
  });

  test("the body runs inside the transaction", async () => {
    await transaction(async () => {
      expect(inTransaction()).toBe(true);
    });
  });
});

describe("commit hooks", () => {
  test("run in registration order on success, and not on failure", async () => {
    const log: string[] = [];
    await transaction(async () => {
      onCommit(() => log.push("c1"));
      onCommit(() => log.push("c2"));
    });
    expect(log).toEqual(["c1", "c2"]);

    log.length = 0;
    await expect(
      transaction(async () => {
        onCommit(() => log.push("c"));
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(log).toEqual([]); // commit hooks skipped on failure
  });

  test("a commit hook that throws triggers rollback and propagates its error", async () => {
    const log: string[] = [];
    await expect(
      transaction(async () => {
        onRollback(() => log.push("undo"));
        onCommit(() => {
          throw new Error("commit failed");
        });
      }),
    ).rejects.toThrow("commit failed");
    expect(log).toEqual(["undo"]); // the failed commit rolled the transaction back
  });
});

describe("rollback hooks", () => {
  test("run in reverse order on failure, and not on success", async () => {
    const log: string[] = [];
    await expect(
      transaction(async () => {
        onRollback(() => log.push("u1"));
        onRollback(() => log.push("u2"));
        onRollback(() => log.push("u3"));
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(log).toEqual(["u3", "u2", "u1"]);
  });

  test("only work registered before the fault is compensated", async () => {
    const log: string[] = [];
    await expect(
      transaction(async () => {
        onRollback(() => log.push("u1"));
        throw new Error("boom"); // a later onRollback never registers
      }),
    ).rejects.toThrow("boom");
    expect(log).toEqual(["u1"]);
  });

  test("a failing rollback step is isolated; the rest still run and the original error wins", async () => {
    const log: string[] = [];
    await muteErrors(async () => {
      await expect(
        transaction(async () => {
          onRollback(() => log.push("u1"));
          onRollback(() => {
            throw new Error("rollback fault");
          });
          onRollback(() => log.push("u3"));
          throw new Error("original");
        }),
      ).rejects.toThrow("original"); // not "rollback fault"
    });
    expect(log).toEqual(["u3", "u1"]); // both non-faulting steps ran, in reverse
  });
});

describe("completion hooks", () => {
  test("run after commit and after rollback, with the outcome, in order", async () => {
    const log: string[] = [];
    await transaction(async () => {
      onComplete((outcome) => log.push(`a:${outcome}`));
      onComplete((outcome) => log.push(`b:${outcome}`));
    });
    expect(log).toEqual(["a:committed", "b:committed"]);

    log.length = 0;
    await expect(
      transaction(async () => {
        onComplete((outcome) => log.push(`a:${outcome}`));
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(log).toEqual(["a:rolledBack"]);
  });

  test("afterCommit runs only when the transaction commits", async () => {
    const log: string[] = [];
    await transaction(async () => afterCommit(() => log.push("ok")));
    await expect(
      transaction(async () => {
        afterCommit(() => log.push("ok"));
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(log).toEqual(["ok"]);
  });

  test("a failing completion hook is swallowed and does not change the outcome", async () => {
    await muteErrors(async () => {
      await expect(
        transaction(async () => {
          onComplete(() => {
            throw new Error("hook fault");
          });
        }),
      ).resolves.toBeUndefined();
    });
  });

  test("completions still run after a rollback step itself failed", async () => {
    const log: string[] = [];
    await muteErrors(async () => {
      await expect(
        transaction(async () => {
          onRollback(() => {
            throw new Error("rollback fault");
          });
          onComplete((outcome) => log.push(outcome));
          throw new Error("boom");
        }),
      ).rejects.toThrow("boom");
    });
    expect(log).toEqual(["rolledBack"]);
  });
});

describe("rollbackOn", () => {
  test("compensates on any error by default", async () => {
    const log: string[] = [];
    await expect(
      transaction(async () => {
        onRollback(() => log.push("undo"));
        throw new Error("boom");
      }),
    ).rejects.toThrow();
    expect(log).toEqual(["undo"]);
  });

  test("skips compensation when the policy excludes the error (but still throws it)", async () => {
    const log: string[] = [];
    class Expected extends Error {}
    await expect(
      transaction(
        async () => {
          onRollback(() => log.push("undo"));
          throw new Expected("expected");
        },
        undefined,
        { rollbackOn: (error) => !(error instanceof Expected) },
      ),
    ).rejects.toBeInstanceOf(Expected);
    expect(log).toEqual([]);
  });
});

describe("hooks outside a transaction", () => {
  test("onRollback / onCommit / onComplete / afterCommit are no-ops", async () => {
    const log: string[] = [];
    onRollback(() => log.push("r"));
    onCommit(() => log.push("c"));
    onComplete(() => log.push("x"));
    afterCommit(() => log.push("a"));
    await delay(1);
    expect(log).toEqual([]);
  });
});

describe("manager isolation", () => {
  test("separate managers do not see each other's context", async () => {
    const a = new TransactionManager();
    const b = new TransactionManager();
    let bSeenFromA = true;
    await a.run(async () => {
      expect(a.active).toBe(true);
      bSeenFromA = b.active;
    });
    expect(bSeenFromA).toBe(false);
  });
});

describe("concurrency", () => {
  test("many simultaneous transactions stay isolated; only the failing ones roll back", async () => {
    const rolledBack: number[] = [];
    await Promise.allSettled(
      Array.from({ length: 20 }, (_, i) =>
        transaction(async () => {
          onRollback(() => {
            rolledBack.push(i);
          });
          await delay(i % 4); // interleave the contexts
          if (i % 2 === 0) throw new Error(String(i));
        }),
      ),
    );
    // Exactly the even indices rolled back, each once: no context crossed into another.
    expect(rolledBack.toSorted((x, y) => x - y)).toEqual([0, 2, 4, 6, 8, 10, 12, 14, 16, 18]);
  });
});
