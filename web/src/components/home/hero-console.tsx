/** A static console vignette for the hero: the same query before and after an index. */
export function HeroConsole() {
  return (
    <figure className="border-border relative overflow-hidden rounded-xl border bg-[oklch(0.17_0.032_262)] text-[oklch(0.9_0.02_250)] shadow-2xl shadow-black/20">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
        <span className="flex gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-white/15" />
          <span className="size-2.5 rounded-full bg-white/15" />
          <span className="size-2.5 rounded-full bg-white/15" />
        </span>
        <span className="font-mono text-[11px] text-white/50">
          sqlite 3.49 · wasm · round 4 of 25
        </span>
      </div>
      <pre
        role="region"
        aria-label="Illustration of one arena round"
        tabIndex={0}
        className="overflow-x-auto px-4 py-4 font-mono text-[11px] leading-[1.7] focus-visible:-outline-offset-2 sm:text-[12.5px]"
      >
        <code>
          <span className="text-white/45">sqlite&gt; </span>
          <span className="text-[oklch(0.83_0.13_80)]">EXPLAIN QUERY PLAN</span>
          {"\n"}
          <span className="text-white/45"> ...&gt; </span>SELECT COUNT(*), SUM(l_quantity){"\n"}
          <span className="text-white/45"> ...&gt; </span>FROM lineitem WHERE l_partkey = 742;{"\n"}
          <span className="text-[oklch(0.83_0.13_80)]">`--SCAN</span> lineitem
          <span className="text-white/40">{"                    "}1.62 ms</span>
          {"\n\n"}
          <span className="text-white/40">
            -- MAB · C²UCB picks arm lineitem(l_partkey, l_quantity)
          </span>
          {"\n"}
          <span className="text-white/40">-- θᵀx = 4.81 + α√(xᵀV⁻¹x) = 0.37</span>
          {"\n"}
          <span className="text-white/45">sqlite&gt; </span>
          <span className="text-[oklch(0.86_0.14_166)]">CREATE INDEX</span>{" "}
          ix_lineitem__l_partkey__l_quantity{"\n"}
          <span className="text-white/45"> ...&gt; </span>ON lineitem (l_partkey, l_quantity);
          <span className="text-white/40">{"   "}18.4 ms</span>
          {"\n\n"}
          <span className="text-[oklch(0.86_0.14_166)]">`--SEARCH</span> lineitem USING{" "}
          <span className="text-[oklch(0.86_0.14_166)]">COVERING INDEX</span>
          {"\n"}
          {"     "}ix_lineitem__l_partkey__l_quantity (l_partkey=?)
          <span className="text-white/40">{"  "}0.03 ms</span>
          <span
            className="ml-1 inline-block h-4 w-2 translate-y-[3px] animate-pulse bg-[oklch(0.86_0.14_166)]"
            aria-hidden
          />
        </code>
      </pre>
      <figcaption className="border-t border-white/10 px-4 py-2 text-[11px] text-white/50">
        Illustration of one arena round. Real runs print their own plans and timings.
      </figcaption>
    </figure>
  );
}
