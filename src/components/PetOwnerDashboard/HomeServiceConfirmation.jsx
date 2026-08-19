import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "../dashboardRouter.jsx";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../ui/card";
import { Button } from "../../ui/button";
import { Label } from "../../ui/label";
import { Input } from "../../ui/input";
import { Textarea } from "../../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { toast } from "../../reusecomponent/toast.jsx";
import { 
  Calendar, Clock, MapPin, AlertCircle, FileText, 
  ShieldCheck, CheckCircle, Loader2, ArrowLeft
} from "lucide-react";
import SignatureCapture from "../SignatureCapture";
import { formatDisplayDate, formatDisplayTime } from "../../lib/date";
import { DECEASED_PET_BOOKING_MESSAGE, isDeceasedPetStatus } from "../../lib/petStatus";
import { createBooking } from "../../services/bookingService";
import { fetchConsentFiles } from "../../services/consentFileService";
import { createAndUploadConsentDocumentPdf } from "../../services/consentDocumentPdf";
import { uploadImageFile } from "../../services/uploadService";
import SubmissionStatus from "../shared/SubmissionStatus";
import { paymentMethodInstruction, usePaymentMethods } from "../../hooks/usePaymentMethods";
import { normalizeConsentTemplate, pickConsentForContext } from "../../lib/consentAssignments";
import { PhotoViewer } from "../../ui/photo-viewer";
import FileUploadDropzone from "../shared/FileUploadDropzone";
import ProtectedImage from "../shared/ProtectedImage";
import { homeServicePriceById } from "../../lib/servicePriceProjections";
import { useBookingPriceProjections } from "../../hooks/useBookingPriceProjections";
import { resolveConsentTemplate } from "../../lib/consentTemplateCodes";

const HOME_SERVICE_TRANSPORT_FEE = 50;

