import { forwardRef } from 'react';
import { Copyright } from 'lucide-react';
import logoImg from '../../assets/logo-no-bg.png';
import ConsentTemplateText from './ConsentTemplateText.jsx';

function resolveText(value, fallback = '') {
    return String(value || fallback).trim();
}

const ConsentDocument = forwardRef(function ConsentDocument({
    title,
    content,
    signatureImage,
    signerName,
    signedAt,
    veterinarianName,
    veterinarianLicense,
    representativeLabel = 'Veterinarian Name and License',
    representativeDetail,
    templateContext = {},
    variant = 'default',
    className = ''
}, ref) {
    const isCompact = variant === 'compact';
    const vetNameText = resolveText(veterinarianName, 'Veterinarian');
    const vetLicenseText = representativeDetail || (veterinarianLicense ? `License: ${veterinarianLicense}` : 'License: N/A');
    const resolvedContext = {
        ...templateContext,
        signerName,
        signedAt,
        veterinarianName,
        veterinarianLicense
    };

    return (
        <div
            ref={ref}
            className={`theme-static-light relative flex flex-col overflow-hidden border border-gray-100 bg-white font-serif text-gray-900 shadow-inner ${isCompact ? 'min-h-[680px] p-4 sm:p-6' : 'min-h-[600px] p-4 sm:p-8 lg:p-12'} ${className}`}
        >
            <div className="pointer-events-none absolute inset-0 flex rotate-12 items-center justify-center opacity-[0.03]">
                <img src={logoImg} alt="Watermark" className="w-[400px]" />
            </div>

            <div className={`flex flex-col items-center border-b-2 border-gray-900 text-center ${isCompact ? 'mb-4 pb-3' : 'mb-8 pb-6'}`}>
                <img src={logoImg} alt="iPawcus Logo" className={`mb-2 ${isCompact ? 'h-12' : 'h-16'}`} />
                <h1 className={`font-bold uppercase tracking-widest text-gray-900 ${isCompact ? 'text-xl' : 'text-2xl'}`}>Vetfocus Animal Care Clinic</h1>
                <p className={`mt-1 uppercase tracking-wider text-gray-600 ${isCompact ? 'text-[10px]' : 'text-xs'}`}>
                    Excellence in Pet Healthcare & Specialized Surgery
                </p>
            </div>

            <div className={`text-center ${isCompact ? 'mb-4' : 'mb-8'}`}>
                <h2 className={`font-bold underline decoration-1 underline-offset-4 ${isCompact ? 'text-base' : 'text-xl'}`}>
                    {resolveText(title, 'Consent Form')}
                </h2>
            </div>

            <ConsentTemplateText
                content={content}
                context={resolvedContext}
                fallback="No content available for this form."
                className={`flex-1 px-0 text-justify text-gray-800 sm:px-4 ${isCompact ? 'min-h-[220px] text-xs leading-relaxed' : 'text-sm leading-relaxed'}`}
            />

            <div className={`flex items-end justify-between gap-6 px-0 sm:px-4 ${isCompact ? 'mt-8' : 'mt-12'}`}>
                <div className={`${isCompact ? 'w-56' : 'w-72'} text-center`}>
                    <div className={`flex items-end justify-center border-b border-gray-400 pb-1 ${isCompact ? 'h-16' : 'h-20'}`}>
                        {signatureImage ? (
                            <img src={signatureImage} alt="Owner signature" className={`${isCompact ? 'max-h-16' : 'max-h-20'} max-w-full object-contain`} />
                        ) : (
                            <span className="text-xs text-gray-300">Signature placeholder</span>
                        )}
                    </div>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-wide">Owner&apos;s Electronic Signature over Printed Name</p>
                    <p className="mt-1 text-[10px] font-sans text-gray-500">{signerName || 'Printed owner name'}</p>
                    {signedAt && <p className="text-[10px] font-sans text-gray-400">{signedAt}</p>}
                </div>

                <div className={`${isCompact ? 'w-56' : 'w-72'} text-center`}>
                    <div className={`flex flex-col items-center justify-end border-b border-gray-400 pb-1 ${isCompact ? 'h-14' : 'h-20'}`}>
                        <span className="text-xs font-semibold text-gray-700">{vetNameText}</span>
                        <span className="text-[11px] font-semibold text-gray-500">{vetLicenseText}</span>
                    </div>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-wide">{representativeLabel}</p>
                </div>
            </div>

            <div className={`flex items-center justify-center gap-2 border-t border-gray-100 text-gray-400 ${isCompact ? 'mt-6 pt-3' : 'mt-12 pt-4'}`}>
                <Copyright className="size-3" />
                <span className="font-sans text-[10px] tracking-wide">
                    2026 Vetfocus Animal Care Clinic. All rights reserved.
                </span>
            </div>
        </div>
    );
});

export default ConsentDocument;
