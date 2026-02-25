import { useState, useCallback } from 'react';

export function ShareButton() {
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(async () => {
        const url = window.location.href;
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Fallback for browsers without clipboard API
            const ta = document.createElement('textarea');
            ta.value = url;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    }, []);

    return (
        <button
            type="button"
            className={`share-btn ${copied ? 'copied' : ''}`}
            onClick={handleCopy}
            title="Copy shareable link"
            aria-label="Copy shareable link"
        >
            {copied ? '✓ Copied!' : '⎘ Share'}
        </button>
    );
}
