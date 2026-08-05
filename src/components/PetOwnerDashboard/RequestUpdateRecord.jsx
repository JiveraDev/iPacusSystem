import { useState } from "react";
import { useNavigate, useParams } from "../dashboardRouter.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Label } from "../../ui/label";
import { RadioGroup, RadioGroupItem } from "../../ui/radio-group";
import { Textarea } from "../../ui/textarea";
import { ArrowLeft, CheckCircle2, AlertCircle, X } from "lucide-react";
import { uploadImageFile } from "../../services/uploadService";
import { createRecordUpdateRequest } from "../../services/recordUpdateRequestService";
import { useDashboardUser } from "../dashboardRouter.jsx";
import { paymentMethodInstruction, paymentMethodRequiresProof, usePaymentMethods } from "../../hooks/usePaymentMethods";
import { PhotoViewer } from "../../ui/photo-viewer";
import FileUploadDropzone from "../shared/FileUploadDropzone";
import ProtectedImage from "../shared/ProtectedImage";

function currentUserId(user) {
  return user?.user_id || user?.userId || user?.id || null;
}

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("currentUser") || "{}");
  } catch {
    return {};
  }
}

function isPetOwnerRole(role) {
  return ["pet_owner", "pet owner"].includes(String(role || "").trim().toLowerCase().replace(/[\s-]+/g, "_"));
}

