/**
 * Fixed-capacity Set that evicts the oldest entry (insertion order) once the
 * capacity is exceeded. Exposes the small subset of the native Set API used
 * across the codebase (`has`, `add`, `delete`, `size`).
 *
 * Used for best-effort, per-process fast paths (idempotency / denylist caches)
 * that sit on top of an authoritative store (DB/Redis). Bounding the size
 * prevents unbounded memory growth under sustained high traffic.
 */
export class BoundedSet {
  constructor(maxSize = 50000) {
    this.maxSize = Math.max(1, Number(maxSize) || 50000);
    this._set = new Set();
  }

  has(value) {
    return this._set.has(value);
  }

  add(value) {
    if (this._set.has(value)) return this;
    if (this._set.size >= this.maxSize) {
      const oldest = this._set.values().next().value;
      if (oldest !== undefined) this._set.delete(oldest);
    }
    this._set.add(value);
    return this;
  }

  delete(value) {
    return this._set.delete(value);
  }

  get size() {
    return this._set.size;
  }
}

export default BoundedSet;
