type Props = {
  message: string;
};

export function EmptyState({ message }: Props) {
  return <div className="state state-empty">{message}</div>;
}
