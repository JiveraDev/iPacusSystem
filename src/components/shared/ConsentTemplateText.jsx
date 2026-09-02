import { resolveConsentTemplateSegments } from '../../lib/consentTemplateCodes';
import { cn } from '../../ui/utils';

export default function ConsentTemplateText({
    content,
    context = {},
    preview = true,
    fallback = 'No consent content available.',
    className = ''
}) {
    const segments = resolveConsentTemplateSegments(content, context, { preview });
    const hasContent = segments.some((segment) => segment.text.trim());

    return (
        <div className={cn('whitespace-pre-wrap', className)}>
            {hasContent ? segments.map((segment, index) => (
                segment.emphasized ? (
                    <strong
                        key={`${segment.token || 'token'}-${index}`}
                        className="font-bold text-current"
                        data-consent-token={segment.token || undefined}
                    >
                        {segment.text}
                    </strong>
                ) : (
                    <span key={`text-${index}`}>{segment.text}</span>
                )
            )) : fallback}
        </div>
    );
}
