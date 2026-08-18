export function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-r border-[#27454d] px-3 py-[14px] last:border-r-0 max-[760px]:border-b max-[760px]:last:border-r">
      <dt className="m-0 font-mono text-[0.55rem] tracking-[0.09em] text-[#648087]">
        {label}
      </dt>
      <dd className="mt-[5px] overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[0.67rem] text-[#d8e8eb]">
        {value}
      </dd>
    </div>
  );
}
