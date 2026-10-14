import { CalendarDays, Check, CreditCard, FileCheck2 } from 'lucide-react';
import { createElement } from 'react';
import './careWorkspace.css';

const steps = [
    { label: 'Pet & schedule', Icon: CalendarDays },
    { label: 'Consent & payment', Icon: CreditCard },
    { label: 'Booking status', Icon: FileCheck2 },
];

export default function ConsultationProgress({ step = 1 }) {
    return (
        <ol className="care-consult-progress" aria-label="Online consultation booking progress">
            {steps.map(({ label, Icon }, index) => {
                const number = index + 1;
                const completed = number < step;
                return (
                    <li key={label} className={number === step ? 'is-current' : completed ? 'is-complete' : ''} aria-current={number === step ? 'step' : undefined}>
                        <span className="care-progress-icon" aria-hidden="true">{completed ? <Check size={17} /> : createElement(Icon, { size: 17 })}</span>
                        <span><small>Step {number}</small><strong>{label}</strong></span>
                    </li>
                );
            })}
        </ol>
    );
}