export default function RequestUpdateRecord() {
  const navigate = useNavigate();
  const { petId } = useParams();
  const dashboardUser = useDashboardUser();
  const currentUser = dashboardUser || getStoredUser();
  const canRequestRecordUpdate = isPetOwnerRole(currentUser?.role);
  const [selectedMethod, setSelectedMethod] = useState("");
  const [paymentProof, setPaymentProof] = useState(null);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedRequest, setSubmittedRequest] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [viewer, setViewer] = useState(null);
  const { paymentMethods, isLoadingPaymentMethods } = usePaymentMethods();

  const convenienceFee = 200; // PHP 200 convenience fee
  const selectedPaymentMethod = paymentMethods.find(
    (method) => method.value === selectedMethod
  );
  const selectedMethodRequiresProof = paymentMethodRequiresProof(selectedPaymentMethod);
  const selectedQrUrl = selectedPaymentMethod?.qrImageUrl || "";

  const handleFileChange = (files) => {
    setPaymentProof(Array.from(files || [])[0] || null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    if (!selectedMethod) {
      setErrorMessage("Please select a payment method.");
      return;
    }

    if (selectedMethodRequiresProof && !paymentProof) {
      setErrorMessage("Please upload your payment proof.");
      return;
    }

    if (!notes.trim()) {
      setErrorMessage("Please describe what needs to be updated.");
      return;
    }

    setIsSubmitting(true);

    try {
      const paymentProofUrl = paymentProof
        ? await uploadImageFile(paymentProof, "booking_payment")
        : "";

      const response = await createRecordUpdateRequest({
        petId,
        ownerUserId: currentUserId(currentUser),
        paymentMethod: selectedMethod,
        paymentProofUrl,
        requestedChanges: notes,
        paymentAmount: convenienceFee
      });

      setSubmittedRequest(response.request || null);
      setIsSubmitted(true);
    } catch (error) {
      setErrorMessage(error.message || "Failed to submit record update request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="space-y-8 max-w-2xl mx-auto">
        <Button variant="ghost" onClick={() => navigate(`/dashboard/my-pets/${petId}`)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Pet Profile
        </Button>

        <Card className="border-green-200">
          <CardContent className="pt-6 text-center py-12">
            <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <h3 className="font-semibold text-2xl mb-2">Request Submitted Successfully!</h3>
            <p className="text-gray-600 mb-6">
              Your update request has been submitted for admin payment review. A veterinarian will complete the update after approval.
            </p>
            {submittedRequest?.requestNumber && (
              <div className="mx-auto mb-6 w-fit rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-left">
                <p className="text-xs font-black uppercase tracking-widest text-green-700">Request Number</p>
                <p className="text-lg font-black text-green-900">{submittedRequest.requestNumber}</p>
              </div>
            )}
            <div className="flex gap-4 justify-center">
              <Button onClick={() => navigate(`/dashboard/my-pets/${petId}`)}>
                Back to Pet Profile
              </Button>
              <Button variant="outline" onClick={() => navigate("/dashboard/my-pets")}>
                View All Pets
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!canRequestRecordUpdate) {
    return (
      <div className="space-y-8 max-w-2xl mx-auto">
        <Button variant="ghost" onClick={() => navigate(`/dashboard/my-pets/${petId}`)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Pet Profile
        </Button>

        <Card className="border-slate-200">
          <CardContent className="py-12 text-center">
            <X className="mx-auto mb-4 h-12 w-12 text-slate-400" />
            <h3 className="mb-2 text-2xl font-bold text-slate-900">Pet Owner Access Only</h3>
            <p className="mx-auto max-w-md text-sm font-medium leading-6 text-slate-500">
              Record update requests can only be submitted by pet owner accounts.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <Button variant="ghost" onClick={() => navigate(`/dashboard/my-pets/${petId}`)}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Pet Profile
      </Button>

      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Request Record Update</h1>
        <p className="text-gray-600">
          Pay the veterinarian convenience fee to request an update to your pet's medical records.
        </p>
      </div>

      <Card className="border-blue-200">
        <CardHeader className="bg-blue-50">
          <CardTitle>Service Fee</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm text-gray-600">Veterinarian Convenience Fee</p>
              <p className="text-xs text-gray-500 mt-1">
                Fee for reviewing and updating your pet's medical records
              </p>
            </div>
            <p className="text-2xl font-bold text-blue-600">PHP {convenienceFee.toLocaleString()}</p>
          </div>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-6">
        {errorMessage && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
            <AlertCircle className="h-5 w-5" />
            {errorMessage}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Select Payment Method</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup value={selectedMethod} onValueChange={setSelectedMethod}>
              {isLoadingPaymentMethods && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                  Loading payment methods...
                </div>
              )}
              {paymentMethods.map((method) => (
                <div key={method.value} className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                  <RadioGroupItem value={method.value} id={method.value} disabled={isLoadingPaymentMethods} />
                  <div className="flex-1">
                    <Label htmlFor={method.value} className="cursor-pointer font-semibold">
                      {method.label}
                    </Label>
                    {selectedMethod === method.value && (
                      <p className="whitespace-pre-wrap text-sm text-gray-600 mt-2">{paymentMethodInstruction(method)}</p>
                    )}
                  </div>
                </div>
              ))}
            </RadioGroup>

            {!selectedMethod && (
              <div className="flex items-center gap-2 text-amber-700 bg-amber-50 p-3 rounded-lg">
                <AlertCircle className="h-5 w-5" />
                <p className="text-sm">Please select a payment method to continue.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {selectedPaymentMethod && (
          <>
            {selectedQrUrl && (
              <Card>
                <CardHeader>
                  <CardTitle>Scan QR Code</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col items-center justify-center p-6 bg-white">
                    <button
                      type="button"
                      onClick={() => setViewer({ src: selectedQrUrl, alt: `${selectedPaymentMethod.label} QR Code` })}
                      className="bg-white p-4 rounded-lg shadow-lg border-2 border-gray-200 transition hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      aria-label={`Open larger ${selectedPaymentMethod.label} QR image`}
                    >
                      <ProtectedImage
                        src={selectedQrUrl}
                        alt={`${selectedPaymentMethod.label} QR Code`}
                        className="w-64 h-64 object-contain"
                        fallbackClassName="h-64 w-64"
                      />
                    </button>
                    <div className="mt-4 text-center">
                      <p className="font-semibold text-gray-900">Vetfocus Animal Care Clinic</p>
                      <p className="text-sm text-gray-600 mt-1">Amount: PHP {convenienceFee.toLocaleString()}</p>
                      <p className="text-xs text-gray-500 mt-2">Scan using the supported payment app</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Upload Payment Proof</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="payment-proof">
                    Upload Screenshot or Receipt
                    {selectedMethodRequiresProof && <span className="text-red-500"> *</span>}
                  </Label>
                  <div className="mt-2">
                    <FileUploadDropzone
                      id="payment-proof"
                      accept="image/*,.pdf"
                      files={paymentProof ? [paymentProof] : []}
                      onFilesSelected={handleFileChange}
                      onRemove={() => setPaymentProof(null)}
                      label="Click to upload receipt"
                      helper="PNG, JPG, WEBP, GIF, or PDF up to 8 MB"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Purpose</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Please specify what information needs to be updated in your pet's records..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                />
                <p className="text-sm text-gray-500 mt-2">
                  Describe the changes or updates you'd like to make to your pet's medical records.
                </p>
              </CardContent>
            </Card>

            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="pt-6">
                <div className="flex gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    <p className="font-semibold mb-1">Important Notice:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Ensure your payment proof is clear and readable</li>
                      <li>The veterinarian will review your request within 24-48 hours</li>
                      <li>You will be contacted to discuss the record updates</li>
                      <li>All updates require veterinarian approval for accuracy</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-col-reverse gap-4 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(`/dashboard/my-pets/${petId}`)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!selectedMethod || !notes.trim() || (selectedMethodRequiresProof && !paymentProof) || isSubmitting || isLoadingPaymentMethods}
                className="flex-1"
              >
                {isSubmitting ? "Submitting..." : "Submit Request"}
              </Button>
            </div>
          </>
        )}
      </form>
      <PhotoViewer
        open={Boolean(viewer)}
        src={viewer?.src || ""}
        alt={viewer?.alt || "Payment QR"}
        onOpenChange={(open) => !open && setViewer(null)}
      />
    </div>
  );
}

