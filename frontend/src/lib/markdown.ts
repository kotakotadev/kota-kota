// Shared markdown renderer (safe — no innerHTML from untrusted raw HTML)
export function renderMarkdown(text: string): string {
  return text
    // Escape HTML first
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // Headings
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold + italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Inline code
    .replace(/`(.+?)`/g, '<code>$1</code>')
    // Images
    .replace(/!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g, '<img src="$2" alt="$1" class="md-img" />')
    // Links
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    // Blockquote
    .replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>')
    // Unordered list
    .replace(/^\- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr>')
    // Line breaks (double newline = paragraph)
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
}
