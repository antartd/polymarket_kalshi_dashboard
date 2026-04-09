type Props = {
  message: string;
};

export function ErrorState({ message }: Props) {
  return <div className="state state-error">Error: {message}</div>;
}
