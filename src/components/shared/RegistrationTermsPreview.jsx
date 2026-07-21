function PolicySection({ title, children }) {
    return (
        <section className="space-y-3 border-t border-slate-200 pt-5 first:border-t-0 first:pt-0">
            <h3 className="text-base font-black text-slate-950">{title}</h3>
            <div className="space-y-3 text-sm font-medium leading-6 text-slate-700">{children}</div>
        </section>
    );
}

function BulletList({ items }) {
    return (
        <ul className="list-disc space-y-1 pl-5">
            {items.map((item) => (
                <li key={item}>{item}</li>
            ))}
        </ul>
    );
}

function NumberedList({ items }) {
    return (
        <ol className="list-decimal space-y-1 pl-5">
            {items.map((item) => (
                <li key={item}>{item}</li>
            ))}
        </ol>
    );
}

export default function RegistrationTermsPreview() {
    return (
        <article className="space-y-5">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <h2 className="text-lg font-black text-slate-950">iPawcus Clinic System Policy</h2>
                <p className="mt-2 text-sm font-semibold text-slate-700">
                    <span className="font-black">Status:</span> Proposed policy for Clinic approval
                </p>
                <p className="text-sm font-semibold text-slate-700">
                    <span className="font-black">Document version and effective date:</span> To be added later
                </p>
            </div>

            <PolicySection title="1. Clinic Information">
                <div className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-2">
                    <p><span className="font-black text-slate-900">Clinic name:</span> Vetfocus Animal Care Clinic</p>
                    <p><span className="font-black text-slate-900">Trade name:</span> VFC</p>
                    <p className="sm:col-span-2"><span className="font-black text-slate-900">Address:</span> Oakbrook Avenue, Phase 3, Pleasantville Subdivision, corner Clayton, Ilayang Iyam, Lucena City, Quezon</p>
                    <p><span className="font-black text-slate-900">Telephone:</span> (042) 373-5678</p>
                    <p>
                        <span className="font-black text-slate-900">Email:</span>{' '}
                        <a href="mailto:support@vetfocuscare.com" className="text-[#155dfc] underline">support@vetfocuscare.com</a>
                    </p>
                    <p className="sm:col-span-2"><span className="font-black text-slate-900">Legal venue:</span> Lucena City, Quezon, Philippines</p>
                </div>
                <p>Complaints and privacy requests may be sent to the Clinic through the same email address, telephone number, or business address.</p>
                <p>The official privacy contact will be identified as the <span className="font-black text-slate-900">Clinic Privacy Officer</span> until the Clinic appoints a specific person.</p>
                <p>The Clinic will:</p>
                <BulletList items={[
                    'acknowledge an ordinary complaint within three business days;',
                    'provide a response or status update within 15 business days; and',
                    'handle urgent safety or privacy incidents as soon as possible.',
                ]} />
            </PolicySection>

            <PolicySection title="2. Registration and Pet Ownership">
                <p>Only persons who are at least 18 years old may create an independent pet-owner account. Minors must use an account controlled by a parent or legal guardian.</p>
                <p>Registration may require the owner&apos;s:</p>
                <BulletList items={[
                    'full name;',
                    'birthdate;',
                    'address;',
                    'email address;',
                    'telephone number;',
                    'emergency contact;',
                    'account-verification information; and',
                    'pet information.',
                ]} />
                <p>The first verified person who registers or links the pet will normally be recorded as the primary owner. Registration alone does not conclusively prove legal ownership. The Clinic may request a valid ID, vaccination record, adoption document, previous veterinary record, photograph of the pet, or other reasonable proof.</p>
                <p>A pet may have approved co-owners. Approved co-owners may see the pet&apos;s records and request routine services.</p>
                <p>Surgery, anesthesia, euthanasia, DNR instructions and other high-risk or end-of-life decisions must be discussed with the recorded owners when reasonably possible. Written approval from the primary owner or another person with documented authority is required.</p>
                <p>If owners disagree, the Clinic may suspend disputed account access and postpone non-emergency treatment until authority is clarified. The Clinic will not delete medical, consent or billing records merely because of an ownership dispute.</p>
                <p>An emergency contact may make decisions only when the primary owner has specifically granted that authority in a separate Clinic record. Being listed as an emergency contact does not automatically permit that person to authorize surgery, euthanasia or DNR.</p>
            </PolicySection>

            <PolicySection title="3. Appointments, Cancellations and Payments">
                <p>An appointment is confirmed only after it is approved by Clinic staff through Booking Management.</p>
                <p>The following rules apply:</p>
                <BulletList items={[
                    'Cancellation or rescheduling must normally be requested at least 24 hours before the appointment.',
                    'A booking may be rescheduled up to two times, subject to availability.',
                    'A missed appointment will be cancelled.',
                    'There is no standard no-show charge.',
                    'The Clinic may cancel or reschedule when the veterinarian is unavailable, the service cannot be performed safely, an emergency receives priority, or the required equipment or facilities are unavailable.',
                    'A user who repeatedly misses appointments may be required to prepay future bookings.',
                ]} />
                <p>Accepted payment methods are cash, QR Ph, GCash, Maya and bank transfer.</p>
                <p>Payment proofs are normally reviewed within one to two business days.</p>
                <p>The following advance payments apply:</p>
                <BulletList items={[
                    'Online consultation: ₱500 full prepayment',
                    'Home service: ₱50 transportation or booking payment',
                    'Boarding: payable at the Clinic when the pet is admitted',
                    'Special services: the initial payment shown in the service quotation',
                ]} />
                <p>An online consultation that cannot proceed may be rescheduled. The pet owner may instead request cancellation and a refund before the consultation is completed.</p>
                <p>Approved refunds will normally be processed within one to two business days. Bank and payment-provider charges that have already been charged and cannot be recovered are not refundable.</p>
                <p>An overpayment will first be applied to the owner&apos;s final Clinic bill. If the service is cancelled or the overpayment cannot be applied, the remaining amount should be refunded.</p>
                <p>The Clinic does not normally provide credit accounts. Payment is due according to the bill and before discharge or release of the pet, unless the Clinic approves another arrangement.</p>
                <p>Services already performed remain payable even if the pet later deteriorates or dies. Additional non-emergency charges require owner approval. Emergency charges must follow the emergency authorization signed for that service or admission.</p>
            </PolicySection>

            <PolicySection title="4. Emergency Treatment">
                <p>The Clinic will make at least three reasonable contact attempts over approximately 20 minutes, unless the pet needs immediate action.</p>
                <p>The Clinic will normally contact:</p>
                <NumberedList items={[
                    'the primary owner;',
                    'an authorized co-owner; and',
                    'the recorded emergency contact.',
                ]} />
                <p>Contact may be attempted through telephone call, SMS or email.</p>
                <p>Registration alone does not create an unlimited emergency spending authority. Before surgery, boarding, confinement or another higher-risk service, the owner should complete a separate emergency authorization that identifies:</p>
                <BulletList items={[
                    'authorized decision-makers;',
                    'the emergency spending limit;',
                    'treatment restrictions;',
                    'transfer authority; and',
                    'CPR or DNR instructions.',
                ]} />
                <p>If no authorized person can be reached, the veterinarian may provide only reasonable and professionally appropriate emergency stabilization when immediate delay could cause serious suffering, injury or death. The veterinarian must document the condition, contact attempts, treatment and reason for acting.</p>
                <p>The Clinic may recommend transfer to another veterinary facility when it lacks the necessary equipment, staff or emergency capacity. Transfer expenses are normally paid by the owner.</p>
                <p>If there is no valid DNR instruction, the attending veterinarian may attempt reasonable CPR when medically appropriate. A DNR instruction must come from the primary owner or a properly authorized adult, be explained by the veterinarian, and be recorded in a separate signed form.</p>
                <p>A veterinarian may recommend a DNR order but should not create one solely from a diagnosis without the owner&apos;s authorization, except where the law or applicable professional duties provide otherwise.</p>
            </PolicySection>

            <PolicySection title="5. Humane Handling and Aggressive Pets">
                <p>The Clinic will use the least restrictive humane method reasonably necessary to examine or treat the pet.</p>
                <p>Permitted safety measures may include:</p>
                <BulletList items={[
                    'a leash or harness;',
                    'a carrier;',
                    'a towel;',
                    'a protective cone;',
                    'separation from other animals; or',
                    'an appropriately fitted muzzle.',
                ]} />
                <p>Hitting, choking, frightening, punishing, or unnecessarily painful restraint is prohibited.</p>
                <p>Owners must disclose any bite history, fear, aggression or escape behavior. The Clinic may ask the owner to bring an appropriate carrier or muzzle.</p>
                <p>A non-emergency service may be stopped or postponed when:</p>
                <BulletList items={[
                    'the animal, owner or staff member could be injured;',
                    'humane restraint is not possible;',
                    "the pet's stress or condition makes the service unsafe;",
                    'required consent has not been provided; or',
                    'the risks are greater than the expected benefit.',
                ]} />
                <p>Sedation may be used only after assessment by a licensed veterinarian and separate informed consent from an authorized owner. Emergency sedation without prior consent is limited to situations where immediate action is professionally justified to prevent serious harm. The reason must be documented and communicated to the owner.</p>
                <p>A serious handling or treatment incident must be reported to the owner as soon as reasonably possible. Staff should complete an internal incident report within 24 hours. The attending veterinarian and Clinic administration will review the incident.</p>
            </PolicySection>

            <PolicySection title="6. Deterioration, Injury or Death">
                <p>If a pet seriously deteriorates, is injured, escapes, receives the wrong medicine, is involved in an identification error, or dies while under Clinic care, the Clinic will:</p>
                <NumberedList items={[
                    'provide reasonable immediate care;',
                    'contact the owner as soon as the pet is stabilized or the event is discovered;',
                    'preserve the relevant records;',
                    'document what is known;',
                    'explain available referral, necropsy and aftercare options; and',
                    'provide a complaint and review process.',
                ]} />
                <p>The Clinic should make its first owner-contact attempt immediately or, when treatment must take priority, within 30 minutes after the pet is stabilized.</p>
                <p>Relevant medical records, monitoring records, medicines, consent forms, payment records, messages, photographs, CCTV footage and incident reports must be preserved when they relate to the event.</p>
                <p>The attending veterinarian will explain the medical facts. Clinic administration may explain billing, records and the complaint procedure.</p>
                <p>Upon request, the Clinic should provide an available medical summary or incident status within seven business days. A complete investigation may take longer, but the owner must receive reasonable updates.</p>
            </PolicySection>

            <PolicySection title="7. Euthanasia, DNR, Necropsy and Remains">
                <p>Euthanasia requires:</p>
                <BulletList items={[
                    'an assessment and recommendation from a licensed veterinarian;',
                    'separate written consent;',
                    'valid identification from the signer; and',
                    'proof that the signer is the primary owner or is properly authorized.',
                ]} />
                <p>An emergency contact may not authorize euthanasia unless the primary owner gave that person specific written authority accepted by the Clinic.</p>
                <p>If owners disagree, euthanasia should be postponed unless immediate action is legally and professionally necessary to prevent severe suffering.</p>
                <p>When the Clinic has suitable facilities, remains may be held in secure refrigerated storage for up to 72 hours. The person collecting the remains must present identification and sign a release record.</p>
                <p>Available aftercare may include:</p>
                <BulletList items={[
                    'release to the owner;',
                    'private cremation;',
                    'communal cremation; or',
                    'another lawful arrangement offered through a Clinic-approved provider.',
                ]} />
                <p>The owner is responsible for aftercare expenses.</p>
                <p>For unclaimed remains, the Clinic will make at least three contact attempts and provide at least seven calendar days&apos; notice. If there is still no response, the Clinic may arrange lawful and sanitary disposition and record the actions taken.</p>
                <p>Necropsy is available only when it can be performed by the Clinic or a qualified referral provider. It requires separate owner authorization and is charged according to the provider&apos;s quotation.</p>
                <p>Properly authorized services performed before or after the pet&apos;s death remain payable.</p>
            </PolicySection>

            <PolicySection title="8. Online Consultation">
                <p>Online consultations use Jitsi Meet through the iPawcus meeting link.</p>
                <p>Only the veterinarian, pet owner and another person approved by the owner and veterinarian may participate.</p>
                <p>The live meeting will not be recorded. The veterinarian&apos;s diagnosis, assessment, advice, prescription and consultation notes may be stored in the pet&apos;s medical record.</p>
                <p>If the Clinic experiences a technical failure, the consultation will be rescheduled without another consultation charge.</p>
                <p>If the pet owner disconnects, the veterinarian will wait up to 10 minutes. The consultation may then be marked missed, but one reasonable rescheduling request may be allowed.</p>
                <p>A refund may be requested when the owner cancels before the consultation is completed. Approved refunds are normally processed within one to two business days.</p>
                <p>Online consultation is not an emergency service. The veterinarian may require an in-clinic booking or referral when the pet needs a physical examination, testing, imaging, surgery or immediate treatment.</p>
            </PolicySection>

            <PolicySection title="9. Home Service, Boarding and Confinement">
                <h4 className="text-sm font-black text-slate-900">Home Service</h4>
                <p>Home service is available within Lucena City and nearby locations accepted by the Clinic. Availability depends on distance, staffing, weather, travel and the requested service.</p>
                <p>The home-service transportation or booking payment is ₱50 unless a different amount is displayed and accepted before confirmation.</p>
                <p>The owner must provide:</p>
                <BulletList items={[
                    'an accurate address;',
                    'safe access;',
                    'adequate lighting and space;',
                    'an adult contact at the location; and',
                    'reasonable control of the pet and other animals.',
                ]} />
                <p>The Clinic may stop or cancel a home service if the location or animal presents an unreasonable safety risk.</p>
                <p>Surgery, general anesthesia, major emergency treatment, advanced imaging and procedures requiring full Clinic facilities will not normally be performed at home. The veterinarian may recommend transport or referral. The owner is responsible for arranging and paying for transport unless another arrangement is confirmed.</p>

                <h4 className="pt-2 text-sm font-black text-slate-900">Boarding and Confinement</h4>
                <p>Owners must disclose vaccination status, parasite-control status, infectious-disease exposure, allergies, medicines, diet and behavioral risks.</p>
                <p>The Clinic may require proof of vaccination, parasite control, testing or isolation. A pet with a suspected infectious condition may be refused, isolated or referred.</p>
                <p>Food and medicine supplied by the owner must be properly labelled and accompanied by written instructions.</p>
                <p>Emergency authority and spending limits must be recorded in the admission form.</p>
                <p>Owners of medically confined pets should receive at least one daily update and additional updates when the pet&apos;s condition materially changes.</p>
                <p>Extended stays and late collection are charged according to the published daily rate. The Clinic will contact the owner before taking action concerning an uncollected pet. Medical and ownership records will not be deleted.</p>
                <p>Personal belongings should be listed during admission. The Clinic is not responsible for ordinary wear or damage that occurs despite reasonable care.</p>
            </PolicySection>

            <PolicySection title="10. Communications, CCTV, Photos and Research">
                <p>Service communications may be sent through email, SMS or telephone.</p>
                <p>
                    Marketing messages are optional and may be sent through email or SMS only after separate consent. Consent may be withdrawn through the account settings or by emailing{' '}
                    <a href="mailto:support@vetfocuscare.com" className="text-[#155dfc] underline">support@vetfocuscare.com</a>. The Clinic should apply the withdrawal within five business days.
                </p>
                <p>The Clinic uses CCTV at entrances, reception and appropriate common or security areas. CCTV must not be installed in restrooms or other areas where people reasonably expect privacy.</p>
                <p>CCTV is used for safety, security, incident review and protection of people, animals and property. Visible CCTV notices must be displayed.</p>
                <p>CCTV recordings will normally be retained for 30 days. Footage connected to an incident, complaint, access request or legal claim may be preserved until the matter is resolved.</p>
                <p>Access is limited to the Clinic owner, authorized administration, the Privacy Officer and persons who are legally entitled to receive it.</p>
                <p>Pet photographs and medical images may be stored as part of the pet&apos;s medical record. Identifiable photographs, videos or case information must not be posted on social media, used in advertising or used for identifiable teaching without separate consent.</p>
                <p>Anonymized data may be used for internal reports and service improvement. Research or capstone use must use anonymized or minimized data and receive any required Clinic, academic, ethics or legal approval. Identifiable research use requires separate informed consent when applicable.</p>
            </PolicySection>

            <PolicySection title="11. Technology Providers">
                <p>iPawcus uses or is expected to use:</p>
                <BulletList items={[
                    'Hostinger: website hosting, application hosting, database, transactional email and backup storage;',
                    'Singapore data center: primary production storage location selected for hosting;',
                    'MySQL or MariaDB: database hosted within the Hostinger environment;',
                    'Jitsi Meet: online veterinary consultations;',
                    'Geoapify: address search and autocomplete;',
                    'Browser notification services: optional push notifications; and',
                    'GCash, Maya, QR Ph and bank transfer: external payment methods, with payment proof submitted to the Clinic.',
                ]} />
                <p>Personal data may therefore be processed or stored in Singapore and may be handled by authorized provider subprocessors. The Clinic must keep appropriate provider contracts, security arrangements and data-processing terms.</p>
                <p>If the final system uses additional analytics, error monitoring, cloud storage, media hosting or email services, those providers must be added to the Privacy Notice before deployment.</p>
            </PolicySection>

            <PolicySection title="12. Data Retention">
                <p>The proposed retention schedule is:</p>
                <BulletList items={[
                    'Account and owner profile: five years after account closure or last Clinic service',
                    "Veterinary records and prescriptions: 10 years after the pet's last treatment",
                    'Consent forms and signatures: 10 years after the related service',
                    'Bookings, online consultations, home services, boarding and confinement: five years after completion or cancellation',
                    'Billing records, invoices, receipts, refunds and payment proofs: five years from the applicable accounting or tax-record date',
                    'Login and security logs: one year',
                    'OTP and password-reset records: 90 days after expiration',
                    'Notification and email-delivery logs: two years',
                    'Medical photographs and files: the same period as the related veterinary record',
                    'Temporary or failed uploads: 30 days',
                    'Complaints, serious incidents and death-related records: 10 years after the matter is closed',
                    'CCTV footage: 30 days unless needed for an incident, request or legal matter',
                    'Daily backups: rolling 30-day period',
                    'Monthly backups: 12 months',
                ]} />
                <p>Records connected to an unresolved complaint, audit, investigation or legal claim may be kept until the matter is completed.</p>
                <p>After the retention period, information will be securely deleted or anonymized. Account closure does not require the Clinic to delete medical, consent, billing or incident records that must still be retained.</p>
            </PolicySection>

            <PolicySection title="13. Privacy Rights and System Responsibilities">
                <p>
                    Privacy requests may be sent to{' '}
                    <a href="mailto:support@vetfocuscare.com" className="text-[#155dfc] underline">support@vetfocuscare.com</a> or submitted at the Clinic.
                </p>
                <p>The Clinic may request a valid ID and account information to verify the requester. A co-owner may request that person&apos;s own information and pet records that the person is authorized to access.</p>
                <p>The Clinic will respond without undue delay and within 30 working days after receiving the complete request. A complex request may require an extension allowed by applicable privacy rules.</p>
                <p>A person may request:</p>
                <BulletList items={[
                    'access to personal data;',
                    'correction of inaccurate information;',
                    'withdrawal of marketing consent;',
                    'deletion or blocking when legally allowed; or',
                    'a copy of portable information when the feature is available.',
                ]} />
                <p>Deletion may be refused when the information must be retained for veterinary care, accounting, security, animal welfare, an investigation or a legal claim.</p>
                <p>Security audit items are the developer&apos;s responsibility. Before deployment, the developer must verify access controls, media-file protection, CORS settings, production error settings, rate limiting, role authorization, database consistency, password hashing, email verification, upload restrictions, backups and incident logging.</p>
                <p>The system will preserve the user, signature or checkbox action, timestamp, pet or service, and exact agreement version accepted.</p>
                <p>Procedure-specific consent forms, including surgery, anesthesia, vaccination, grooming, confinement, CPR/DNR, euthanasia and remains handling, will be created and uploaded by the Clinic. Registration will not replace those separate consent forms.</p>
            </PolicySection>
        </article>
    );
}