export default function HomeServiceConfirmation() {
    const navigate = useNavigate();
    const { config: priceProjectionConfig } = useBookingPriceProjections();
    const homeServicePrice = (id) => homeServicePriceById(priceProjectionConfig, id);
    const [booking, setBooking] = useState(null);
  const [signature, setSignature] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewer, setViewer] = useState(null);
  const [consentTemplates, setConsentTemplates] = useState([]);
  const [isLoadingConsent, setIsLoadingConsent] = useState(false);

  // Payment Form State
  const [paymentFormData, setPaymentFormData] = useState({
    paymentMethod: "",
    referenceNumber: "",
    notes: "",
    receiptFile: null
  });
  const { paymentMethods: configuredPaymentMethods, isLoadingPaymentMethods } = usePaymentMethods();
  const paymentMethods = configuredPaymentMethods;
  const selectedMethod = paymentMethods.find((m) => m.value === paymentFormData.paymentMethod);
  const selectedQrUrl = selectedMethod?.qrImageUrl || "";
  const homeServiceConsentTemplate = useMemo(
    () => pickConsentForContext(consentTemplates, "home-service"),
    [consentTemplates]
  );

  useEffect(() => {
    const pendingBooking = sessionStorage.getItem("pendingHomeBooking");
    if (pendingBooking) {
      setBooking(JSON.parse(pendingBooking));
    }
  }, []);

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
          toast.error(error.message || "Could not load home service consent form.");
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
    let arr = dataurl.split(','),
        mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[1]), 
        n = bstr.length, 
        u8arr = new Uint8Array(n);
        
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    
    return new File([u8arr], filename, {type:mime});
  };

  const handleFinalSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) {
      return;
    }

    if (isDeceasedPetStatus(booking?.petStatus)) {
      toast.error(DECEASED_PET_BOOKING_MESSAGE);
      navigate("/dashboard/services/home-services");
      return;
    }
    
    if (!homeServiceConsentTemplate) {
      toast.error("No home service consent form is assigned. Please contact the clinic.");
      return;
    }
    if (!signature) {
      toast.error("Please provide your signature.");
      return;
    }
    if (!paymentFormData.paymentMethod) {
      toast.error("Please select a payment method.");
      return;
    }
    if (!paymentFormData.referenceNumber.trim()) {
      toast.error("Please enter the payment transaction reference.");
      return;
    }
    if (!paymentFormData.receiptFile) {
      toast.error("Please upload proof of payment.");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Upload Receipt
      const receiptUrl = paymentFormData.receiptFile
        ? await uploadImageFile(paymentFormData.receiptFile, "booking_payment")
        : null;

      const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
      const ownerName = [
        currentUser.firstName || currentUser.first_Name || currentUser.first_name,
        currentUser.lastName || currentUser.last_Name || currentUser.last_name
      ].filter(Boolean).join(" ").trim() || currentUser.name || "Pet owner";
      const signedAt = new Date().toISOString();
      const signedConsentDocumentUrl = await createAndUploadConsentDocumentPdf({
        title: homeServiceConsentTemplate.title,
        content: homeServiceConsentTemplate.content,
        signatureImage: signature,
        signerName: ownerName,
        signedAt,
        templateContext: {
          ownerName,
          ownerAddress: currentUser.personal_Address || currentUser.address || booking.address || '',
          ownerPhone: currentUser.phoneNumber || currentUser.phone || '',
          petName: booking.new_pet_name || booking.petName,
          petSpecies: booking.petType || booking.petSpecies,
          petBreed: booking.new_pet_breed || booking.petBreed,
          serviceName: 'Home Service',
          branchName: 'Vetfocus Care Animal Clinic'
        }
      }, "home_service_consent");
      if (!signedConsentDocumentUrl) {
        throw new Error("The signed consent document could not be saved. Please try again.");
      }

      // 3. Upload Additional Images (Concerns)
      let uploadedConcernUrls = [];
      if (booking.images && Array.isArray(booking.images)) {
        for (let i = 0; i < booking.images.length; i++) {
          const img = booking.images[i];
          if (img.startsWith('data:image')) {
            const imgFile = dataURLtoFile(img, `concern_${Date.now()}_${i}.png`);
            const url = await uploadImageFile(imgFile, "booking_concern");
            uploadedConcernUrls.push(url);
          } else {
            uploadedConcernUrls.push(img);
          }
        }
      }

      // 4. Prepare Final Booking Data
      const finalBookingData = {
        ...booking,
        signature: signedConsentDocumentUrl,
        payment_proof_url: receiptUrl,
        payment_method: paymentFormData.paymentMethod,
        payment_reference: paymentFormData.referenceNumber,
        payment_amount: HOME_SERVICE_TRANSPORT_FEE,
        transport_fee: HOME_SERVICE_TRANSPORT_FEE,
        specific_location: booking.specific_location,
        Image_Booking_Concern_Path: uploadedConcernUrls.length > 0 ? uploadedConcernUrls.join(",") : null,
        consent_forms: [{
          id: homeServiceConsentTemplate.id,
          title: homeServiceConsentTemplate.title,
          category: homeServiceConsentTemplate.category || "home-service",
          content: homeServiceConsentTemplate.content,
          signerName: ownerName,
          signedAt,
          documentPath: signedConsentDocumentUrl,
          signaturePath: signedConsentDocumentUrl,
          serviceType: "Home Service"
        }],
        consent_status: "signed"
      };

      // 5. Submit to DB
      await createBooking(finalBookingData);
      toast.success("Home Service Booking submitted successfully!");
      sessionStorage.removeItem("pendingHomeBooking");
      navigate("/dashboard/services"); 
    } catch (error) {
      console.error("Submission error:", error);
      toast.error(error.message || "An error occurred during submission");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!booking) {
    return (
      <div className="mx-auto max-w-4xl space-y-8 p-4 sm:p-8">
        <Card>
          <CardContent className="pt-6 text-center py-12">
            <AlertCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">Booking Data Not Found</h3>
            <p className="text-gray-600 mb-4">We couldn't find your booking details.</p>
            <Button onClick={() => navigate("/dashboard/services/home-services")}>Back to Home Services</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const previewUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
  const previewOwnerName = [
    previewUser.firstName || previewUser.first_Name || previewUser.first_name,
    previewUser.lastName || previewUser.last_Name || previewUser.last_name
  ].filter(Boolean).join(" ").trim() || previewUser.name || "Pet owner";
  const consentPreviewContent = homeServiceConsentTemplate
    ? resolveConsentTemplate(homeServiceConsentTemplate.content, {
        ownerName: previewOwnerName,
        ownerAddress: previewUser.personal_Address || previewUser.address || booking.address || '',
        ownerPhone: previewUser.phoneNumber || previewUser.phone || '',
        petName: booking.new_pet_name || booking.petName,
        petSpecies: booking.petType || booking.petSpecies,
        petBreed: booking.new_pet_breed || booking.petBreed,
        serviceName: 'Home Service',
        branchName: 'Vetfocus Care Animal Clinic'
      }, { preview: true })
    : '';

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-10">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
          <FileText className="h-10 w-10 text-blue-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Review Your Request</h1>
        <p className="text-gray-500">Please verify details, sign, and review the home-service pricing projection</p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-lg">Service & Pet</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs text-gray-500 uppercase font-bold">Pet Name</p>
              <p className="font-semibold text-lg">{booking.new_pet_name || booking.petName || "Selected Pet"}</p>
              <p className="text-sm text-gray-600">{booking.petType} - {booking.new_pet_breed || booking.petBreed || "Registered Breed"}</p>
            </div>
            <div className="pt-4 border-t">
              <p className="text-xs text-gray-500 uppercase font-bold">Requested Services</p>
              <p className="text-sm font-medium mt-1">{booking.notes.match(/\[Services: (.*?)\]/)?.[1] || "Home Service"}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Schedule & Location</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <p className="text-xs text-gray-500 uppercase font-bold">Preferred Date</p>
                <p className="font-semibold">{formatDisplayDate(booking.booking_date)}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                    <p className="text-xs text-gray-500 uppercase font-bold">Preferred Time</p>
                    <p className="font-semibold">{formatDisplayTime(booking.booking_time)}</p>
                </div>
            </div>
            <div className="flex items-start gap-3 pt-2 border-t">
              <MapPin className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <p className="text-xs text-gray-500 uppercase font-bold">Service Address</p>
                <p className="text-sm font-medium">{booking.address}</p>
                {booking.specific_location && (
                  <p className="text-xs text-gray-600 mt-1 italic">
                    <span className="font-semibold text-gray-700">Specific Location:</span> {booking.specific_location}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
            <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-green-600" />
                    Consent & Digital Signature
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-4">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-gray-900">
                            {isLoadingConsent
                                ? "Loading consent form..."
                                : homeServiceConsentTemplate?.title || "No home service consent assigned"}
                        </p>
                        {homeServiceConsentTemplate && (
                            <span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-blue-700">
                                {homeServiceConsentTemplate.category || "home-service"}
                            </span>
                        )}
                    </div>
                    <p className="max-h-52 overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-gray-700">
                        {consentPreviewContent || "An admin must assign a home service consent form in Consent Management before this booking can be submitted."}
                    </p>
                </div>

                <div className="space-y-3">
                    <Label className="font-semibold text-gray-900">Digital Signature *</Label>
                    <SignatureCapture 
                        signature={signature} 
                        onSignatureChange={setSignature} 
                        disabled={!homeServiceConsentTemplate || isLoadingConsent}
                    />
                </div>
            </CardContent>
        </Card>

        {/* Payment Section - Hidden until signature is provided */}
        {signature && (
          <Card className="md:col-span-2 border-blue-200 bg-blue-50/30 animate-in fade-in slide-in-from-top-4 duration-500">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-blue-800">
                <CheckCircle className="h-5 w-5 text-blue-600" />
                Home-Service Pricing Projection
              </CardTitle>
              <CardDescription>
                The PHP 50 payment is the transport fee. The home service itself starts at {homeServicePrice("home-visit-consultation")} and is billed separately on the clinic invoice.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleFinalSubmit} className="space-y-6">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Payment Method *</Label>
                      <Select
                        value={paymentFormData.paymentMethod}
                        onValueChange={(value) => setPaymentFormData({ ...paymentFormData, paymentMethod: value })}
                        disabled={isSubmitting || isLoadingPaymentMethods}
                        searchPlaceholder="Search payment method"
                      >
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder={isLoadingPaymentMethods ? "Loading methods..." : "Select method"} displayValue={selectedMethod?.label} />
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

                    {selectedMethod && (
                      <div className="bg-green-50 border border-green-200 p-3 rounded-lg text-xs text-green-800">
                        <p className="font-bold mb-1">{selectedMethod.label} Instructions:</p>
                        <p className="whitespace-pre-wrap">{paymentMethodInstruction(selectedMethod)}</p>
                        {selectedQrUrl && (
                          <button
                            type="button"
                            onClick={() => setViewer({ src: selectedQrUrl, alt: `${selectedMethod.label} QR` })}
                            className="mt-3 block w-full rounded-lg border border-green-100 bg-white p-2 text-left transition hover:border-green-300 focus:outline-none focus:ring-2 focus:ring-green-200"
                            aria-label={`Open larger ${selectedMethod.label} QR image`}
                          >
                            <ProtectedImage
                              src={selectedQrUrl}
                              alt={`${selectedMethod.label} QR`}
                              className="h-56 w-full rounded-md object-contain sm:h-64"
                              fallbackClassName="h-56 w-full rounded-md sm:h-64"
                            />
                          </button>
                        )}
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>Reference Number *</Label>
                      <Input
                        placeholder="Transaction ID"
                        restriction="alphanumeric"
                        value={paymentFormData.referenceNumber}
                        onChange={(e) => setPaymentFormData({ ...paymentFormData, referenceNumber: e.target.value })}
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Upload Receipt *</Label>
                      <FileUploadDropzone
                        id="homeServiceReceipt"
                        accept="image/*,.pdf"
                        files={paymentFormData.receiptFile ? [paymentFormData.receiptFile] : []}
                        onFilesSelected={(files) => setPaymentFormData({ ...paymentFormData, receiptFile: Array.from(files || [])[0] || null })}
                        onRemove={() => setPaymentFormData({ ...paymentFormData, receiptFile: null })}
                        disabled={isSubmitting}
                        label="Click to upload receipt"
                        helper="PNG, JPG, WEBP, GIF, or PDF up to 8 MB"
                      />
                    </div>

                    <div className="space-y-3 rounded-xl border border-blue-100 bg-white p-4">
                      <div className="flex items-center justify-between gap-4 text-sm">
                        <span className="font-semibold text-slate-600">Home service starting price</span>
                        <span className="font-black text-slate-900">{homeServicePrice("home-visit-consultation")}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-3 text-sm">
                        <span className="font-semibold text-slate-600">Transport fee paid at booking</span>
                        <span className="font-black text-blue-600">PHP {HOME_SERVICE_TRANSPORT_FEE.toFixed(2)}</span>
                      </div>
                      <p className="text-xs font-semibold leading-5 text-slate-500">
                        The transport fee will appear as its own line on the final invoice and receipt.
                      </p>
                    </div>
                  </div>
                </div>

                <SubmissionStatus
                  active={isSubmitting}
                  label="Finalizing booking..."
                  slowLabel="Still finalizing booking..."
                />

                <Button 
                  type="submit" 
                  className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg" 
                  disabled={isSubmitting || isLoadingPaymentMethods || isLoadingConsent || !homeServiceConsentTemplate}
                >
                  {isSubmitting ? (
                    <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Finalizing Booking...</>
                  ) : (
                    "Confirm and Submit Booking"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>

      {!signature && (
        <div className="flex flex-col sm:flex-row gap-4">
          <Button variant="outline" onClick={() => navigate("/dashboard/services/home-services")} className="flex-1 h-12">
            Edit Details
          </Button>
          <Button disabled className="flex-1 h-12">
            Please Sign to Continue
          </Button>
        </div>
      )}
      <PhotoViewer
        open={Boolean(viewer)}
        src={viewer?.src || ""}
        alt={viewer?.alt || "Payment QR"}
        onOpenChange={(open) => !open && setViewer(null)}
      />
    </div>
  );
}
