/**
 * Copyright (c) 2026 stellar-compliance-kit
 * SPDX-License-Identifier: MIT
 */

export interface Semaphore {
  acquire(): Promise<() => void>;
}

/**
 * Creates a FIFO semaphore for concurrency control.
 */
export function createSemaphore(limit: number): Semaphore {
  if (limit !== Infinity && (!Number.isFinite(limit) || limit <= 0)) {
    throw new Error('semaphore limit must be a positive number or Infinity');
  }

  if (limit === Infinity) {
    return {
      acquire: async () => {
        let released = false;
        return () => {
          if (released) {
            return;
          }
          released = true;
        };
      },
    };
  }

  let inUse = 0;
  const queue: Array<() => void> = [];

  const drain = (): void => {
    while (inUse < limit && queue.length > 0) {
      const grant = queue.shift();
      if (!grant) {
        return;
      }
      grant();
    }
  };

  const buildRelease = (): (() => void) => {
    let released = false;
    return () => {
      if (released) {
        return;
      }
      released = true;

      if (inUse > 0) {
        inUse--;
      }
      drain();
    };
  };

  return {
    acquire: async () => {
      if (inUse < limit) {
        inUse++;
        return buildRelease();
      }

      return new Promise<() => void>((resolve) => {
        queue.push(() => {
          inUse++;
          resolve(buildRelease());
        });
      });
    },
  };
}
