import { Semaphore } from "../../src/services/llm/semaphore";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("Semaphore", () => {
  it("runs work immediately when under the concurrency cap", async () => {
    const sem = new Semaphore(2);
    const result = await sem.run(async () => 7);
    expect(result).toBe(7);
  });

  it("never exceeds max concurrency", async () => {
    const sem = new Semaphore(2);
    let current = 0;
    let maxSeen = 0;

    const task = async () => {
      current += 1;
      maxSeen = Math.max(maxSeen, current);
      await wait(20);
      current -= 1;
    };

    await Promise.all([sem.run(task), sem.run(task), sem.run(task), sem.run(task)]);
    expect(maxSeen).toBe(2);
  });

  it("queues callers when the cap is 1", async () => {
    const sem = new Semaphore(1);
    const order: number[] = [];
    await Promise.all([
      sem.run(async () => {
        order.push(1);
        await wait(20);
        order.push(2);
      }),
      sem.run(async () => {
        order.push(3);
      }),
    ]);
    expect(order).toEqual([1, 2, 3]);
  });

  it("releases the slot when the worker throws", async () => {
    const sem = new Semaphore(1);
    await expect(
      sem.run(async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    await expect(sem.run(async () => "ok")).resolves.toBe("ok");
  });
});
