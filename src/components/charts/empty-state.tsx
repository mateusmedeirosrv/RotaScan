export function EmptyState({
  message = "Sem dados no período selecionado.",
  height = 288,
}: {
  message?: string;
  height?: number;
}) {
  return (
    <div
      className="flex items-center justify-center text-center text-sm text-muted-foreground"
      style={{ height }}
    >
      {message}
    </div>
  );
}
