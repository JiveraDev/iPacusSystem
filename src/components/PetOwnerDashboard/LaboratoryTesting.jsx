import { FlaskConical } from 'lucide-react';

import GeneralCheckup from './GeneralCheckup.jsx';

const LABORATORY_BOOKING_CONFIG = {
    availabilityKey: 'lab-testing',
    serviceType: 'lab-testing',
    title: 'Laboratory Testing',
    description: 'Request laboratory testing during an available clinic or veterinarian-visit schedule',
    notesPlaceholder: 'List the requested test, symptoms, previous results, or veterinarian instructions.',
    projectionKey: '',
    Icon: FlaskConical,
    branchSelectable: true,
    infoText: 'The clinic will confirm the appropriate test, sample requirements, preparation, and final laboratory fee after review.',
};

export default function LaboratoryTesting() {
    return <GeneralCheckup bookingConfig={LABORATORY_BOOKING_CONFIG} />;
}
