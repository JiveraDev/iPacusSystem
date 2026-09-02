import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "../dashboardRouter.jsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Label } from "../../ui/label";
import { Input } from "../../ui/input";
import { Textarea } from "../../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { toast } from "../../reusecomponent/toast.jsx";
import { ArrowLeft, CheckCircle, AlertCircle, ShieldCheck } from "lucide-react";
import SignatureCapture from "../SignatureCapture";
import { DECEASED_PET_BOOKING_MESSAGE, isDeceasedPetStatus } from "../../lib/petStatus";
import { createBooking } from "../../services/bookingService";
import { fetchConsentFiles } from "../../services/consentFileService";
import { createAndUploadConsentDocumentPdf } from "../../services/consentDocumentPdf";
import { uploadImageFile } from "../../services/uploadService";
import SubmissionStatus from "../shared/SubmissionStatus";
import { isValidPhilippinePhone, normalizePhilippinePhoneInput } from "../../lib/philippinePhone";
import { normalizeConsentTemplate, pickConsentForContext } from "../../lib/consentAssignments";
import { paymentMethodInstruction, usePaymentMethods } from "../../hooks/usePaymentMethods";
import { PhotoViewer } from "../../ui/photo-viewer";
import FileUploadDropzone from "../shared/FileUploadDropzone";
import ProtectedImage from "../shared/ProtectedImage";
import { saveOnlineConsultationSubmission } from "../../lib/onlineConsultationSubmission";
import { isValidTransactionNumber, normalizeTransactionNumber, TRANSACTION_NUMBER_MESSAGE } from "../../lib/transactionNumber";
import { reportBookingFormErrors, reportBookingSubmissionError } from "../../lib/bookingFormValidation";
import DashboardPageHeader from "../shared/DashboardPageHeader.jsx";
import ConsentTemplateText from "../shared/ConsentTemplateText.jsx";

