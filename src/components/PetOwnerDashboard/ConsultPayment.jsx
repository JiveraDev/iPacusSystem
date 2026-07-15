import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "../dashboardRouter.jsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Label } from "../../ui/label";
import { Input } from "../../ui/input";
import { Textarea } from "../../ui/textarea";
import { Checkbox } from "../../ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { toast } from "../../reusecomponent/toast.jsx";
import { ArrowLeft, CheckCircle, AlertCircle, ShieldCheck } from "lucide-react";
import SignatureCapture from "../SignatureCapture";
import { DECEASED_PET_BOOKING_MESSAGE, isDeceasedPetStatus } from "../../lib/petStatus";
import { createBooking } from "../../services/bookingService";
import { fetchConsentFiles } from "../../services/consentFileService";
import { uploadImageFile } from "../../services/uploadService";
import SubmissionStatus from "../shared/SubmissionStatus";
import { resolveImageUrl } from "../../lib/image";
import { isValidPhilippinePhone, normalizePhilippinePhoneInput } from "../../lib/philippinePhone";
import { normalizeConsentTemplate, pickConsentForContext } from "../../lib/consentAssignments";
import { paymentMethodInstruction, paymentMethodRequiresProof, usePaymentMethods } from "../../hooks/usePaymentMethods";
import { PhotoViewer } from "../../ui/photo-viewer";
import FileUploadDropzone from "../shared/FileUploadDropzone";

