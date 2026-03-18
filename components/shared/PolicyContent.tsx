"use client";

import { useState, useEffect } from "react";

interface PolicyContentProps {
  filePath: string;
  title: string;
}

export default function PolicyContent({ filePath, title }: PolicyContentProps) {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPolicy() {
      try {
        const response = await fetch(filePath);
        if (!response.ok) {
          throw new Error("Failed to load policy content");
        }
        const text = await response.text();
        setContent(text);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    loadPolicy();
  }, [filePath]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent"></div>
          <p className="text-slate-400">Loading {title}...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-red-400">Failed to load {title}</p>
          <p className="text-slate-400">{error}</p>
        </div>
      </div>
    );
  }

  // Convert markdown to HTML (simple conversion for headings, paragraphs, lists)
  const htmlContent = content
    .replace(/^# (.*$)/gm, '<h1 class="text-3xl font-bold text-white mb-6 mt-8">$1</h1>')
    .replace(/^## (.*$)/gm, '<h2 class="text-2xl font-semibold text-white mb-4 mt-6">$1</h2>')
    .replace(/^### (.*$)/gm, '<h3 class="text-xl font-semibold text-white mb-3 mt-4">$1</h3>')
    .replace(/^\*\*(.*)\*\*/gm, '<strong class="text-white">$1</strong>')
    .replace(/^\*(.*)\*/gm, '<em class="text-slate-300">$1</em>')
    .replace(/^- (.*$)/gm, '<li class="text-slate-300 ml-6 mb-1">$1</li>')
    .replace(/^\d+\. (.*$)/gm, '<li class="text-slate-300 ml-6 mb-1">$1</li>')
    .replace(/^---$/gm, '<hr class="border-border my-8">')
    .replace(/^\*\*\*$/gm, '<hr class="border-border my-8">')
    .replace(/`([^`]+)`/g, '<code class="bg-navy-700 px-2 py-1 rounded text-accent font-mono text-sm">$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-accent hover:underline" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/^(?!<[h|l|u|c|p|<])(.+)$/gm, '<p class="text-slate-300 mb-4 leading-relaxed">$1</p>');

  // Simple list processing - wrap consecutive li tags
  const processedContent = htmlContent
    .replace(/(<li class="text-slate-300 ml-6 mb-1">.*?<\/li>)+/g, (match) => {
      // Simple heuristic: if any item starts with a number, it's an ordered list
      if (match.match(/^\d+\./m)) {
        return `<ol class="list-decimal mb-4">${match}</ol>`;
      }
      return `<ul class="list-disc mb-4">${match}</ul>`;
    })
    .replace(/<p><h/g, '<h')
    .replace(/<\/h[1-6]><\/p>/g, '</h$1>')
    .replace(/<p><ul/g, '<ul')
    .replace(/<\/ul><\/p>/g, '</ul>')
    .replace(/<p><ol/g, '<ol')
    .replace(/<\/ol><\/p>/g, '</ol')
    .replace(/<p><hr/g, '<hr')
    .replace(/<\/hr><\/p>/g, '</hr>');

  return (
    <div className="min-h-screen bg-navy-900">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">{title}</h1>
          <p className="text-slate-400">
            Last Updated: {content.match(/\*\*Last Updated:\*\* (.*)/)?.[1] || "Unknown"}
          </p>
        </div>
        
        <div 
          className="prose prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
        
        <div className="mt-12 pt-8 border-t border-border">
          <p className="text-slate-400 text-sm">
            If you have questions about this {title.replace(" Policy", "")}, please contact us at{" "}
            <a href="mailto:privacy@flyhome.ai" className="text-accent hover:underline">
              privacy@flyhome.ai
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
