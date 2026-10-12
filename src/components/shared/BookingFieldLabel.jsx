import PropTypes from 'prop-types';
import { Children } from 'react';
import { Label } from '../../ui/label';
import HelpTooltip from '../../ui/help-tooltip.jsx';

const FIELD_HELP = {
    'select pet': 'Choose your pet from the list. Use the new-pet option if your pet is not registered yet.',
    'select pet(s)': 'Choose the pets included in this request. Pets marked deceased cannot be booked.',
    'pet name': 'Enter the name used in your pet’s records.',
    species: 'Choose the type of animal, such as dog or cat.',
    breed: 'Choose or enter the breed. Select the species first to narrow the suggestions.',
    age: 'Enter your pet’s age in years.',
    weight: 'Enter your pet’s weight in kilograms, if known.',
    'color / markings': 'Add coat color or distinctive markings to help the clinic identify your pet.',
    'medical conditions': 'Include existing diagnoses, allergies, or medication the clinic should know about.',
    'preferred date': 'Choose a date with available appointments. Unavailable dates cannot be selected.',
    'preferred time': 'Choose an available start time for the selected date.',
    'select date': 'Choose an available date for your selected veterinarian’s online calls.',
    'select time': 'Choose an available online consultation start time.',
    'additional notes': 'Add symptoms, concerns, or preparation details. A preferred vet selected from the calendar is filled in here and can be edited.',
    'surgery details': 'Describe the surgery or consultation you are requesting and any relevant concerns.',
    'dental concerns': 'Describe dental symptoms or the reason for this appointment.',
    'upload files': 'Attach relevant medical records, X-rays, or other documents. Images and PDFs are accepted, up to 8 MB each.',
    'grooming services': 'Select every grooming service you want included. The listed prices contribute to the booking estimate.',
    'discussion topics': 'Select the topics you want to discuss during the online consultation.',
    veterinarian: 'Choose the vet for this online consultation. Their available dates and times appear below.',
    'service address': 'Choose an address suggestion, use your current location, or type the address where the service is needed.',
    'location details': 'Add a unit number, landmark, or access instructions to help the team find you.',
    'concern photos': 'Upload clear photos of symptoms, wounds, skin issues, or other visible concerns. Images only.',
    'notes': 'Add care instructions, symptoms, or concerns. You can edit the preferred vet note filled in from the calendar.',
    'services needed': 'Select the services you want the home-service team to provide.',
    'check-in date': 'Choose the date your pet will arrive at the Pet Hotel.',
    'check-out date': 'Choose a checkout date after check-in. Room availability is checked for the entire stay.',
    'room size': 'Choose a room that fits your pets. Available room counts depend on the selected stay dates.',
    'add-ons': 'Choose any extra services you want included in your pet’s stay.',
    'emergency contact': 'Provide a phone number the clinic can reach during your pet’s stay.',
    'special requests': 'Add feeding instructions, care needs, or other requests for the Pet Hotel team.',
    'owner signature': 'Review the consent above, then sign to continue with this booking.',
    'service date': 'Choose a date allowed for the selected special service.',
    'payment method': 'Choose your payment method. The clinic confirms the final amount and payment instructions after reviewing your request.',
};

export default function BookingFieldLabel({ children, htmlFor, help, helpLabel, className = '', ...props }) {
    const labelText = Children.toArray(children).filter((child) => typeof child === 'string').join('').replace(/\*|\(optional\)/gi, '').trim();
    const helpContent = help || FIELD_HELP[labelText.toLowerCase()];

    return (
        <div className={`min-w-0 ${className}`}>
            <div className="flex min-h-7 items-center gap-1.5">
                <Label htmlFor={htmlFor} {...props}>{children}</Label>
                {helpContent && <HelpTooltip label={`Help for ${helpLabel || labelText || 'this field'}`}>{helpContent}</HelpTooltip>}
            </div>
        </div>
    );
}

BookingFieldLabel.propTypes = {
    children: PropTypes.node,
    htmlFor: PropTypes.string,
    help: PropTypes.node,
    helpLabel: PropTypes.string,
    className: PropTypes.string,
};
