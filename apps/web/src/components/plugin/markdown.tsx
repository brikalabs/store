import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Props = Readonly<{ children: string }>;

export function Markdown({ children }: Props) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none prose-pre:bg-muted prose-img:rounded-lg">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