export default function ConsultPayment() {
  const navigate = useNavigate();
  const [bookingData, setBookingData] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [signature, setSignature] = useState(null);
  const [viewer, setViewer] = useState(null);
  const [consentTemplates, setConsentTemplates] = useState([]);
  const [isLoadingConsent, setIsLoadingConsent] = useState(false);
  const [formData, setFormData] = useState({
    paymentMethod: "",
    referenceNumber: "",
    senderNumber: "",
    amount: "500.00",
    receiptFile: null,
  });
  const { paymentMethods: configuredPaymentMethods, isLoadingPaymentMethods } = usePaymentMethods();
  const paymentMethods = configuredPaymentMethods;
  const selectedMethod = paymentMethods.find((m) => m.value === formData.paymentMethod);
  const senderRequiresPhilippineMobile = selectedMethod?.methodType === 'ewallet';
  const selectedQrUrl = selectedMethod?.qrImageUrl || "";
  const isMobileWalletPaymentMethod = (value) => (
    paymentMethods.find((method) => method.value === value)?.methodType === 'ewallet'
  );
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
    
    if (!onlineConsentTemplate) {
      toast.error("No online consultation consent form is assigned. Please contact the clinic.");
      return;
    }
    const rawSenderNumber = formData.senderNumber;
    const senderNumber = senderRequiresPhilippineMobile
      ? normalizePhilippinePhoneInput(rawSenderNumber)
      : formData.senderNumber.trim();
    const validationErrors = [];
    if (!signature) validationErrors.push({ fieldId: 'consult-signature', label: 'Digital signature', type: 'missing', message: 'Provide your digital signature.' });
    if (!formData.paymentMethod) validationErrors.push({ fieldId: 'paymentMethod', label: 'Payment method', type: 'selection', message: 'Select a payment method.' });
    if (!formData.referenceNumber.trim()) {
      validationErrors.push({ fieldId: 'referenceNumber', label: 'Transaction number', type: 'missing', message: 'Enter the 18-digit payment transaction number.' });
    } else if (!isValidTransactionNumber(formData.referenceNumber)) {
      validationErrors.push({ fieldId: 'referenceNumber', label: 'Transaction number', type: 'invalid', message: TRANSACTION_NUMBER_MESSAGE });
    }
    if (!formData.receiptFile) {
      validationErrors.push({ fieldId: 'receipt', label: 'Payment proof', type: 'upload', message: 'Upload the payment receipt or screenshot.' });
    } else if (Number(formData.receiptFile.size || 0) > 8 * 1024 * 1024) {
      validationErrors.push({ fieldId: 'receipt', label: 'Payment proof', type: 'upload', message: 'Payment proof must be 8 MB or smaller.' });
    } else if (!(String(formData.receiptFile.type || '').startsWith('image/') || formData.receiptFile.type === 'application/pdf')) {
      validationErrors.push({ fieldId: 'receipt', label: 'Payment proof', type: 'upload', message: 'Payment proof must be an image or PDF file.' });
    }
    if (senderRequiresPhilippineMobile && !isValidPhilippinePhone(rawSenderNumber)) {
      validationErrors.push({ fieldId: 'senderNumber', label: 'Sender number', type: 'invalid', message: 'Sender number must be complete after +639.' });
    }
    if (reportBookingFormErrors(validationErrors)) return;
    
    setIsProcessing(true);

    try {
      const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
      
      // 1. Upload Receipt if available
      let receiptUrl = null;
      if (formData.receiptFile) {
        receiptUrl = await uploadImageFile(formData.receiptFile, "booking_payment");
      }

      const ownerName = [
        currentUser.firstName || currentUser.first_Name || currentUser.first_name,
        currentUser.lastName || currentUser.last_Name || currentUser.last_name
      ].filter(Boolean).join(" ").trim() || currentUser.name || "Pet owner";
      const signedAt = new Date().toISOString();
      const signedConsentDocumentUrl = await createAndUploadConsentDocumentPdf({
        title: onlineConsentTemplate.title,
        content: onlineConsentTemplate.content,
        signatureImage: signature,
        signerName: ownerName,
        signedAt,
        veterinarianName: bookingData.veterinarianName || bookingData.veterinarian,
        veterinarianLicense: bookingData.veterinarianLicense || bookingData.licenseNumber || '',
        templateContext: {
          ownerName,
          ownerAddress: currentUser.personal_Address || currentUser.address || '',
          ownerPhone: currentUser.phoneNumber || currentUser.phone || '',
          petName: bookingData.petName,
          petSpecies: bookingData.petSpecies,
          petBreed: bookingData.petBreed,
          veterinarianName: bookingData.veterinarianName || bookingData.veterinarian,
          veterinarianLicense: bookingData.veterinarianLicense || bookingData.licenseNumber || '',
          serviceName: 'Online Consultation',
          branchName: 'Vetfocus Care Animal Clinic'
        }
      }, "online_consultation_consent");
      if (!signedConsentDocumentUrl) {
        throw new Error("The signed consent document could not be saved. Please try again.");
      }

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
        signature: signedConsentDocumentUrl,
        Image_Booking_Concern_Path: uploadedConcernUrls.length > 0 ? uploadedConcernUrls.join(",") : null,
        payment_proof_url: receiptUrl,
        payment_method: formData.paymentMethod,
        payment_reference: formData.referenceNumber,
        payment_amount: Number(formData.amount),
        price: formData.amount || "500",
        consent_forms: [{
          id: onlineConsentTemplate.id,
          title: onlineConsentTemplate.title,
          category: onlineConsentTemplate.category || "online-consultation",
          content: onlineConsentTemplate.content,
          signerName: ownerName,
          signedAt,
          documentPath: signedConsentDocumentUrl,
          signaturePath: signedConsentDocumentUrl,
          serviceType: "Online Consultation"
        }],
        consent_status: "signed"
      };

      // 3. Submit to DB
      const result = await createBooking(finalBookingData);
      const createdBookingId = result?.booking_id || result?.bookingId || result?.id || "";
      saveOnlineConsultationSubmission({
        bookingId: createdBookingId,
        bookingNumber: result?.booking_number || result?.bookingNumber || "",
        petName: bookingData.petName || "",
        bookingDate: bookingData.date || "",
        bookingTime: bookingData.time || "",
        veterinarianName: bookingData.veterinarianName || bookingData.veterinarian || "",
        amount: formData.amount || result?.price || "500"
      });
      toast.success("Consultation booking submitted successfully!");
      sessionStorage.removeItem("pendingBooking");
      navigate(`/dashboard/consult/confirmation/${createdBookingId || "success"}`);
    } catch (error) {
      console.error("Submission error:", error);
      reportBookingSubmissionError(error, {
        transaction: 'referenceNumber',
        upload: 'receipt',
      });
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

  const previewUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
  const previewOwnerName = [
    previewUser.firstName || previewUser.first_Name || previewUser.first_name,
    previewUser.lastName || previewUser.last_Name || previewUser.last_name
  ].filter(Boolean).join(" ").trim() || previewUser.name || "Pet owner";
  const consentPreviewContext = {
    ownerName: previewOwnerName,
    ownerAddress: previewUser.personal_Address || previewUser.address || '',
    ownerPhone: previewUser.phoneNumber || previewUser.phone || '',
    petName: bookingData.petName,
    petSpecies: bookingData.petSpecies,
    petBreed: bookingData.petBreed,
    veterinarianName: bookingData.veterinarianName || bookingData.veterinarian,
    veterinarianLicense: bookingData.veterinarianLicense || bookingData.licenseNumber || '',
    serviceName: 'Online Consultation',
    branchName: 'Vetfocus Care Animal Clinic'
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <DashboardPageHeader
        icon={ShieldCheck}
        title="Complete Payment"
        description="Review the consultation details and submit the required payment reference."
        navigation={(
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/consult/booking")} className="-ml-2 gap-2">
            <ArrowLeft className="size-4" /> Back to Booking
          </Button>
        )}
      />

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
                <li>• Enter the transaction reference shown on the receipt</li>
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
          <CardDescription>Review the assigned consent form, then sign it before submitting payment</CardDescription>
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
            <ConsentTemplateText
              content={onlineConsentTemplate?.content}
              context={consentPreviewContext}
              fallback="An admin must assign an online consultation consent form in Consent Management before this booking can be submitted."
              className="max-h-52 overflow-y-auto text-sm leading-6 text-gray-700"
            />
          </div>

          <div id="consult-signature" tabIndex={-1} className="space-y-3 rounded-xl">
            <Label className="font-semibold text-gray-900">Digital Signature *</Label>
            <SignatureCapture
              signature={signature}
              onSignatureChange={setSignature}
              disabled={!onlineConsentTemplate || isLoadingConsent}
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
          <form onSubmit={handleSubmit} noValidate className="space-y-6">
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
                          <ProtectedImage
                            src={selectedQrUrl}
                            alt={`${selectedMethod.label} QR`}
                            className="max-h-48 rounded-md object-contain"
                            fallbackClassName="h-48 w-48 rounded-md"
                          />
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
                readOnly
              />
              <p className="text-xs font-medium text-slate-500">Official online consultation prepayment.</p>
            </div>

            {/* Reference Number */}
            <div className="space-y-2">
              <Label htmlFor="referenceNumber">Reference/Transaction Number *</Label>
              <Input
                id="referenceNumber"
                placeholder="Enter exactly 18 digits"
                restriction="digits"
                inputMode="numeric"
                maxLength={18}
                value={formData.referenceNumber}
                onChange={(e) => setFormData({
                  ...formData,
                  referenceNumber: normalizeTransactionNumber(e.target.value)
                })}
              />
              <p className="text-xs text-gray-500">
                Enter the complete 18-digit transaction number shown on the receipt.
              </p>
            </div>

            {/* Sender Number */}
            <div className="space-y-2">
              <Label htmlFor="senderNumber">Sender Number / Account Details</Label>
              <Textarea
                id="senderNumber"
                placeholder={senderRequiresPhilippineMobile ? "+639" : "Sender number or account name"}
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
              <Label htmlFor="receipt">Upload Payment Proof/Receipt *</Label>
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

