import React, { useEffect, useRef, useState } from 'react';
import imgImageVfcLogo from "../assets/logo.png";
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '../ui/dialog';
import { ArrowLeft, User, Mail, Phone, MapPin, Dog } from 'lucide-react';
import RegistrationTermsPreview, {
    REGISTRATION_TERMS_DOCUMENT_ID,
    REGISTRATION_TERMS_EFFECTIVE_DATE,
    REGISTRATION_TERMS_VERSION,
} from './shared/RegistrationTermsPreview.jsx';
import { searchAddresses } from "../services/addressAutocomplete.js";
import { getPhilippinePhoneError, normalizePhilippinePhoneForSubmit, normalizePhilippinePhoneInput } from '../lib/philippinePhone';

function normalizeNameInput(value) {
    return String(value || '')
        .replace(/[^\p{L}\p{M} .'-]/gu, '')
        .replace(/\s{2,}/g, ' ')
        .replace(/^\s+/, '');
}

function getNameError(value, label) {
    const text = String(value || '').trim();

    if (!text) {
        return `${label} is required`;
    }

    if (!/^[A-Za-z]+(?: [A-Za-z]+)*$/.test(text)) {
        return `${label} can only use letters and single spaces`;
    }

    return '';
}

export function PetOwnerProfileForm({ email, onBack, onComplete }) {
    const [formData, setFormData] = useState({
        firstName:'',
        lastName:'',
        address: '',
        phoneNumber: normalizePhilippinePhoneInput(''),
        emergencyContact: normalizePhilippinePhoneInput(''),
    })

    const [errors, setErrors] = useState({})
    const [addressSuggestions, setAddressSuggestions] = useState([])
    const [isSearchingAddress, setIsSearchingAddress] = useState(false)
    const [addressLookupError, setAddressLookupError] = useState("")
    const [isAddressMenuOpen, setIsAddressMenuOpen] = useState(false)
    const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false)
    const [isTermsPreviewOpen, setIsTermsPreviewOpen] = useState(false)
    const blurTimeoutRef = useRef(null)

    const handleChange = (field, value) => {
        const nextValue = ["phoneNumber", "emergencyContact"].includes(field)
            ? normalizePhilippinePhoneInput(value)
            : ["firstName", "lastName"].includes(field)
            ? normalizeNameInput(value)
            : value

        setFormData({ ...formData, [field]: nextValue })

        if (field === "address") {
            setAddressLookupError("")
            setIsAddressMenuOpen(true)
        }
    }

    useEffect(() => {
        const query = formData.address.trim()

        if (query.length < 3) {
            setAddressSuggestions([])
            setIsSearchingAddress(false)
            return
        }

        const controller = new AbortController()
        const timeoutId = window.setTimeout(async () => {
            try {
                setIsSearchingAddress(true)
                const suggestions = await searchAddresses(query, controller.signal)
                setAddressSuggestions(suggestions)
                setAddressLookupError("")
            } catch (error) {
                if (error.name !== "AbortError") {
                    console.error("Address autocomplete failed:", error)
                    setAddressSuggestions([])
                    setAddressLookupError(
                        error?.message || "Unable to load address suggestions right now."
                    )
                }
            } finally {
                setIsSearchingAddress(false)
            }
        }, 300)

        return () => {
            controller.abort()
            window.clearTimeout(timeoutId)
        }
    }, [formData.address])

    useEffect(() => {
        return () => {
            if (blurTimeoutRef.current) {
                window.clearTimeout(blurTimeoutRef.current)
            }
        }
    }, [])

    const handleAddressFocus = () => {
        if (formData.address.trim().length >= 3) {
            setIsAddressMenuOpen(true)
        }
    }

    const handleAddressBlur = () => {
        blurTimeoutRef.current = window.setTimeout(() => {
            setIsAddressMenuOpen(false)
        }, 150)
    }

    const handleAddressSelect = (suggestion) => {
        setFormData((currentData) => ({
            ...currentData,
            address: suggestion.fullAddress
        }))
        setErrors((currentErrors) => ({
            ...currentErrors,
            address: "",
        }))
        setAddressSuggestions([])
        setAddressLookupError("")
        setIsAddressMenuOpen(false)
    }

    const handleSubmit = e => {
        e.preventDefault()
        const newErrors = {}

        if (!email) {
            onBack()
            return
        }

        const firstNameError = getNameError(formData.firstName, "First name")
        const lastNameError = getNameError(formData.lastName, "Last name")
        const phoneError = getPhilippinePhoneError(formData.phoneNumber, {
            requiredMessage: "Phone number is required"
        })
        const emergencyContactError = getPhilippinePhoneError(formData.emergencyContact, {
            optional: true
        })

        if (firstNameError) newErrors.firstName = firstNameError
        if (lastNameError) newErrors.lastName = lastNameError
        if (phoneError) newErrors.phoneNumber = phoneError
        if (emergencyContactError) newErrors.emergencyContact = emergencyContactError
        if (!formData.address) newErrors.address = "Address is required"
        if (!hasAcceptedTerms) newErrors.terms = "Please read and agree to the Terms of Use and General Service Conditions"

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors)
            return
        }

        setErrors({})
        onComplete({
            ...formData,
            firstName: formData.firstName.trim(),
            lastName: formData.lastName.trim(),
            phoneNumber: normalizePhilippinePhoneForSubmit(formData.phoneNumber),
            emergencyContact: normalizePhilippinePhoneForSubmit(formData.emergencyContact, { optional: true }),
            termsAccepted: true,
            termsDocument: REGISTRATION_TERMS_DOCUMENT_ID,
            email,
            role: "Pet Owner"
        })
    }

    return (
        <div
            className="min-h-screen flex items-center justify-center p-4"
            style={{
                background: "linear-gradient(180deg, #EFF6FF 0%, #FFFFFF 100%)"
            }}
        >
            <div className="w-full max-w-[700px]">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="flex items-center justify-center gap-3 mb-4">
                        <img
                            src={imgImageVfcLogo}
                            alt="iPawcus"
                            className="w-14 h-14 object-contain"
                        />
                        <h1 className="text-3xl font-bold text-[#155dfc]">iPawcus</h1>
                    </div>
                    <p className="text-gray-600">Complete your pet owner profile</p>
                </div>

                {/* Form Card */}
                <Card className="p-4 shadow-lg border border-gray-200 sm:p-8">
                    <div className="mb-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-1">
                            Register - Pet Owner Profile
                        </h2>
                        <p className="text-gray-500">Step 2 of 2: Personal Information</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Personal Information Section */}
                        <div>
                            <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <User className="w-5 h-5 text-blue-600" />
                                Personal Information
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* First Name */}
                                <div>
                                    <Label
                                        htmlFor="firstName"
                                        className="text-gray-900 mb-2 block"
                                    >
                                        First Name
                                    </Label>
                                    <Input
                                        id="firstName"
                                        placeholder="Juan"
                                        restriction="name"
                                        value={formData.firstName}
                                        onChange={e => handleChange("firstName", e.target.value)}
                                        className={`bg-gray-100 border-gray-300 ${
                                            errors.firstName ? "border-red-500" : ""
                                        }`}
                                    />
                                    {errors.firstName && (
                                        <p className="text-red-500 text-xs mt-1">
                                            {errors.firstName}
                                        </p>
                                    )}
                                </div>

                                {/* Last Name */}
                                <div>
                                    <Label
                                        htmlFor="lastName"
                                        className="text-gray-900 mb-2 block"
                                    >
                                        Last Name
                                    </Label>
                                    <Input
                                        id="lastName"
                                        placeholder="Dela Cruz"
                                        restriction="name"
                                        value={formData.lastName}
                                        onChange={e => handleChange("lastName", e.target.value)}
                                        className={`bg-gray-100 border-gray-300 ${
                                            errors.lastName ? "border-red-500" : ""
                                        }`}
                                    />
                                    {errors.lastName && (
                                        <p className="text-red-500 text-xs mt-1">
                                            {errors.lastName}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Contact Information Section */}
                        <div>
                            <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <Phone className="w-5 h-5 text-blue-600" />
                                Contact Information
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Email (Read-only) */}
                                <div>
                                    <Label className="text-gray-900 mb-2 inline-flex items-center gap-2">
                                        <Mail className="w-4 h-4" />
                                        Email Address
                                    </Label>
                                    <Input
                                        value={email}
                                        disabled
                                        className="bg-gray-200 border-gray-300 text-gray-700"
                                    />
                                </div>

                                {/* Phone Number */}
                                <div>
                                    <Label
                                        htmlFor="phoneNumber"
                                        className="text-gray-900 mb-2 inline-flex items-center gap-2"
                                    >
                                        <Phone className="w-4 h-4" />
                                        Phone Number
                                    </Label>
                                    <Input
                                        id="phoneNumber"
                                        inputMode="tel"
                                        restriction="phone"
                                        maxLength={13}
                                        placeholder="+639"
                                        value={formData.phoneNumber}
                                        onChange={e => handleChange("phoneNumber", e.target.value)}
                                        className={`bg-gray-100 border-gray-300 ${
                                            errors.phoneNumber ? "border-red-500" : ""
                                        }`}
                                    />
                                    {errors.phoneNumber && (
                                        <p className="text-red-500 text-xs mt-1">
                                            {errors.phoneNumber}
                                        </p>
                                    )}
                                </div>

                                {/* Address */}
                                <div className="md:col-span-2 relative">
                                    <Label
                                        htmlFor="address"
                                        className="text-gray-900 mb-2 inline-flex items-center gap-2"
                                    >
                                        <MapPin className="w-4 h-4" />
                                        Address
                                    </Label>
                                    <Input
                                        id="address"
                                        placeholder="Domoit, Lucena City Quezon"
                                        value={formData.address}
                                        onChange={e => handleChange("address", e.target.value)}
                                        onFocus={handleAddressFocus}
                                        onBlur={handleAddressBlur}
                                        autoComplete="off"
                                        className={`bg-gray-100 border-gray-300 ${
                                            errors.address ? "border-red-500" : ""
                                        }`}
                                    />
                                    {isAddressMenuOpen && (isSearchingAddress || addressSuggestions.length > 0) && (
                                        <div className="absolute z-10 mt-2 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
                                            {isSearchingAddress && (
                                                <div className="px-4 py-3 text-sm text-gray-500">
                                                    Searching addresses...
                                                </div>
                                            )}

                                            {!isSearchingAddress && addressSuggestions.map((suggestion) => (
                                                <button
                                                    key={suggestion.id}
                                                    type="button"
                                                    onMouseDown={() => handleAddressSelect(suggestion)}
                                                    className="flex w-full items-start gap-2 border-b border-gray-100 px-4 py-3 text-left text-sm text-gray-700 last:border-b-0 hover:bg-blue-50"
                                                >
                                                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                                                    <span>{suggestion.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {addressLookupError && (
                                        <p className="text-amber-600 text-xs mt-1">
                                            {addressLookupError}
                                        </p>
                                    )}
                                    {errors.address && (
                                        <p className="text-red-500 text-xs mt-1">
                                            {errors.address}
                                        </p>
                                    )}
                                </div>


                                {/* Emergency Contact (Optional) */}
                                <div className="md:col-span-2">
                                    <Label
                                        htmlFor="emergencyContact"
                                        className="text-gray-900 mb-2 block"
                                    >
                                        Emergency Contact (Optional)
                                    </Label>
                                    <Input
                                        id="emergencyContact"
                                        inputMode="tel"
                                        restriction="phone"
                                        maxLength={13}
                                        placeholder="+639"
                                        value={formData.emergencyContact}
                                        onChange={e =>
                                            handleChange("emergencyContact", e.target.value)
                                        }
                                        className={`bg-gray-100 border-gray-300 ${
                                            errors.emergencyContact ? "border-red-500" : ""
                                        }`}
                                    />
                                    {errors.emergencyContact && (
                                        <p className="text-red-500 text-xs mt-1">
                                            {errors.emergencyContact}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className={`rounded-lg border p-4 ${
                            errors.terms ? "border-red-300 bg-red-50" : "border-gray-200 bg-gray-50"
                        }`}>
                            <p className="mb-4 text-sm font-medium leading-6 text-gray-700">
                                By creating an iPawcus account, you confirm that you are at least 18 years old,
                                that the information you provide is accurate, and that you are the pet owner or
                                are authorized to act for the owner. iPawcus uses your information to manage your
                                account, pets, appointments, veterinary records, consent, billing, security, and
                                service communications as described in the Privacy Notice. Registration does not
                                authorize surgery, anesthesia, euthanasia, or other future procedures; separate
                                informed consent will be required when applicable.
                            </p>
                            <div className="flex items-start gap-3">
                                <Checkbox
                                    id="termsOfUse"
                                    checked={hasAcceptedTerms}
                                    onCheckedChange={(checked) => {
                                        setHasAcceptedTerms(checked)
                                        if (checked) {
                                            setErrors((currentErrors) => ({
                                                ...currentErrors,
                                                terms: "",
                                            }))
                                        }
                                    }}
                                    className="mt-1"
                                    aria-describedby={errors.terms ? "termsOfUseError" : undefined}
                                />
                                <div className="min-w-0 text-sm leading-6">
                                    <p className="font-medium text-gray-700">
                                        <label htmlFor="termsOfUse">I have read and agree to the iPawcus </label>
                                        <button
                                            type="button"
                                            onClick={() => setIsTermsPreviewOpen(true)}
                                            className="font-semibold text-[#155dfc] underline underline-offset-2 hover:text-[#0d4acf] focus:outline-none focus:ring-2 focus:ring-[#155dfc] focus:ring-offset-2"
                                        >
                                            Terms of Use and General Service Conditions
                                        </button>
                                        {`, Version ${REGISTRATION_TERMS_VERSION}, effective ${REGISTRATION_TERMS_EFFECTIVE_DATE}.`}
                                    </p>
                                    <p className="mt-1 text-xs font-medium text-gray-500">
                                        Registration does not replace separate consent forms for high-risk services or procedures.
                                    </p>
                                    {errors.terms && (
                                        <p id="termsOfUseError" className="mt-2 text-xs font-semibold text-red-600">
                                            {errors.terms}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Profile Preview */}
                        <div className="rounded-xl border-2 border-green-200 bg-gradient-to-r from-green-50 to-blue-50 p-4 sm:p-6">
                            <h3 className="text-sm font-bold text-gray-900 mb-3">
                                Profile Preview
                            </h3>
                            <p className="text-xs text-gray-600 mb-4">
                                This is how your profile will appear:
                            </p>
                            <div className="rounded-lg border border-green-200 bg-white p-4 sm:p-6">
                                <div className="flex items-start gap-4">
                                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-blue-600 text-xl font-bold text-white sm:h-16 sm:w-16 sm:text-2xl">
                                        {formData.firstName ? formData.firstName[0] : "P"}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h4 className="text-xl font-bold text-gray-900">
                                            <span className="block min-[321px]:hidden">
                                                {formData.firstName || "Your Name"}
                                            </span>
                                            <span className="hidden min-[321px]:block">
                                                {formData.firstName || formData.lastName
                                                    ? `${formData.firstName} ${formData.lastName}`.trim()
                                                    : "Your Name"}
                                            </span>
                                        </h4>
                                        <p className="inline-flex items-center gap-1 text-sm text-green-600 mb-1">
                                            <Dog className="h-4 w-4 shrink-0" />
                                            <span className="hidden min-[321px]:inline">Pet Owner</span>
                                        </p>
                                    </div>
                                </div>
                                <div className="mt-4 pt-4 border-t border-gray-200">
                                    <div className="flex flex-col gap-3 text-xs">
                                        <div>
                                            <p className="text-gray-600">Email</p>
                                            <p className="font-semibold text-gray-900 break-all">{email}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-600">Phone</p>
                                            <p className="font-semibold text-gray-900">
                                                {formData.phoneNumber || "Not provided"}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-gray-600">Address</p>
                                            <p className="font-semibold text-gray-900">
                                                {formData.address || "Not provided"}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Buttons */}
                        <div className="flex flex-col-reverse gap-3 sm:flex-row">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onBack}
                                className="flex-1"
                            >
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Back
                            </Button>
                            <Button
                                type="submit"
                                className="flex-1 bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700 text-white"
                            >
                                <span className="block min-[321px]:hidden">Complete</span>
                                <span className="hidden min-[321px]:block">Complete Registration</span>
                            </Button>
                        </div>
                    </form>
                </Card>
            </div>

            <Dialog open={isTermsPreviewOpen} onOpenChange={setIsTermsPreviewOpen}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>Registration Terms and Privacy Notice</DialogTitle>
                        <DialogDescription>
                            Review Version {REGISTRATION_TERMS_VERSION}, effective {REGISTRATION_TERMS_EFFECTIVE_DATE}, before completing registration.
                        </DialogDescription>
                    </DialogHeader>
                    <RegistrationTermsPreview />
                    <DialogFooter>
                        <Button type="button" onClick={() => setIsTermsPreviewOpen(false)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
