type Props = {
  url: string;
};

export function ExportCsvButton({ url }: Props) {
  return (
    <a className="button" href={url} download>
      Export CSV
    </a>
  );
}
