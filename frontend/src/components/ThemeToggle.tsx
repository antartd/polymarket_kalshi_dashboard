type Props = {
  dark: boolean;
  onToggle: () => void;
};

export function ThemeToggle({ dark, onToggle }: Props) {
  return (
    <button type="button" className="button ghost" onClick={onToggle} aria-label="Toggle theme">
      {dark ? "Switch to Light" : "Switch to Dark"}
    </button>
  );
}
