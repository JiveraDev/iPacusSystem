import { useState } from 'react';
import { Award, Printer, ShieldCheck } from 'lucide-react';
import navigationLogo from '../../assets/circular_logo.png';
import { fetchProtectedImageObjectUrl } from '../../lib/image';
import { toast } from '../../reusecomponent/toast.jsx';
import { Button } from '../../ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '../../ui/dialog';
import ProtectedImage from './ProtectedImage.jsx';

const DEFAULT_MEDICAL_CERTIFICATE_STATEMENT = "Based on the clinical examination performed on the date stated, the patient was clinically stable at the time of examination. This certificate records the attending veterinarian's findings and does not by itself serve as travel, quarantine, vaccination, or disease-free clearance.";

function certificateDate(value) {
    if (!value) return 'Not provided';

    const normalized = /^\d{4}-\d{2}-\d{2}$/.test(String(value))
        ? `${value}T00:00:00`
        : value;
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return String(value);

    return new Intl.DateTimeFormat('en-PH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }).format(date);
}

function certificatePetFacts(certificate) {
    const pet = certificate?.pet || {};

    return [
        ['Registration ID', pet.publicId || pet.id || 'Not provided'],
        ['Species', pet.species || 'Not provided'],
        ['Breed', pet.breed || 'Not provided'],
        ['Sex / gender', pet.gender || 'Not provided'],
        ['Birth date', certificateDate(pet.birthDate)],
        ['Color / markings', pet.colorMarking || 'Not provided'],
        ['Microchip ID', pet.microchipId || 'Not recorded'],
        ['Registered owner', certificate?.owner?.name || 'Pet owner']
    ];
}

function certificateStatement(certificate) {
    const statement = certificate?.statement
        || certificate?.certificationStatement
        || certificate?.certification_statement
        || '';

    if (String(statement).trim()) return String(statement).trim();

    return certificate?.type === 'medical'
        ? DEFAULT_MEDICAL_CERTIFICATE_STATEMENT
        : '';
}

function certificateFinding(certificate) {
    const finding = certificate?.clinicalFindings || certificateStatement(certificate);
    return String(finding || '').trim() || DEFAULT_MEDICAL_CERTIFICATE_STATEMENT;
}

function statusPresentation(status) {
    switch (String(status || '').toLowerCase()) {
        case 'active':
        case 'registered':
            return { label: status === 'registered' ? 'Registered' : 'Active', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
        case 'expired':
            return { label: 'Expired', className: 'bg-rose-50 text-rose-700 border-rose-200' };
        case 'superseded':
            return { label: 'Superseded', className: 'bg-slate-100 text-slate-600 border-slate-200' };
        case 'revoked':
            return { label: 'Revoked', className: 'bg-rose-50 text-rose-700 border-rose-200' };
        default:
            return { label: 'Issued', className: 'bg-blue-50 text-blue-700 border-blue-200' };
    }
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function printCertificateHtml(certificate, signatureSrc = '') {
    const isMedical = certificate?.type === 'medical';
    const pet = certificate?.pet || {};
    const clinic = certificate?.clinic || {};
    const veterinarian = certificate?.veterinarian || {};
    const statement = certificateStatement(certificate);
    const finding = certificateFinding(certificate);
    const logoUrl = new URL(navigationLogo, window.location.href).href;
    const facts = certificatePetFacts(certificate)
        .map(([label, value]) => `<div class="fact"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`)
        .join('');
    const medicalStatement = isMedical ? `
        <section class="certification-statement">
            <p class="eyebrow">Clinical findings</p>
            <p class="statement-text">${escapeHtml(finding)}</p>
        </section>
    ` : '';
    const medicalDetails = isMedical ? `
        <section class="signature">
            ${signatureSrc ? `<img src="${escapeHtml(signatureSrc)}" alt="Veterinarian signature">` : '<div class="signature-space"></div>'}
            <strong>${escapeHtml(veterinarian.name || 'Clinic veterinarian')}</strong>
            <span>Attending Veterinarian${veterinarian.licenseNumber ? ` &middot; PRC ${escapeHtml(veterinarian.licenseNumber)}` : ''}</span>
        </section>
    ` : '';

    return `<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>${escapeHtml(certificate.title || 'Pet certificate')}</title>
    <style>
        @page { size: A4 portrait; margin: 8mm; }
        * { box-sizing: border-box; }
        body { margin: 0; color: #0f172a; background: #fff; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        .sheet { position: relative; height: 279mm; min-height: 279mm; overflow: hidden; border: 2px solid #155dfc; padding: 9mm 11mm 8mm; background: #fff; break-inside: avoid; page-break-inside: avoid; }
        .sheet::before { content: ""; position: absolute; inset: 6px; border: 1px solid #bfdbfe; pointer-events: none; }
        .watermark { position: absolute; width: 118mm; height: 118mm; object-fit: contain; opacity: .045; left: 50%; top: 51%; transform: translate(-50%, -50%); filter: grayscale(1); }
        .content { position: relative; z-index: 1; display: flex; height: 100%; min-height: 0; flex-direction: column; }
        header { text-align: center; padding: 1mm 8mm 4mm; border-bottom: 1px solid #dbeafe; }
        header img { width: 16mm; height: 16mm; object-fit: contain; }
        .clinic { margin: 1mm 0 0; color: #155dfc; font-weight: 800; font-size: 14px; letter-spacing: .02em; }
        .address { margin: .5mm 0 0; color: #64748b; font-size: 8px; }
        h1 { margin: 4mm 0 1mm; text-align: center; font-family: Georgia, "Times New Roman", serif; font-size: 24px; letter-spacing: .07em; text-transform: uppercase; }
        .certificate-number { margin: 0; color: #64748b; font-size: 9px; letter-spacing: .14em; text-align: center; text-transform: uppercase; }
        .certify-label { margin: 3mm 0 1mm; color: #64748b; font-family: Georgia, "Times New Roman", serif; font-size: 11px; text-align: center; }
        .pet-name { margin: 0 0 1mm; text-align: center; color: #155dfc; font-family: Georgia, "Times New Roman", serif; font-size: 34px; line-height: 1; text-transform: uppercase; }
        .rule { width: 48mm; height: 2px; margin: 0 auto 3mm; background: #155dfc; }
        .lead { max-width: 150mm; margin: 0 auto 4mm; color: #334155; font-family: Georgia, "Times New Roman", serif; font-size: 11px; line-height: 1.55; text-align: center; }
        .certification-statement { margin-bottom: 3mm; padding: 4mm 5mm; border: 1px solid #bfdbfe; border-top: 3px solid #155dfc; background: rgba(239, 246, 255, .72); text-align: center; }
        .certification-statement .eyebrow { color: #155dfc; }
        .statement-text { margin: 2mm 0 0; color: #1e293b; font-family: Georgia, "Times New Roman", serif; font-size: 11px; font-weight: 600; line-height: 1.5; white-space: pre-wrap; }
        .facts { display: grid; grid-template-columns: 1fr 1fr; gap: 2mm 7mm; padding: 4.5mm 5mm; border: 1px solid #dbeafe; background: rgba(239, 246, 255, .62); }
        .fact { display: flex; flex-direction: column; gap: 1mm; }
        .fact span, .eyebrow { color: #64748b; font-size: 8px; font-weight: 800; letter-spacing: .09em; text-transform: uppercase; }
        .fact strong { font-size: 10px; }
        .signature { width: 72mm; margin: auto auto 0; padding-top: 4mm; text-align: center; }
        .signature img { display: block; width: 48mm; height: 16mm; margin: 0 auto -1mm; object-fit: contain; }
        .signature-space { height: 14mm; }
        .signature strong { display: block; padding-top: 2mm; border-top: 1px solid #334155; font-size: 11px; }
        .signature span { display: block; margin-top: 1mm; color: #64748b; font-size: 8px; }
        footer { display: flex; flex: 0 0 auto; justify-content: space-between; gap: 6mm; margin-top: 3mm; padding-top: 3mm; border-top: 1px solid #dbeafe; color: #64748b; font-size: 8px; line-height: 1.35; }
        footer div:last-child { text-align: right; }
        @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } .sheet { break-after: avoid; page-break-after: avoid; } }
    </style>
</head>
<body>
    <main class="sheet">
        <img class="watermark" src="${escapeHtml(logoUrl)}" alt="">
        <div class="content">
            <header>
                <img src="${escapeHtml(logoUrl)}" alt="iPawcus clinic logo">
                <p class="clinic">${escapeHtml(clinic.name || 'VFC Pharmacy / Main Clinic')}</p>
                <p class="address">${escapeHtml([clinic.address, clinic.phoneNumber].filter(Boolean).join(' - '))}</p>
            </header>
            <h1>${escapeHtml(certificate.title || 'Pet certificate')}</h1>
            <p class="certificate-number">Certificate no. ${escapeHtml(certificate.certificateNumber || '')}</p>
            ${isMedical ? '<p class="certify-label">This is to certify that</p>' : ''}
            <h2 class="pet-name">${escapeHtml(pet.name || 'Pet')}</h2>
            <div class="rule"></div>
            ${isMedical ? '' : `<p class="lead">${escapeHtml(statement)}</p>`}
            ${medicalStatement}
            <section class="facts">${facts}</section>
            ${medicalDetails}
            <footer>
                <div>Issued through iPawcus clinic records<br>${isMedical ? `Created: ${escapeHtml(certificateDate(certificate.examinationDate || certificate.createdAt))}<br>Expire: ${escapeHtml(certificateDate(certificate.validUntil))}` : `Generated ${escapeHtml(certificateDate(certificate.generatedAt))}`}</div>
                <div>${escapeHtml(certificate.certificateNumber || '')}<br>Verify against the clinic's current patient record.</div>
            </footer>
        </div>
    </main>
</body>
</html>`;
}

function CertificateSheet({ certificate }) {
    const isMedical = certificate?.type === 'medical';
    const status = statusPresentation(certificate?.status);
    const pet = certificate?.pet || {};
    const clinic = certificate?.clinic || {};
    const veterinarian = certificate?.veterinarian || {};
    const statement = certificateStatement(certificate);
    const finding = certificateFinding(certificate);

    return (
        <article className="relative mx-auto min-h-[720px] w-full max-w-[760px] overflow-hidden border-2 border-[#155dfc] bg-white p-3 text-slate-950 shadow-xl shadow-slate-950/10 sm:min-h-[860px] sm:p-8">
            <div className="pointer-events-none absolute inset-1.5 border border-blue-100" aria-hidden="true" />
            <img
                src={navigationLogo}
                alt=""
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-1/2 size-72 -translate-x-1/2 -translate-y-1/2 object-contain opacity-[0.045] grayscale sm:size-[430px]"
            />

            <div className="relative z-10 flex min-h-[690px] flex-col sm:min-h-[800px]">
                <header className="border-b border-blue-100 pb-5 text-center">
                    <img src={navigationLogo} alt="iPawcus clinic logo" className="mx-auto size-16 object-contain sm:size-20" />
                    <p className="mt-2 text-base font-black tracking-tight text-[#155dfc] sm:text-lg">{clinic.name || 'VFC Pharmacy / Main Clinic'}</p>
                    <p className="mx-auto mt-1 max-w-xl text-[10px] font-semibold leading-relaxed text-slate-500 sm:text-xs">
                        {[clinic.address, clinic.phoneNumber].filter(Boolean).join(' - ')}
                    </p>
                </header>

                <div className="pt-6 text-center sm:pt-8">
                    <div className="mx-auto flex w-fit items-center gap-2">
                        {isMedical ? <Award className="size-5 text-[#155dfc]" /> : <ShieldCheck className="size-5 text-[#155dfc]" />}
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${status.className}`}>{status.label}</span>
                    </div>
                    <h3 className="mt-4 font-serif text-2xl font-black uppercase tracking-[0.06em] text-slate-950 sm:text-4xl">
                        {certificate.title}
                    </h3>
                    <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Certificate no. {certificate.certificateNumber}</p>
                    {isMedical ? <p className="mt-7 font-serif text-sm font-semibold text-slate-500">This is to certify that</p> : null}
                    <p className={`${isMedical ? 'mt-2' : 'mt-7'} break-words font-serif text-4xl font-black uppercase leading-none text-[#155dfc] sm:text-6xl`}>{pet.name || 'Pet'}</p>
                    <div className="mx-auto mt-3 h-0.5 w-32 bg-[#155dfc] sm:w-48" />
                    {!isMedical ? <p className="mx-auto mt-5 max-w-2xl whitespace-pre-wrap text-sm font-medium leading-7 text-slate-700 sm:text-base">{statement}</p> : null}
                </div>

                {isMedical ? (
                    <section className="mt-6 border border-blue-200 border-t-4 border-t-[#155dfc] bg-blue-50/70 px-4 py-5 text-center sm:px-8 sm:py-6">
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#155dfc]">Clinical findings</p>
                        <p className="mx-auto mt-3 max-w-2xl whitespace-pre-wrap font-serif text-base font-semibold leading-7 text-slate-800 sm:text-lg sm:leading-8">{finding}</p>
                    </section>
                ) : null}

                <dl className="mt-6 grid grid-cols-1 gap-x-8 gap-y-3 border border-blue-100 bg-blue-50/55 p-4 sm:grid-cols-2 sm:p-6">
                    {certificatePetFacts(certificate).map(([label, value]) => (
                        <div key={label} className="min-w-0 border-b border-blue-100 pb-2 last:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b-0">
                            <dt className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</dt>
                            <dd className="mt-1 break-words text-sm font-bold text-slate-900">{value}</dd>
                        </div>
                    ))}
                </dl>

                {isMedical ? (
                    <>
                        <section className="mx-auto mt-auto w-full max-w-xs pt-8 text-center">
                            {certificate.signaturePath ? (
                                <ProtectedImage
                                    src={certificate.signaturePath}
                                    alt={`${veterinarian.name || 'Veterinarian'} signature`}
                                    className="mx-auto h-20 w-52 object-contain"
                                    fallbackClassName="mx-auto h-20 w-52"
                                />
                            ) : <div className="h-20" />}
                            <p className="border-t border-slate-500 pt-2 text-sm font-black">{veterinarian.name || 'Clinic veterinarian'}</p>
                            <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                                Attending Veterinarian{veterinarian.licenseNumber ? ` - PRC ${veterinarian.licenseNumber}` : ''}
                            </p>
                        </section>
                    </>
                ) : <div className="mt-auto" aria-hidden="true" />}

                <footer className="mt-6 flex flex-col gap-2 border-t border-blue-100 pt-4 text-[9px] font-semibold leading-relaxed text-slate-500 sm:flex-row sm:items-end sm:justify-between">
                    <p>
                        Issued through iPawcus clinic records<br />
                        {isMedical ? (
                            <>
                                Created: {certificateDate(certificate.examinationDate || certificate.createdAt)}<br />
                                Expire: {certificateDate(certificate.validUntil)}
                            </>
                        ) : `Generated ${certificateDate(certificate.generatedAt)}`}
                    </p>
                    <p className="sm:text-right">{certificate.certificateNumber}<br />Verify against the clinic&apos;s current patient record.</p>
                </footer>
            </div>
        </article>
    );
}

export default function PetCertificateDialog({ open, onOpenChange, certificate }) {
    const [isPrinting, setIsPrinting] = useState(false);

    if (!certificate) return null;

    const handlePrint = async () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            toast.error('Allow pop-ups for iPawcus to print this certificate.');
            return;
        }

        setIsPrinting(true);
        printWindow.document.write('<!doctype html><title>Preparing certificate...</title><p style="font-family:system-ui;padding:24px">Preparing certificate...</p>');
        try {
            let signatureSrc = '';
            if (certificate.type === 'medical' && certificate.signaturePath) {
                signatureSrc = await fetchProtectedImageObjectUrl(certificate.signaturePath);
            }
            printWindow.document.open();
            printWindow.document.write(printCertificateHtml(certificate, signatureSrc));
            printWindow.document.close();
            printWindow.focus();
            window.setTimeout(() => printWindow.print(), 500);
            if (signatureSrc.startsWith('blob:')) {
                window.setTimeout(() => URL.revokeObjectURL(signatureSrc), 10000);
            }
        } catch (error) {
            console.error('Could not prepare certificate for printing:', error);
            printWindow.close();
            toast.error('The certificate could not be prepared for printing. Please try again.');
        } finally {
            setIsPrinting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl bg-slate-100 p-3 dark:bg-slate-950 sm:p-5">
                <DialogHeader className="rounded-xl bg-white p-4 pr-12 text-center dark:bg-slate-900 sm:text-center">
                    <DialogTitle className="text-center text-slate-950 dark:text-white">{certificate.title}</DialogTitle>
                    <DialogDescription className="text-center dark:text-slate-300">
                        Review the official clinic record, then print it or download it as a PDF from the browser print dialog.
                    </DialogDescription>
                </DialogHeader>

                <CertificateSheet certificate={certificate} />

                <DialogFooter className="sticky bottom-0 rounded-xl border border-slate-200 bg-white/95 p-3 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
                    <Button type="button" onClick={handlePrint} disabled={isPrinting}>
                        <Printer className="size-4" />
                        {isPrinting ? 'Preparing certificate...' : 'Print / Save PDF'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