export default function ConsultPayment() {
  const navigate = useNavigate();
  const [bookingData, setBookingData] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [signature, setSignature] = useState(null);
  const [viewer, setViewer] = useState(null);
  const [consentTemplates, setConsentTemplates] = useState([]);
  const [isLoadingConsent, setIsLoadingConsent] = useState(false);
  const [consents, setConsents] = useState({
    terms: false,
    privacy: false,
    teleconsult: false,
  });
  const [formData, setFormData] = useState({
    paymentMethod: "",
    referenceNumber: "",
    senderNumber: "",
    amount: "",
    receiptFile: null,
  });
  const { paymentMethods, isLoadingPaymentMethods } = usePaymentMethods();
  const selectedMethod = paymentMethods.find((m) => m.value === formData.paymentMethod);
  const selectedMethodRequiresProof = paymentMethodRequiresProof(selectedMethod);
  const senderRequiresPhilippineMobile = ["gcash", "maya"].includes(String(selectedMethod?.value || "").toLowerCase());
  const selectedQrUrl = resolveImageUrl(selectedMethod?.qrImageUrl || "");
  const isMobileWalletPaymentMethod = (value) => ["gcash", "maya"].includes(String(value || "").toLowerCase());
  const onlineConsentTemplate = useMemo(
    () => pickConsentForContext(consentTemplates, "online-consultation"),
    [consentTemplates]
  );

  const handlePaymentMethodChange = (value) => {
    setFormData({
      ...formData,
      paymentMethod: value,
      senderNumber: isMobileWalletPaymentMethod(value)
        ? normalizePhilippinePhoneInput(formData.senderNumber)
        : formData.senderNumber
    });
  };

  useEffect(() => {
    const pending = sessionStorage.getItem("pendingBooking");
    if (!pending) {
      navigate("/dashboard/consult/booking");
      return;
    }
    setBookingData(JSON.parse(pending));
  }, [navigate]);

  useEffect(() => {
    let isActive = true;

    const loadConsentTemplates = async () => {
      setIsLoadingConsent(true);
      try {
        const data = await fetchConsentFiles();
        if (!isActive) return;

        setConsentTemplates(Array.isArray(data)
          ? data.map(normalizeConsentTemplate).filter((template) => template.id)
          : []);
      } catch (error) {
        if (isActive) {
          setConsentTemplates([]);
          toast.error(error.message || "Could not load online consultation consent form.");
        }
      } finally {
        if (isActive) {
          setIsLoadingConsent(false);
        }
      }
    };

    loadConsentTemplates();

    return () => {
      isActive = false;
    };
  }, []);

  const dataURLtoFile = (dataurl, filename) => {
    if (!dataurl) return null;

    const [header, base64Value] = dataurl.split(",");
    const mime = header.match(/:(.*?);/)?.[1] || "image/png";
    const binary = atob(base64Value);
    const array = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      array[index] = binary.charCodeAt(index);
    }

    return new File([array], filename, { type: mime });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isProcessing) {
      return;
    }

    if (isDeceasedPetStatus(bookingData?.petStatus)) {
      toast.error(DECEASED_PET_BOOKING_MESSAGE);
      navigate("/dashboard/consult/booking");
      return;
    }
    
    if (!consents.terms || !consents.privacy || !consents.teleconsult) {
      toast.error("Please agree to all consultation consent items");
      return;
    }
    if (!onlineConsentTemplate) {
      toast.error("No online consultation consent form is assigned. Please contact the clinic.");
      return;
    }
    if (!signature) {
      toast.error("Please provide your digital signature");
      return;
    }
    if (!formData.paymentMethod) {
      toast.error("Please select a payment method");
      return;
    }
    if (!formData.receiptFile && selectedMethodRequiresProof) {
      toast.error("Please upload proof of payment");
      return;
    }

    const rawSenderNumber = formData.senderNumber;
    const senderNumber = senderRequiresPhilippineMobile
      ? normalizePhilippinePhoneInput(rawSenderNumber)
      : formData.senderNumber.trim();
    if (senderRequiresPhilippineMobile && !isValidPhilippinePhone(rawSenderNumber)) {
      toast.error("Sender number must be complete after +639.");
      return;
    }
    
    setIsProcessing(true);

    try {
      const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
      
      // 1. Upload Receipt if available
      let receiptUrl = null;
      if (formData.receiptFile) {
        receiptUrl = await uploadImageFile(formData.receiptFile, "booking_payment");
      }

      let finalSignatureUrl = signature;
      if (signature.startsWith("data:image")) {
        const signatureFile = dataURLtoFile(signature, `signature_${Date.now()}.png`);
        finalSignatureUrl = await uploadImageFile(signatureFile, "booking_signature");
      }
      const ownerName = [
        currentUser.firstName || currentUser.first_Name || currentUser.first_name,
        currentUser.lastName || currentUser.last_Name || currentUser.last_name
      ].filter(Boolean).join(" ").trim() || currentUser.name || "Pet owner";
      const signedAt = new Date().toISOString();

      const uploadedConcernUrls = [];
      if (Array.isArray(bookingData.concernImages)) {
        for (let index = 0; index < bookingData.concernImages.length; index += 1) {
          const image = bookingData.concernImages[index];
          if (typeof image === "string" && image.startsWith("data:image")) {
            const imageFile = dataURLtoFile(image, `consult_concern_${Date.now()}_${index}.png`);
            const url = await uploadImageFile(imageFile, "booking_concern");
            uploadedConcernUrls.push(url);
          } else if (image) {
            uploadedConcernUrls.push(image);
          }
        }
      }

      // 2. Prepare Final Booking Data
      const finalBookingData = {
        user_id: currentUser.id || currentUser.user_id,
        pet_id: bookingData.petId === "new-pet" ? null : bookingData.petDbId || bookingData.petId,
        service_type: "consultation",
        booking_date: bookingData.date,
        booking_time: bookingData.time,
        notes: [
          `[Topic: ${bookingData.discussionTopic}]`,
          bookingData.notes ? bookingData.notes : "",
          senderNumber ? `[Sender Number: ${senderNumber}]` : "",
          formData.referenceNumber ? `[Transaction Reference: ${formData.referenceNumber}]` : ""
        ].filter(Boolean).join("\n"),
        petType: bookingData.petSpecies,
        registered_status: bookingData.petId === "new-pet" ? "Not Registered" : "Registered",
        new_pet_name: bookingData.petId === "new-pet" ? bookingData.petName : null,
        new_pet_breed: bookingData.petId === "new-pet" ? bookingData.petBreed : null,
        new_pet_age: bookingData.petId === "new-pet" ? bookingData.petAge : null,
        new_pet_weight: bookingData.petId === "new-pet" ? bookingData.petWeight : null,
        is_online_consultation: 1,
        veterinarian_id: bookingData.veterinarianId,
        signature: finalSignatureUrl,
        Image_Booking_Concern_Path: uploadedConcernUrls.length > 0 ? uploadedConcernUrls.join(",") : null,
        payment_proof_url: receiptUrl,
        payment_method: formData.paymentMethod,
        payment_reference: formData.referenceNumber,
        price: formData.amount || "500",
        consent_forms: [{
          id: onlineConsentTemplate.id,
          title: onlineConsentTemplate.title,
          category: onlineConsentTemplate.category || "online-consultation",
          content: onlineConsentTemplate.content,
          signerName: ownerName,
          signedAt,
          signaturePath: finalSignatureUrl,
          serviceType: "Online Consultation"
        }],
        consent_status: "signed"
      };

      // 3. Submit to DB
      const result = await createBooking(finalBookingData);
      toast.success("Consultation booking submitted successfully!");
      sessionStorage.removeItem("pendingBooking");
      navigate(`/dashboard/consult/confirmation/${result.booking_id || "success"}`);
    } catch (error) {
      console.error("Submission error:", error);
      toast.error(error.message || "An error occurred during submission");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReceiptChange = (files) => {
    setFormData({ ...formData, receiptFile: Array.from(files || [])[0] || null });
  };

  if (!bookingData) {
    return null;
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <Button variant="ghost" onClick={() => navigate("/dashboard/consult/booking")} className="self-start">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Complete Payment</h1>
        </div>
      </div>

      {/* Information Banner */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-sm text-gray-700">
              <p className="font-semibold mb-2">Important Instructions:</p>
              <ul className="space-y-1 ml-4">
                <li>• Select your preferred payment method below</li>
                <li>• Upload clear photo/screenshot of your payment receipt</li>
                <li>• Include reference number if applicable</li>
                <li>• Our team will verify your payment within 24 hours</li>
                <li>• You will receive a confirmation email once verified</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-green-600" />
            Consent & Digital Signature
          </CardTitle>
          <CardDescription>Confirm the online consultation consent before submitting payment</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <p className="font-semibold text-gray-900">
                {isLoadingConsent
                  ? "Loading consent form..."
                  : onlineConsentTemplate?.title || "No online consultation consent assigned"}
              </p>
              {onlineConsentTemplate && (
                <span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-blue-700">
                  {onlineConsentTemplate.category || "online-consultation"}
                </span>
              )}
            </div>
            <p className="max-h-52 overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-gray-700">
              {onlineConsentTemplate?.content || "An admin must assign an online consultation consent form in Consent Management before this booking can be submitted."}
            </p>
          </div>

          <div className="space-y-4 rounded-lg border bg-gray-50 p-4">
            <div className="flex items-start gap-3">
              <Checkbox
                id="consultTerms"
                checked={consents.terms}
                onCheckedChange={(checked) => setConsents({ ...consents, terms: checked })}
              />
              <div className="space-y-1">
                <Label htmlFor="consultTerms" className="text-sm font-medium">
                  I agree to the online consultation fee and terms
                </Label>
                <p className="text-xs text-gray-500">
                  I understand the consultation will be reviewed after payment verification.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Checkbox
                id="consultTelehealth"
                checked={consents.teleconsult}
                onCheckedChange={(checked) => setConsents({ ...consents, teleconsult: checked })}
              />
              <div className="space-y-1">
                <Label htmlFor="consultTelehealth" className="text-sm font-medium">
                  I authorize online veterinary consultation
                </Label>
                <p className="text-xs text-gray-500">
                  I understand that an online consultation may require an in-clinic follow-up when needed.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Checkbox
                id="consultPrivacy"
                checked={consents.privacy}
                onCheckedChange={(checked) => setConsents({ ...consents, privacy: checked })}
              />
              <div className="space-y-1">
                <Label htmlFor="consultPrivacy" className="text-sm font-medium">
                  Data Privacy Consent
                </Label>
                <p className="text-xs text-gray-500">
                  I allow the clinic to use the submitted pet details, photos, and signature for this booking.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Label className="font-semibold text-gray-900">Digital Signature *</Label>
            <SignatureCapture
              signature={signature}
              onSignatureChange={setSignature}
              disabled={!consents.terms || !consents.privacy || !consents.teleconsult || !onlineConsentTemplate || isLoadingConsent}
            />
          </div>
        </CardContent>
      </Card>

      {/* Payment Form */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Details</CardTitle>
          <CardDescription>Fill in your payment information below</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Payment Method Selection */}
            <div className="space-y-2">
              <Label htmlFor="paymentMethod">Payment Method *</Label>
              <Select
                value={formData.paymentMethod}
                onValueChange={handlePaymentMethodChange}
                disabled={isLoadingPaymentMethods}
                searchPlaceholder="Search payment method"
              >
                <SelectTrigger id="paymentMethod">
                  <SelectValue placeholder={isLoadingPaymentMethods ? "Loading payment methods..." : "Select payment method"} displayValue={selectedMethod?.label} />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((method) => (
                    <SelectItem key={method.value} value={method.value} searchText={method.label}>
                      {method.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Payment Method Instructions */}
            {selectedMethod && (
              <Card className="bg-green-50 border-green-200">
                <CardContent className="pt-6">
                  <div className="flex gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-gray-900 mb-1">{selectedMethod.label} Instructions:</p>
                      <p className="whitespace-pre-wrap text-sm text-gray-700">{paymentMethodInstruction(selectedMethod)}</p>
                      {selectedQrUrl && (
                        <button
                          type="button"
                          onClick={() => setViewer({ src: selectedQrUrl, alt: `${selectedMethod.label} QR` })}
                          className="mt-3 group block rounded-lg border border-green-100 bg-white p-2 text-left transition hover:border-green-300 focus:outline-none focus:ring-2 focus:ring-green-200"
                          aria-label={`Open larger ${selectedMethod.label} QR image`}
                        >
                          <img src={selectedQrUrl} alt={`${selectedMethod.label} QR`} className="max-h-48 rounded-md object-contain" />
                        </button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="amount">Amount Paid *</Label>
              <Input
                id="amount"
                type="number"
                required
                placeholder="Enter amount (e.g., 500.00)"
                restriction="decimal"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              />
            </div>

            {/* Reference Number */}
            <div className="space-y-2">
              <Label htmlFor="referenceNumber">Reference/Transaction Number</Label>
              <Input
                id="referenceNumber"
                placeholder="Enter reference number (if applicable)"
                restriction="alphanumeric"
                value={formData.referenceNumber}
                onChange={(e) => setFormData({ ...formData, referenceNumber: e.target.value })}
              />
              <p className="text-xs text-gray-500">
                For QRPH, Maya, GCash, and Bank Transfer, please include the transaction reference number
              </p>
            </div>

            {/* Sender Number */}
            <div className="space-y-2">
              <Label htmlFor="senderNumber">Sender Number / Account Details</Label>
              <Textarea
                id="senderNumber"
                placeholder={senderRequiresPhilippineMobile ? "+639" : "Enter the sender's number or account name used for payment"}
                value={senderRequiresPhilippineMobile ? normalizePhilippinePhoneInput(formData.senderNumber) : formData.senderNumber}
                onChange={(e) => setFormData({
                  ...formData,
                  senderNumber: senderRequiresPhilippineMobile
                    ? normalizePhilippinePhoneInput(e.target.value)
                    : e.target.value
                })}
                inputMode={senderRequiresPhilippineMobile ? "tel" : undefined}
                maxLength={senderRequiresPhilippineMobile ? 13 : undefined}
                rows={3}
              />
              <p className="text-xs text-gray-500">
                Required for online payments so the admin can match the payment to the correct sender.
              </p>
            </div>

            {/* Receipt Upload */}
            <div className="space-y-2">
              <Label htmlFor="receipt">Upload Payment Proof/Receipt {selectedMethodRequiresProof && "*"}</Label>
              <FileUploadDropzone
                id="receipt"
                accept="image/*,.pdf"
                files={formData.receiptFile ? [formData.receiptFile] : []}
                onFilesSelected={handleReceiptChange}
                onRemove={() => setFormData({ ...formData, receiptFile: null })}
                label="Click to upload receipt"
                helper="PNG, JPG, WEBP, GIF, or PDF up to 8 MB"
              />
            </div>

            {/* Submit Button */}
            <SubmissionStatus
              active={isProcessing}
              label="Submitting payment..."
              slowLabel="Still submitting payment..."
            />

            <Button
              type="submit"
              className="w-full h-12 text-base"
              disabled={isProcessing || isLoadingPaymentMethods || isLoadingConsent || !onlineConsentTemplate}
            >
              {isProcessing ? "Submitting Payment..." : "Submit Payment"}
            </Button>
          </form>
        </CardContent>
      </Card>
      <PhotoViewer
        open={Boolean(viewer)}
        src={viewer?.src || ""}
        alt={viewer?.alt || "Payment QR"}
        onOpenChange={(open) => !open && setViewer(null)}
      />
    </div>
  );
}

