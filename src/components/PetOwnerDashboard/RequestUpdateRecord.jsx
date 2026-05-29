import { useState } from "react";
import { useNavigate, useParams } from "../dashboardRouter.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Label } from "../../ui/label";
import { RadioGroup, RadioGroupItem } from "../../ui/radio-group";
import { Textarea } from "../../ui/textarea";
import { ArrowLeft, Upload, CheckCircle2, AlertCircle, X } from "lucide-react";
import qrphCode from "../../assets/circular_logo.png";

export default function RequestUpdateRecord() {
  const navigate = useNavigate();
  const { petId } = useParams();
  const [selectedMethod, setSelectedMethod] = useState("");
  const [paymentProof, setPaymentProof] = useState(null);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const convenienceFee = 200; // PHP 200 convenience fee

  const paymentMethods = [
    {
      value: "qrph",
      label: "QRPH",
      instructions: "Scan the QR code below using any banking app that supports InstaPay/PESONet. Upload screenshot of successful transaction.",
      hasQRCode: true,
    },
    {
      value: "maya",
      label: "Maya",
      instructions: "Send payment to Maya account: 0917-XXX-XXXX (iPawcus Veterinary). Upload screenshot of successful transaction.",
    },
    {
      value: "gcash",
      label: "GCash",
      instructions: "Send payment to GCash account: 0917-XXX-XXXX (iPawcus Veterinary). Upload screenshot of successful transaction.",
    },
    {
      value: "cash",
      label: "Cash",
      instructions: "Our personnel will verify your payment and call you for identification before the update request is confirmed.",
    },
  ];

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setPaymentProof(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // In a real app, you would upload the file and submit the payment details
    console.log({
      petId,
      paymentMethod: selectedMethod,
      paymentProof,
      notes,
      amount: convenienceFee,
    });

    setIsSubmitting(false);
    setIsSubmitted(true);
  };

  const selectedPaymentMethod = paymentMethods.find(
    (method) => method.value === selectedMethod
  );

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
              Your update request has been submitted. Our veterinarian will review your payment and contact you shortly to update your pet's records.
            </p>
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
        <Card>
          <CardHeader>
            <CardTitle>Select Payment Method</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup value={selectedMethod} onValueChange={setSelectedMethod}>
              {paymentMethods.map((method) => (
                <div key={method.value} className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                  <RadioGroupItem value={method.value} id={method.value} />
                  <div className="flex-1">
                    <Label htmlFor={method.value} className="cursor-pointer font-semibold">
                      {method.label}
                    </Label>
                    {selectedMethod === method.value && (
                      <p className="text-sm text-gray-600 mt-2">{method.instructions}</p>
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
            {selectedPaymentMethod.hasQRCode && (
              <Card>
                <CardHeader>
                  <CardTitle>Scan QR Code</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col items-center justify-center p-6 bg-white">
                    <div className="bg-white p-4 rounded-lg shadow-lg border-2 border-gray-200">
                      <img
                        src={qrphCode}
                        alt="QRPH Payment QR Code"
                        className="w-64 h-64 object-cover"
                      />
                    </div>
                    <div className="mt-4 text-center">
                      <p className="font-semibold text-gray-900">iPawcus Veterinary Clinic</p>
                      <p className="text-sm text-gray-600 mt-1">Amount: PHP {convenienceFee.toLocaleString()}</p>
                      <p className="text-xs text-gray-500 mt-2">Scan using any QRPH-enabled banking app</p>
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
                    Upload Screenshot or Receipt <span className="text-red-500">*</span>
                  </Label>
                  <div className="mt-2 border-2 border-dashed border-gray-300 rounded-lg p-4 text-center bg-white hover:border-blue-400 transition-colors min-h-[180px] flex flex-col items-center justify-center relative overflow-hidden">
                    {paymentProof ? (
                      <div className="relative w-full flex flex-col items-center animate-in zoom-in duration-300">
                        <div className="relative group">
                          <img 
                            src={URL.createObjectURL(paymentProof)} 
                            alt="Payment Proof Preview" 
                            className="max-h-[200px] w-auto max-w-full object-contain rounded-lg shadow-md border border-gray-100"
                          />
                          <button
                            type="button"
                            onClick={() => setPaymentProof(null)}
                            className="absolute -top-3 -right-3 bg-red-500 text-white p-2 rounded-full shadow-xl hover:bg-red-600 transition-all transform hover:scale-110 z-10"
                            title="Remove proof"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="mt-3 flex items-center gap-2 px-3 py-1 bg-gray-50 rounded-full border border-gray-200">
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                          <span className="max-w-[min(200px,calc(100vw-7rem))] truncate text-xs font-medium text-gray-600">
                            {paymentProof.name}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <label
                        htmlFor="payment-proof"
                        className="cursor-pointer w-full h-full py-8 flex flex-col items-center justify-center"
                      >
                        <Upload className="h-10 w-10 text-gray-400 mb-2" />
                        <span className="text-sm font-semibold text-blue-600">Click to upload receipt</span>
                        <span className="text-xs text-gray-400 mt-1">PNG, JPG or PDF (MAX. 10MB)</span>
                        <input
                          id="payment-proof"
                          type="file"
                          className="hidden"
                          accept="image/*,.pdf"
                          onChange={handleFileChange}
                          required
                        />
                      </label>
                    )}
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
                disabled={!selectedMethod || !paymentProof || isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? "Submitting..." : "Submit Request"}
              </Button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}

