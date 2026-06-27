import { FormattedTextEditor } from "@/components/forms/FormattedTextEditor";

type ConfirmationEmailMessageEditorProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
};

export function ConfirmationEmailMessageEditor({
  id = "confirmation-email-message",
  value,
  onChange,
}: ConfirmationEmailMessageEditorProps) {
  return (
    <FormattedTextEditor
      id={id}
      label="Message"
      value={value}
      onChange={onChange}
      minHeightClassName="min-h-[136px]"
    />
  );
}
