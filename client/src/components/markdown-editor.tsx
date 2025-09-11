import { useState } from "react";
import { Eye, Edit, HelpCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  id?: string;
  "data-testid"?: string;
}

const MARKDOWN_HELP = `
**Bold** or __bold__
*Italic* or _italic_
[Link](https://example.com)
\`inline code\`

# Heading 1
## Heading 2
### Heading 3

- Unordered list
1. Ordered list

> Blockquote

\`\`\`
Code block
\`\`\`

---
Horizontal rule
`;

export function MarkdownEditor({
  value,
  onChange,
  placeholder = "Enter markdown description...",
  disabled = false,
  error,
  id,
  "data-testid": testId,
}: MarkdownEditorProps) {
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Description</Label>
        <div className="flex items-center space-x-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                data-testid="button-markdown-help"
              >
                <HelpCircle size={14} />
              </Button>
            </PopoverTrigger>
            <PopoverContent 
              className="w-80 text-xs" 
              side="left"
              data-testid="popover-markdown-help"
            >
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Markdown Quick Reference</h4>
                <div className="whitespace-pre-line text-muted-foreground font-mono">
                  {MARKDOWN_HELP.trim()}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <Tabs 
        value={activeTab} 
        onValueChange={(value) => setActiveTab(value as "edit" | "preview")}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger 
            value="edit" 
            className="flex items-center space-x-2"
            data-testid="tab-edit"
          >
            <Edit size={14} />
            <span>Edit</span>
          </TabsTrigger>
          <TabsTrigger 
            value="preview" 
            className="flex items-center space-x-2"
            data-testid="tab-preview"
          >
            <Eye size={14} />
            <span>Preview</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="edit" className="mt-3">
          <Textarea
            id={id}
            value={value}
            onChange={handleTextareaChange}
            placeholder={placeholder}
            disabled={disabled}
            rows={4}
            className="resize-y min-h-[100px] font-mono text-sm"
            data-testid={testId}
          />
        </TabsContent>
        
        <TabsContent value="preview" className="mt-3">
          <div 
            className="min-h-[100px] p-3 border rounded-md bg-background"
            data-testid="markdown-preview"
          >
            {value.trim() ? (
              <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-semibold prose-h1:text-lg prose-h2:text-base prose-h3:text-sm prose-p:text-sm prose-a:text-primary prose-strong:text-foreground prose-code:text-sm prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-muted prose-pre:text-sm prose-blockquote:border-l-primary prose-li:text-sm">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                >
                  {value}
                </ReactMarkdown>
              </div>
            ) : (
              <div className="text-muted-foreground italic text-sm">
                {placeholder}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {error && (
        <p className="text-sm text-destructive" data-testid="error-description">
          {error}
        </p>
      )}
    </div>
  );
}