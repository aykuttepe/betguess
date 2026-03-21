import { useState, useCallback } from 'react';

interface AiPanelProps {
    title?: string;
    fetchFn: () => Promise<string>;
    buttonLabel?: string;
    autoLoad?: boolean;
}

export default function AiPanel({ title, fetchFn, buttonLabel, autoLoad }: AiPanelProps) {
    const [content, setContent] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loaded, setLoaded] = useState(false);
    const [copied, setCopied] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await fetchFn();
            setContent(result);
            setLoaded(true);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [fetchFn]);

    const handleCopy = useCallback(() => {
        if (!content) return;
        navigator.clipboard.writeText(content).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }, [content]);

    // Auto-load on mount
    if (autoLoad && !loaded && !loading && !error) {
        load();
    }

    if (!loaded && !loading && !error && !autoLoad) {
        return (
            <button
                onClick={load}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600/20 border border-purple-500/30 rounded-lg text-purple-300 hover:bg-purple-600/30 hover:text-purple-200 transition-all text-sm"
            >
                <span className="text-lg">🤖</span>
                <span>{buttonLabel || 'AI Analiz'}</span>
            </button>
        );
    }

    return (
        <div className="bg-gradient-to-br from-purple-900/20 to-indigo-900/20 border border-purple-500/20 rounded-lg overflow-hidden">
            {title && (
                <div className="px-4 py-2 bg-purple-900/30 border-b border-purple-500/20 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span>🤖</span>
                        <span className="text-sm font-medium text-purple-300">{title}</span>
                    </div>
                    {content && (
                        <button
                            onClick={handleCopy}
                            className="text-xs px-2 py-1 rounded bg-purple-700/30 text-purple-300 hover:bg-purple-600/40 hover:text-purple-200 transition-all flex items-center gap-1"
                            title="Kopyala"
                        >
                            {copied ? '✓ Kopyalandi' : '📋 Kopyala'}
                        </button>
                    )}
                </div>
            )}
            <div className="p-4">
                {loading && (
                    <div className="flex items-center gap-3 text-purple-300">
                        <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm">AI dusunuyor...</span>
                    </div>
                )}
                {error && (
                    <div className="text-red-400 text-sm">
                        <p>AI hatasi: {error}</p>
                        <button onClick={load} className="mt-2 text-purple-400 hover:text-purple-300 text-xs underline">
                            Tekrar dene
                        </button>
                    </div>
                )}
                {content && (
                    <div className="relative">
                        {/* Basliksiz panel icin kopyala butonu */}
                        {!title && (
                            <button
                                onClick={handleCopy}
                                className="absolute top-0 right-0 text-xs px-2 py-1 rounded bg-purple-700/30 text-purple-300 hover:bg-purple-600/40 hover:text-purple-200 transition-all"
                                title="Kopyala"
                            >
                                {copied ? '✓' : '📋'}
                            </button>
                        )}
                        <div className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap ai-content">
                            {renderMarkdown(content)}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

/** Basit markdown render */
function renderMarkdown(text: string) {
    return text.split('\n').map((line, i) => {
        // Headers
        if (line.startsWith('### ')) {
            return <h4 key={i} className="font-bold text-purple-300 mt-3 mb-1 text-base">{line.slice(4)}</h4>;
        }
        if (line.startsWith('## ')) {
            return <h3 key={i} className="font-bold text-purple-200 mt-4 mb-1 text-lg">{line.slice(3)}</h3>;
        }
        if (line.startsWith('# ')) {
            return <h2 key={i} className="font-bold text-white mt-4 mb-2 text-xl">{line.slice(2)}</h2>;
        }
        // Bold
        const rendered = line.replace(/\*\*(.+?)\*\*/g, '<b class="text-white">$1</b>');
        // List items
        if (line.startsWith('- ') || line.startsWith('* ')) {
            return (
                <p key={i} className="ml-4 my-0.5">
                    <span className="text-purple-400 mr-1">&bull;</span>
                    <span dangerouslySetInnerHTML={{ __html: rendered.slice(2) }} />
                </p>
            );
        }
        // Numbered list
        const numMatch = line.match(/^(\d+)\.\s/);
        if (numMatch) {
            return (
                <p key={i} className="ml-4 my-0.5">
                    <span className="text-purple-400 mr-1 font-bold">{numMatch[1]}.</span>
                    <span dangerouslySetInnerHTML={{ __html: rendered.slice(numMatch[0].length) }} />
                </p>
            );
        }
        // Empty line
        if (!line.trim()) {
            return <br key={i} />;
        }
        // Normal text
        return <p key={i} className="my-0.5" dangerouslySetInnerHTML={{ __html: rendered }} />;
    });
}
