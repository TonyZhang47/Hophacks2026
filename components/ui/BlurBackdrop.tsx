/** Decorative organic blur shapes (Material You signature). Purely visual; hidden from AT. */
export function BlurBackdrop({ variant = "hero" }: { variant?: "hero" | "community" }) {
  const shapes =
    variant === "hero"
      ? [
          "bg-md-primary/25 w-[28rem] h-[28rem] rounded-full -top-24 -left-24",
          "bg-md-secondary-container w-[22rem] h-[22rem] rounded-[100px] rounded-tr-[20px] top-8 right-[-6rem] opacity-90",
          "bg-md-tertiary/20 w-[18rem] h-[18rem] rounded-full bottom-[-6rem] left-1/3",
        ]
      : [
          "bg-md-tertiary/25 w-[24rem] h-[24rem] rounded-full -top-20 right-[-4rem]",
          "bg-md-primary/20 w-[20rem] h-[20rem] rounded-[100px] rounded-bl-[20px] bottom-[-8rem] left-[-4rem]",
        ];
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
      {shapes.map((s, i) => (
        <div key={i} className={`absolute blur-3xl mix-blend-multiply ${s}`} />
      ))}
    </div>
  );
}
