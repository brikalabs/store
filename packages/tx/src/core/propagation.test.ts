import { describe, expect, test } from "bun:test";
import { TransactionError } from "./errors";
import { mandatory, never, notSupported, required, requiresNew, supports } from "./propagation";
import { inTransaction, onRollback, transaction } from "./transaction";

describe("required", () => {
  test("opens a transaction when there is none", async () => {
    const undone: string[] = [];
    expect(inTransaction()).toBe(false);
    await expect(
      transaction(
        async () => {
          expect(inTransaction()).toBe(true);
          onRollback(() => undone.push("x"));
          throw new Error("fail");
        },
        { propagation: required },
      ),
    ).rejects.toThrow("fail");
    expect(undone).toEqual(["x"]);
  });

  test("joins the active transaction (one shared scope)", async () => {
    const undone: string[] = [];
    await expect(
      transaction(async () => {
        onRollback(() => undone.push("outer"));
        await transaction(
          async () => {
            onRollback(() => undone.push("inner"));
            throw new Error("fail");
          },
          { propagation: required },
        );
      }),
    ).rejects.toThrow("fail");
    expect(undone).toEqual(["inner", "outer"]); // single scope, reverse order
  });
});

describe("requiresNew", () => {
  test("commits independently of an outer rollback", async () => {
    const events: string[] = [];
    await expect(
      transaction(async () => {
        onRollback(() => events.push("outer-undo"));
        await transaction(
          async () => {
            onRollback(() => events.push("inner-undo")); // inner succeeds -> not run
          },
          { propagation: requiresNew },
        );
        throw new Error("outer fails");
      }),
    ).rejects.toThrow("outer fails");
    expect(events).toEqual(["outer-undo"]); // inner committed; only outer rolled back
  });

  test("its own rollback does not touch the outer transaction", async () => {
    const events: string[] = [];
    await transaction(async () => {
      onRollback(() => events.push("outer-undo")); // outer commits -> not run
      await transaction(
        async () => {
          onRollback(() => events.push("inner-undo"));
          throw new Error("inner fails");
        },
        { propagation: requiresNew },
      ).catch(() => events.push("caught"));
    });
    expect(events).toEqual(["inner-undo", "caught"]); // inner rolled back; outer committed
  });

  test("is active inside (a fresh transaction)", async () => {
    let active = false;
    await transaction(async () => {
      await transaction(
        async () => {
          active = inTransaction();
        },
        { propagation: requiresNew },
      );
    });
    expect(active).toBe(true);
  });
});

describe("mandatory", () => {
  test("throws outside a transaction", async () => {
    await expect(transaction(async () => {}, { propagation: mandatory })).rejects.toBeInstanceOf(
      TransactionError,
    );
  });

  test("runs inside a transaction", async () => {
    let ran = false;
    await transaction(async () => {
      await transaction(
        async () => {
          ran = true;
        },
        { propagation: mandatory },
      );
    });
    expect(ran).toBe(true);
  });
});

describe("never", () => {
  test("runs outside a transaction", async () => {
    let ran = false;
    await transaction(
      async () => {
        ran = true;
      },
      { propagation: never },
    );
    expect(ran).toBe(true);
  });

  test("throws inside a transaction", async () => {
    await expect(
      transaction(async () => {
        await transaction(async () => {}, { propagation: never });
      }),
    ).rejects.toBeInstanceOf(TransactionError);
  });
});

describe("supports", () => {
  test("runs without a transaction outside one", async () => {
    let active = true;
    await transaction(
      async () => {
        active = inTransaction();
      },
      { propagation: supports },
    );
    expect(active).toBe(false);
  });

  test("joins an active transaction", async () => {
    let active = false;
    await transaction(async () => {
      await transaction(
        async () => {
          active = inTransaction();
        },
        { propagation: supports },
      );
    });
    expect(active).toBe(true);
  });
});

describe("notSupported", () => {
  test("suspends the active transaction; its hooks become no-ops and the outer is untouched", async () => {
    const events: string[] = [];
    let suspendedActive = true;
    await transaction(async () => {
      onRollback(() => events.push("outer-undo")); // outer commits -> not run
      await transaction(
        async () => {
          suspendedActive = inTransaction();
          onRollback(() => events.push("suspended-undo")); // no active tx -> no-op
        },
        { propagation: notSupported },
      );
    });
    expect(suspendedActive).toBe(false);
    expect(events).toEqual([]);
  });
});
