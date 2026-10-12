import { FlaskConical } from 'lucide-react';

import GeneralCheckup from './GeneralCheckup.jsx';

const LABORATORY_BOOKING_CONFIG = {
    availabilityKey: 'lab-testing',
    serviceType: 'lab-testing',
    title: 'Laboratory Testing',
    description: 'Choose a clinic and an available appointment time for laboratory testing.',
    notesPlaceholder: 'List the requested test, symptoms, previous results, or veterinarian instructions.',
    projectionKey: 'laboratoryTesting',
    Icon: FlaskConical,
    branchSelectable: true,
    infoText: 'The clinic will confirm the appropriate test, sample requirements, preparation, and final laboratory fee after review.',
};

export default function LaboratoryTesting() {
    return <GeneralCheckup bookingConfig={LABORATORY_BOOKING_CONFIG} />;
}
