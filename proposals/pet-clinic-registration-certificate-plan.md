# Pet Clinic Registration Certificate Plan

Status: Implemented on 2026-10-02. Registration proof is generated from the canonical pet record; veterinarian-issued medical certificates use `DDL/20261002_03_pet_certificates.sql`.

Veterinarians may issue a signed medical certificate directly from the medical editor. A record-update request is optional and is linked only when the certificate is issued from an active assigned request.

## Purpose

Provide pet owners and authorized clinic staff with a downloadable certificate confirming that a pet has an active patient record with the clinic.

Use the title **Certificate of Clinic Registration**. Do not call it a medical certificate unless a veterinarian is separately certifying the pet's current health condition.

## Certificate Content

### Clinic Header

- Clinic logo and name
- Branch name and address
- Clinic contact information
- Certificate title

### Pet Information

- Pet name
- Clinic pet ID or registration number
- Species
- Breed
- Sex
- Color or markings
- Date of birth or age
- Microchip number, when available
- Registration date
- Current registration status

### Registered Owner

- Owner's full name
- Contact number
- Address or email, subject to the application's privacy rules

### Certification Statement

> This document confirms that the pet named above has an active patient record with [Clinic Name] as of [issue date]. It does not certify the pet's current health condition, vaccination status, fitness for travel, or freedom from disease unless these are stated in a separate veterinary medical certificate.

### Issuance and Verification

- Unique certificate or reference number
- Date and time issued
- Issued-by staff member
- Veterinarian or authorized staff signature
- PRC license number when signed by a veterinarian
- Clinic seal or logo
- QR code or verification link

## Proposed Frontend Actions

- Preview certificate
- Download PDF
- Print certificate
- Verify through QR code
- View the corresponding pet profile or medical record
- Reissue a certificate while retaining issuance history

## Suggested Filename

`Pet-Name_Clinic-Registration-Certificate_YYYY-MM-DD.pdf`

## Future Implementation Notes

- Generate the certificate only for a registered, non-archived pet record.
- Resolve clinic and branch details from existing configuration instead of hardcoding them.
- Use the canonical pet and ownership records as the source of truth.
- Record certificate number, issuer, issue time, pet ID, and verification status in an issuance history.
- Keep health claims, vaccination claims, travel clearance, and disease-free certification outside this document.
- Apply the existing authorization rules so owners can access only their pets and clinic staff can issue certificates only within their permitted scope.
- Build the PDF from the same normalized data displayed in the preview to prevent mismatches.
- Verify phone, tablet, desktop, light-theme, dark-theme, printing, and PDF output before release.
