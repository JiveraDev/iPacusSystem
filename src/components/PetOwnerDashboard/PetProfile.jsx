import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "../dashboardRouter.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Badge } from "../../ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../ui/dialog";
import { ArrowLeft, FileText, PawPrint, Syringe, AlertCircle, Printer, Loader2, Copy, Check, Camera, ClipboardList, CalendarClock, XCircle, Eye, ShieldCheck } from "lucide-react";
import { toast } from "../../reusecomponent/toast.jsx";
import { resolveImageUrl } from "../../lib/image";
import { calculateAge, formatDisplayDate, formatDisplayDateTime, formatDisplayTime } from "../../lib/date";
import { formatPhpCurrency } from "../../lib/currency";
import { getServiceDisplayName } from "../../lib/serviceLabels";
import { useAutoRefresh } from "../../hooks/useAutoRefresh";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "../../ui/sheet";
import { PhotoViewer } from "../../ui/photo-viewer";

import { findPetService } from "../../services/findPet";
import { updateBookingStatus } from "../../services/bookingService";
import { fetchPetBookings, fetchPetQueues, updatePetDetails } from "../../services/petService";
import { updateQueueStatus } from "../../services/queueService";
import { uploadFormData } from "../../services/uploadService";

function uploadFileName(path) {
  const cleanPath = String(path || "").split("?")[0].replace(/\\/g, "/");
  return cleanPath.split("/").filter(Boolean).pop() || "Upload";
}

function isImageUploadPath(path) {
  return /\.(png|jpe?g|gif|webp|bmp)$/i.test(String(path || "").split("?")[0]);
}

export default function PetProfile() {
  const navigate = useNavigate();
  const { petId } = useParams();
  const [pet, setPet] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActivityLoading, setIsActivityLoading] = useState(false);
  const [queueRecords, setQueueRecords] = useState([]);
  const [bookingRecords, setBookingRecords] = useState([]);
  const [activityReferenceTime, setActivityReferenceTime] = useState(() => Date.now());
  const [confirmAction, setConfirmAction] = useState(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [copied, setCopied] = useState(false);
  const [detailModal, setDetailModal] = useState(null);
  const [consentViewer, setConsentViewer] = useState(null);

  useEffect(() => {
    async function fetchPet() {
      try {
        const data = await findPetService(petId);
        // data is now formatted correctly by the backend
        setPet(data);
      } catch (error) {
        console.error("Error fetching pet:", error);
        toast.error("Could not load pet profile");
      } finally {
        setIsLoading(false);
      }
    }

    if (petId) {
      fetchPet();
    }
  }, [petId]);

  const fetchPetActivity = async ({ isAutoRefresh = false } = {}) => {
    if (!pet?.db_id) return;

    if (!isAutoRefresh) {
      setIsActivityLoading(true);
    }
    try {
      const [queuesResult, bookingsResult] = await Promise.allSettled([
        fetchPetQueues(pet.db_id),
        fetchPetBookings(pet.db_id)
      ]);

      const queuesData = queuesResult.status === "fulfilled" ? queuesResult.value : [];
      const bookingsData = bookingsResult.status === "fulfilled" ? bookingsResult.value : [];

      setQueueRecords(Array.isArray(queuesData) ? queuesData : []);
      setBookingRecords(Array.isArray(bookingsData) ? bookingsData : []);
      setActivityReferenceTime(Date.now());
    } catch (error) {
      console.error("Error fetching pet activity:", error);
      if (!isAutoRefresh) {
        toast.error("Could not load queue and booking activity");
      }
    } finally {
      setIsActivityLoading(false);
    }
  };

  useAutoRefresh(fetchPetActivity, {
    enabled: Boolean(pet?.db_id),
    refreshKey: pet?.db_id
  });

  const copyToClipboard = () => {
    if (pet?.id) {
      // Fallback copy method for reliability
      const textArea = document.createElement('textarea');
      textArea.value = pet.id;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        toast.success("Pet ID copied to clipboard!");
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Copy failed', err);
      }
      document.body.removeChild(textArea);
    }
  };

  const handlePrint = () => {
    navigate(`/dashboard/my-pets/${petId}/medical-records`);
  };

  const formatDateTime = (dateValue, timeValue) => {
    return formatDisplayDateTime(dateValue, timeValue);
  };

  const getBoardingStayLabel = (type) => {
    return type === "hotel" ? "Pet Hotel Boarding" : "Kennel Boarding";
  };

  const getQueueStatusBadge = (status) => {
    const variants = {
      "waiting": "bg-amber-50 text-amber-700 border-amber-200",
      "in-progress": "bg-blue-50 text-blue-700 border-blue-200",
      "completed": "bg-green-50 text-green-700 border-green-200",
      "done": "bg-green-50 text-green-700 border-green-200",
      "cancelled": "bg-red-50 text-red-700 border-red-200"
    };
    const labels = {
      "waiting": "Pending",
      "in-progress": "Approved",
      "completed": "Done",
      "done": "Done",
      "cancelled": "Cancelled"
    };

    return <Badge className={`${variants[status] || variants.waiting} border`}>{labels[status] || "Pending"}</Badge>;
  };

  const getBookingStatusBadge = (status) => {
    const variants = {
      "pending": "bg-amber-50 text-amber-700 border-amber-200",
      "confirmed": "bg-blue-50 text-blue-700 border-blue-200",
      "completed": "bg-green-50 text-green-700 border-green-200",
      "cancelled": "bg-red-50 text-red-700 border-red-200"
    };
    const labels = {
      "pending": "Pending",
      "confirmed": "Approved",
      "completed": "Done",
      "cancelled": "Cancelled"
    };

    return <Badge className={`${variants[status] || variants.pending} border`}>{labels[status] || "Pending"}</Badge>;
  };

  const isWithinLastTwoDays = (dateValue) => {
    if (!dateValue) return false;
    const date = new Date(String(dateValue).replace(" ", "T"));
    if (Number.isNaN(date.getTime())) return false;

    const ageMs = activityReferenceTime - date.getTime();
    return ageMs >= 0 && ageMs <= 2 * 24 * 60 * 60 * 1000;
  };

  const shouldShowQueueRecord = (item) => {
    if (item.status === "completed" || item.status === "done") return false;
    if (item.status === "cancelled") return isWithinLastTwoDays(item.timestamp);
    return true;
  };

  const shouldShowBookingRecord = (booking) => {
    if (booking.status === "completed") return false;
    if (booking.status === "cancelled") return isWithinLastTwoDays(booking.createdAt || booking.date);
    return true;
  };

  const visibleQueueRecords = queueRecords.filter(shouldShowQueueRecord);
  const visibleBookingRecords = bookingRecords.filter(shouldShowBookingRecord);
  const consentRecords = useMemo(() => buildConsentRecords(bookingRecords, queueRecords), [bookingRecords, queueRecords]);
  const activeQueue = visibleQueueRecords.find(item => item.status !== "cancelled");
  const displayedQueue = activeQueue || visibleQueueRecords[0];

  const openQueueCancelDialog = () => {
    if (!activeQueue) return;
    setConfirmAction({
      type: "queue",
      id: activeQueue.queue_id,
      title: "Cancel queue entry?",
      description: `Queue #${activeQueue.queue_number} for ${pet?.name || "this pet"} will be cancelled.`
    });
  };

  const openBookingCancelDialog = (booking) => {
    setConfirmAction({
      type: "booking",
      id: booking.id,
      title: "Cancel booking?",
      description: `Booking ${booking.bookingNumber} for ${pet?.name || "this pet"} will be cancelled.`
    });
  };

  const openRecordDetails = (type, record) => {
    setDetailModal({ type, record });
  };

  const handleConfirmCancel = async () => {
    if (!confirmAction) return;

    setIsCancelling(true);
    try {
      if (confirmAction.type === "queue") {
        const data = await updateQueueStatus({ queue_id: confirmAction.id, status: "cancelled" });
        if (data.success === false) {
          throw new Error(data.message || "Failed to cancel queue entry");
        }
        setQueueRecords(records =>
          records.map(item => item.queue_id === confirmAction.id ? { ...item, status: "cancelled" } : item)
        );
        toast.success("Queue entry cancelled");
      } else {
        await updateBookingStatus(confirmAction.id, { status: "cancelled" });
        setBookingRecords(records =>
          records.map(item => item.id === confirmAction.id ? { ...item, status: "cancelled" } : item)
        );
        toast.success("Booking cancelled");
      }
      setConfirmAction(null);
    } catch (error) {
      toast.error(error.message || "Cancellation failed");
    } finally {
      setIsCancelling(false);
    }
  };

  const renderRecordDetails = () => {
    if (!detailModal) return null;

    if (detailModal.type === "queue") {
      const queue = detailModal.record;
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">Queue Number</p>
              <p className="font-semibold text-lg">#{queue.queue_number}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">Status</p>
              {getQueueStatusBadge(queue.status)}
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">Service</p>
              <p className="font-semibold">{getServiceDisplayName(queue.service_name, "Queue")}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">Priority</p>
              <p className="font-semibold capitalize">{queue.priority || "normal"}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">Date & Time</p>
              <p className="font-semibold">{formatDateTime(queue.timestamp)}</p>
            </div>
          </div>
          {queue.complaint && (
            <div className="border-t pt-4">
              <p className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-2">Complaint / Notes</p>
              <p className="whitespace-pre-wrap text-sm text-slate-700">{queue.complaint}</p>
            </div>
          )}
          <div className="border-t pt-4">
            <p className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-2">Queue Source</p>
            <p className="text-sm text-slate-700 capitalize">{queue.queue_source || "admin"}</p>
          </div>
        </div>
      );
    }

    const booking = detailModal.record;
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">Booking Number</p>
            <p className="font-semibold text-lg">{booking.bookingNumber}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">Status</p>
            {getBookingStatusBadge(booking.status)}
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">Service Type</p>
            <p className="font-semibold">{getServiceDisplayName(booking.service)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">Date & Time</p>
            <p className="font-semibold">{formatDisplayDate(booking.date)} at {formatDisplayTime(booking.time)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">Type</p>
            <p className="font-semibold">{getServiceDisplayName(booking.type)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">Price</p>
            <p className="font-semibold text-blue-600">{formatPhpCurrency(booking.price || 0)}</p>
          </div>
        </div>

        {booking.address && (
          <div className="border-t pt-4">
            <p className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-2">Service Address</p>
            <p className="font-semibold">{booking.address}</p>
            {booking.emergencyContact && (
              <p className="mt-2 text-sm text-slate-600">Emergency Contact: {booking.emergencyContact}</p>
            )}
          </div>
        )}

        {booking.isOnlineConsultation && (
          <div className="border-t pt-4">
            <p className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-3">Consultation Details</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">Veterinarian</p>
                <p className="font-semibold">{booking.veterinarian || "Unassigned"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">Consult Time</p>
                <p className="font-semibold">{formatDisplayTime(booking.time)}</p>
              </div>
            </div>
          </div>
        )}

        {booking.specialServiceItems?.length > 0 && (
          <div className="border-t pt-4">
            <p className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-3">Special Service Items</p>
            <div className="space-y-3">
              {booking.specialServiceItems.map((item, index) => (
                <div key={`${item.id || item.sequenceNo || index}`} className="rounded-lg border border-purple-200 bg-purple-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{item.serviceTitle || "Special Service"}</p>
                      {item.serviceDescription && <p className="mt-1 text-sm text-slate-600">{item.serviceDescription}</p>}
                    </div>
                    <span className="rounded-full bg-purple-100 px-2.5 py-1 text-xs font-semibold text-purple-700">
                      #{item.sequenceNo || index + 1}
                    </span>
                  </div>
                  {item.serviceDetails && (
                    <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">{item.serviceDetails}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {booking.hotelBoardingType && (
          <div className="border-t pt-4">
            <p className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-3">Stay Details</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">Stay Type</p>
                <p className="font-semibold">{getBoardingStayLabel(booking.hotelBoardingType)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">Room / Kennel Size</p>
                <p className="font-semibold capitalize">{booking.roomSize || "Not set"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">Check-in</p>
                <p className="font-semibold">{formatDisplayDate(booking.checkInDate)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">Check-out</p>
                <p className="font-semibold">{formatDisplayDate(booking.checkOutDate)}</p>
              </div>
              {booking.emergencyContact && (
                <div className="sm:col-span-2">
                  <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">Emergency Contact</p>
                  <p className="font-semibold">{booking.emergencyContact}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {booking.isHomeService && (
          <div className="border-t pt-4">
            <p className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-3">Home Service Details</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">Address</p>
                <p className="font-semibold">{booking.address || "Not set"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">Date & Time</p>
                <p className="font-semibold">{formatDisplayDate(booking.date)} at {formatDisplayTime(booking.time)}</p>
              </div>
              {booking.emergencyContact && (
                <div className="sm:col-span-2">
                  <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">Emergency Contact</p>
                  <p className="font-semibold">{booking.emergencyContact}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {booking.addOns?.length > 0 && (
          <div className="border-t pt-4">
            <p className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-2">Add-ons</p>
            <div className="flex flex-wrap gap-2">
              {booking.addOns.map((addOn) => (
                <span key={addOn.id || addOn.name} className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
                  {addOn.name || addOn.id}
                </span>
              ))}
            </div>
          </div>
        )}

        {booking.image_Booking_Concern_Path && (
          <div className="border-t pt-4">
            <p className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-3">Concern Uploads</p>
            <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
              {String(booking.image_Booking_Concern_Path)
                .split(',')
                .map((path) => path.trim())
                .filter(Boolean)
                .map((path, index) => {
                  const url = resolveImageUrl(path);
                  const isImage = isImageUploadPath(path);

                  return (
                    <a
                      key={`${path}-${index}`}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
                    >
                      {isImage ? (
                        <img src={url} alt={`Concern ${index + 1}`} className="aspect-square w-full object-cover" />
                      ) : (
                        <span className="flex aspect-square w-full flex-col items-center justify-center gap-3 p-4 text-center">
                          <FileText className="h-10 w-10 text-slate-300" />
                          <span className="max-w-full truncate text-sm font-bold text-slate-700">{uploadFileName(path)}</span>
                          <span className="text-xs font-semibold text-blue-600">Open file</span>
                        </span>
                      )}
                    </a>
                  );
                })}
            </div>
          </div>
        )}

        {booking.notes && (
          <div className="border-t pt-4">
            <p className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-2">Notes</p>
            <p className="whitespace-pre-wrap text-sm text-slate-700">{booking.notes}</p>
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="h-12 w-12 text-[#155dfc] animate-spin mb-4" />
        <p className="text-gray-600">Loading pet profile...</p>
      </div>
    );
  }

  if (!pet) {
    return (
      <div className="space-y-8 animate-in fade-in duration-300">
        <Button variant="ghost" onClick={() => navigate("/dashboard/my-pets")} className="hover:bg-slate-100">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to My Pets
        </Button>
        <Card className="border-slate-200">
          <CardContent className="pt-12 pb-12 text-center">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <PawPrint className="h-10 w-10 text-slate-300" />
            </div>
            <h3 className="font-bold text-xl text-slate-900 mb-2">Pet Not Found</h3>
            <p className="text-slate-500 mb-8 max-w-sm mx-auto">
              We couldn't find the pet profile for ID: <span className="font-mono text-blue-600">{petId}</span>. 
              It might have been unlinked or the ID is incorrect.
            </p>
            <Button onClick={() => navigate("/dashboard/my-pets")} className="bg-[#155dfc]">
              Return to My Pets
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl min-w-0 space-y-6 pb-12 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Button variant="ghost" onClick={() => navigate("/dashboard/my-pets")} className="w-fit hover:bg-slate-100">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
        <div className="flex w-full flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 shadow-sm sm:w-auto sm:px-4">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Registration ID</span>
          <code className="min-w-0 max-w-full truncate rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm font-bold text-[#155dfc]">
            {pet.id}
          </code>
          <Button variant="ghost" size="sm" onClick={copyToClipboard} className="h-8 w-8 p-0 hover:bg-white rounded-lg transition-colors">
            {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4 text-slate-400" />}
          </Button>
        </div>
      </div>

      {/* Main Profile Header */}
      <Card className="overflow-hidden border-none shadow-xl rounded-2xl bg-white">
        <div className="h-40 bg-gradient-to-r from-[#155dfc] via-blue-600 to-indigo-700 relative">
            <div className="absolute inset-0 bg-white/5 backdrop-blur-[2px]" />
        </div>
        <CardContent className="relative px-4 pb-6 pt-0 sm:px-8 sm:pb-8">
          <div className="-mt-16 flex flex-col items-center gap-6 md:flex-row md:items-end md:gap-8">
            <div className="relative">
                {/* Pet Image with Upload Option */}
              <div className="relative group">
                <div className="h-32 w-32 overflow-hidden rounded-3xl border-[6px] border-white bg-slate-100 shadow-2xl ring-1 ring-slate-100 transition-all duration-300 group-hover:ring-blue-100 sm:h-40 sm:w-40">
                  {pet.profileImage ? (
                      <img
                          src={resolveImageUrl(pet.profileImage)}
                          alt={pet.name}
                          className="h-full w-full object-cover"
                      />
                  ) : (
                      <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100">
                          <PawPrint className="h-20 w-20 text-blue-200" />
                      </div>
                  )}
                </div>

                {/* Status Badge at Top-Left */}
                <Badge className={`absolute -top-3 -left-3 px-4 py-1.5 shadow-xl border-2 border-white rounded-full text-xs font-black uppercase tracking-widest ${
                  pet.status === 'Healthy' 
                    ? 'bg-green-500 hover:bg-green-600' 
                    : pet.status === 'Emergency'
                    ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                    : 'bg-amber-500 hover:bg-amber-600 text-white'
                }`}>
                  {pet.status}
                </Badge>

                {/* Upload Button at Bottom-Right */}
                <input
                    type="file"
                    id="pet-pic-upload"
                    className="hidden"
                    accept="image/*"
                    onChange={async (e) => {
                        const file = e.target.files[0];
                        if (!file) return;

                        const formData = new FormData();
                        formData.append('image', file);
                        formData.append('type', 'pet');

                        try {
                            const result = await uploadFormData(formData);
                            
                            // Update the pet with the new URL
                            await updatePetDetails(pet.db_id, { setpetImage_url: result.relative_url });
                            toast.success("Profile picture updated!");
                            setPet(prev => ({ ...prev, profileImage: result.relative_url }));
                        } catch (err) {
                            console.error(err);
                            toast.error("Upload failed.");
                        }
                    }}
                />
                <label 
                  htmlFor="pet-pic-upload" 
                  className="absolute bottom-2 right-2 p-2 bg-blue-600 rounded-full text-white shadow-lg cursor-pointer hover:bg-blue-700 transition-colors"
                >
                  <Camera className="h-5 w-5" />
                </label>
              </div>
            </div>
            
            <div className="min-w-0 flex-1 space-y-2 pb-2 text-center md:text-left">
              <h1 className="break-words text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">{pet.name}</h1>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                <span className="text-lg text-slate-500 font-medium">{pet.species}</span>
                <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                <span className="text-lg text-slate-500 font-medium">{pet.breed}</span>
              </div>
            </div>

            <div className="flex w-full flex-col gap-3 pb-2 sm:flex-row md:w-auto">
              <Button 
                onClick={() => navigate(`/dashboard/my-pets/${petId}/medical-records`)} 
                className="flex-1 md:flex-none bg-[#155dfc] hover:bg-blue-700 h-12 px-8 rounded-xl font-bold shadow-lg transition-all"
              >
                <FileText className="h-5 w-5 mr-2" />
                Medical Records
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid min-w-0 grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left Column: Details & Stats */}
        <div className="lg:col-span-1 space-y-8">
          <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100">
              <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                Biological Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4 sm:p-6">
              <PetInfoRow label="Primary Breed" value={pet.breed || 'N/A'} />
              <PetInfoRow label="Owner Name" value={pet.ownerName || 'N/A'} />
              <PetInfoRow label="Estimated Age" value={calculateAge(pet.birthDate) || pet.age || 'N/A'} />
              <PetInfoRow label="Sex / Gender" value={pet.gender || 'N/A'} />
              <PetInfoRow label="Body Weight" value={pet.weight ? `${pet.weight} kg` : 'N/A'} highlight />
              <PetInfoRow label="Coloration" value={pet.color || 'N/A'} />
            </CardContent>
          </Card>

          {pet.microchipId && (
            <Card className="bg-blue-600 border-none shadow-lg shadow-blue-200 rounded-2xl overflow-hidden">
              <CardContent className="p-6 relative">
                <div className="absolute right-0 top-0 h-full w-1/2 bg-white/10 skew-x-[-20deg] translate-x-8" />
                <div className="flex items-center gap-4 relative z-10">
                  <div className="p-3 bg-white/20 rounded-xl text-white backdrop-blur-md">
                    <Check className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs text-blue-100 font-black uppercase tracking-widest">Microchip Verified</p>
                    <p className="font-mono text-xl text-white font-black mt-1 tracking-wider">{pet.microchipId}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Allergies Card */}
          <Card className={`rounded-2xl shadow-sm overflow-hidden ${pet.allergies?.length > 0 ? "border-red-100" : "border-slate-200"}`}>
            <CardHeader className="bg-red-50/50 border-b border-red-100 dark:bg-[#2a1517] dark:border-[#7f1d1d]">
              <CardTitle className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-[#991b1b] dark:text-[#ef4444]">
                <AlertCircle className="h-4 w-4 text-[#991b1b] dark:text-[#ef4444]" />
                Critical Allergies
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {pet.allergies?.length > 0 ? (
                <div className="space-y-3">
                  {pet.allergies.map((allergy, idx) => (
                    <div key={idx} className="bg-white p-4 rounded-xl border border-red-50 shadow-sm">
                      <p className="font-black text-red-600 text-sm uppercase tracking-tight">{allergy.allergen}</p>
                      <p className="text-xs text-slate-400 mt-1 font-medium italic">{allergy.severity} Reaction Type</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                    <p className="text-sm text-slate-400 font-medium">No known clinical allergies recorded.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <ConsentImagesPanel
            records={consentRecords}
            onPreview={(record) => setConsentViewer({ src: record.url, alt: record.identifier })}
          />
        </div>

        {/* Right Column: Vaccinations & Actions */}
        <div className="lg:col-span-2 space-y-8">
          {/* Action Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="group hover:shadow-xl transition-all cursor-pointer bg-white border-slate-200 hover:border-green-200 rounded-2xl overflow-hidden" 
                  onClick={() => navigate(`/dashboard/my-pets/${petId}/request-update`)}>
              <CardContent className="p-6 flex items-center gap-5">
                <div className="h-14 w-14 bg-green-50 rounded-2xl flex items-center justify-center text-green-600 group-hover:bg-green-600 group-hover:text-white transition-all duration-300">
                  <FileText className="h-7 w-7" />
                </div>
                <div>
                  <h4 className="font-black text-slate-900 text-lg tracking-tight">Update Record</h4>
                  <p className="text-sm text-slate-500 font-medium">Submit data correction request</p>
                </div>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-xl transition-all cursor-pointer bg-white border-slate-200 hover:border-blue-200 rounded-2xl overflow-hidden"
                  onClick={handlePrint}>
              <CardContent className="p-6 flex items-center gap-5">
                <div className="h-14 w-14 bg-blue-50 rounded-2xl flex items-center justify-center text-[#155dfc] group-hover:bg-[#155dfc] group-hover:text-white transition-all duration-300">
                  <Printer className="h-7 w-7" />
                </div>
                <div>
                  <h4 className="font-black text-slate-900 text-lg tracking-tight">Health History</h4>
                  <p className="text-sm text-slate-500 font-medium">Export clinical medical logs</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <VaccinationRecordsPanel vaccinations={pet.vaccinations || []} />
          <PrescriptionDocumentsPanel documents={pet.prescriptionDocuments || []} />

          <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 px-4 py-5 sm:px-8 sm:py-6">
              <CardTitle className="text-xl font-black text-slate-800 flex items-center gap-3">
                <ClipboardList className="h-6 w-6 text-[#155dfc]" />
                Queue Status
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-8">
              {isActivityLoading ? (
                <div className="flex items-center gap-3 text-slate-500">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Loading queue status...
                </div>
              ) : displayedQueue ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
                      {activeQueue ? "Current Queue" : "Recent Cancelled Queue"}
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-3xl font-black text-slate-900">#{displayedQueue.queue_number}</span>
                      {getQueueStatusBadge(displayedQueue.status)}
                    </div>
                    <p className="text-sm text-slate-500 mt-3">
                      {getServiceDisplayName(displayedQueue.service_name, "Queue")} - {formatDateTime(displayedQueue.timestamp)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() => openRecordDetails("queue", displayedQueue)}
                      className="sm:w-auto"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </Button>
                    {activeQueue && (
                      <Button
                        variant="destructive"
                        onClick={openQueueCancelDialog}
                        className="sm:w-auto"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Cancel Queue
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="font-bold text-slate-900">No active queue entry</p>
                  <p className="text-sm text-slate-500 mt-1">Only pending queues and cancelled queues from the last two days appear here.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 px-4 py-5 sm:px-8 sm:py-6">
              <CardTitle className="text-xl font-black text-slate-800 flex items-center gap-3">
                <CalendarClock className="h-6 w-6 text-[#155dfc]" />
                Bookings
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isActivityLoading ? (
                <div className="flex items-center gap-3 p-4 text-slate-500 sm:p-8">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Loading bookings...
                </div>
              ) : visibleBookingRecords.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {visibleBookingRecords.map((booking) => {
                    const canCancelBooking = booking.status !== "completed" && booking.status !== "cancelled";
                    return (
                      <div key={booking.id} className="flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center sm:p-6">
                        <button
                          type="button"
                          onClick={() => openRecordDetails("booking", booking)}
                          className="min-w-0 flex-1 text-left rounded-lg transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#155dfc]/30"
                        >
                          <div className="p-2">
                            <div className="flex flex-wrap items-center gap-3 mb-2">
                              <p className="font-black text-slate-900">{booking.bookingNumber}</p>
                              {getBookingStatusBadge(booking.status)}
                            </div>
                            <p className="text-sm font-semibold text-slate-700">{getServiceDisplayName(booking.service)}</p>
                            <p className="text-sm text-slate-500 mt-1">{formatDateTime(booking.date, booking.time)}</p>
                          </div>
                        </button>
                        <div className="flex flex-wrap gap-2">
                          {canCancelBooking && (
                            <Button
                              variant="outline"
                              onClick={(event) => {
                                event.stopPropagation();
                                openBookingCancelDialog(booking);
                              }}
                              className="border-red-200 text-red-600 hover:bg-red-50"
                            >
                              Cancel
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="px-4 py-12 text-center sm:px-8">
                  <p className="font-bold text-slate-900">No active bookings</p>
                  <p className="text-sm text-slate-500 mt-1">Only pending bookings and cancelled bookings from the last two days appear here.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      <Dialog
        open={!!confirmAction}
        onOpenChange={(open) => {
          if (!open && !isCancelling) {
            setConfirmAction(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{confirmAction?.title}</DialogTitle>
            <DialogDescription>
              {confirmAction?.description} This action can be changed later only by clinic staff.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmAction(null)}
              disabled={isCancelling}
            >
              Keep
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmCancel}
              disabled={isCancelling}
            >
              {isCancelling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Cancelling...
                </>
              ) : (
                "Confirm Cancel"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!detailModal}
        onOpenChange={(open) => {
          if (!open) {
            setDetailModal(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {detailModal?.type === "queue" ? <ClipboardList className="h-5 w-5 text-[#155dfc]" /> : <CalendarClock className="h-5 w-5 text-[#155dfc]" />}
              {detailModal?.type === "queue" ? "Queue Details" : "Booking Details"}
            </DialogTitle>
            <DialogDescription>
              {detailModal?.type === "queue"
                ? "View the queue entry information recorded for this pet."
                : "View the booking details recorded for this pet. Payment proof is intentionally hidden here."}
            </DialogDescription>
          </DialogHeader>

          {renderRecordDetails()}
        </DialogContent>
      </Dialog>
      <PhotoViewer
        open={Boolean(consentViewer)}
        src={consentViewer?.src || ""}
        alt={consentViewer?.alt || "Consent image"}
        onOpenChange={(open) => !open && setConsentViewer(null)}
      />
    </div>
  );
}

function buildConsentRecords(bookings, queues) {
  const records = [];
  const seen = new Set();

  const addRecord = (record) => {
    const url = resolveImageUrl(record.path || "");
    if (!url) return;

    const key = `${record.source}-${record.sourceId}-${url}`;
    if (seen.has(key)) return;
    seen.add(key);

    records.push({
      ...record,
      url,
      consentId: `CONSENT-${String(record.source).toUpperCase()}-${record.sourceId || records.length + 1}`,
    });
  };

  bookings.forEach((booking) => {
    addRecord({
      source: "booking",
      sourceLabel: "Booking Consent",
      sourceId: booking.id,
      path: booking.signaturePath,
      identifier: booking.bookingNumber || `Booking #${booking.id}`,
      service: getServiceDisplayName(booking.service || booking.type, "Booking"),
      dateLabel: formatDisplayDateTime(booking.date || booking.createdAt, booking.time),
      ownerLabel: booking.ownerName || "Pet owner",
    });
  });

  queues.forEach((queue) => {
    addRecord({
      source: "queue",
      sourceLabel: "Queue Consent",
      sourceId: queue.queue_id,
      path: queue.signiture_self_service_path,
      identifier: queue.queue_number ? `Queue #${queue.queue_number}` : `Queue #${queue.queue_id}`,
      service: getServiceDisplayName(queue.service_name, "Queue"),
      dateLabel: formatDisplayDateTime(queue.timestamp),
      ownerLabel: "Pet owner",
    });
  });

  return records;
}

function ConsentImagesPanel({ records, onPreview }) {
  return (
    <Sheet>
      <Card className="overflow-hidden rounded-2xl border-slate-200 bg-white shadow-sm">
        <CardHeader className="border-b border-blue-100 bg-blue-50/50">
          <CardTitle className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-[#155dfc]">
            <ShieldCheck className="h-4 w-4" />
            Consent Images
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-2xl font-black text-slate-900">{records.length}</p>
              <p className="text-sm font-semibold text-slate-500">View-only signed copies</p>
            </div>
            <Badge className="border-0 bg-slate-100 text-slate-700">No print</Badge>
          </div>

          <SheetTrigger asChild>
            <Button type="button" variant="outline" className="w-full gap-2" disabled={records.length === 0}>
              <Eye className="h-4 w-4" />
              View Holder
            </Button>
          </SheetTrigger>

          {records.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-400">
              No signed consent image has been recorded for this pet yet.
            </p>
          )}
        </CardContent>
      </Card>

      <SheetContent side="right" className="sm:max-w-xl">
        <div className="p-5 sm:p-6">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 text-xl font-black text-slate-950">
              <ShieldCheck className="h-5 w-5 text-[#155dfc]" />
              Consent Image Holder
            </SheetTitle>
            <SheetDescription>
              Signed owner consent images for this pet. These copies are for viewing only.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-5 space-y-3">
            {records.map((record) => (
              <ConsentRecordCard key={`${record.source}-${record.sourceId}-${record.url}`} record={record} onPreview={onPreview} />
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ConsentRecordCard({ record, onPreview }) {
  return (
    <button
      type="button"
      onClick={() => onPreview(record)}
      className="block w-full overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-sm transition hover:border-blue-200 hover:bg-blue-50/40"
    >
      <div className="grid gap-0 sm:grid-cols-[9rem_minmax(0,1fr)]">
        <div className="flex h-36 items-center justify-center overflow-hidden bg-slate-50 sm:h-full">
          <img src={record.url} alt={record.identifier} className="h-full w-full object-contain" />
        </div>
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border-0 bg-blue-50 text-[#155dfc]">{record.sourceLabel}</Badge>
            <Badge className="border-0 bg-slate-100 text-slate-700">View only</Badge>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Identifier</p>
            <p className="mt-1 break-words text-sm font-black text-slate-900">{record.consentId}</p>
          </div>
          <div className="grid gap-2 text-sm">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Source</p>
              <p className="font-bold text-slate-800">{record.identifier}</p>
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Service</p>
              <p className="font-semibold text-slate-700">{record.service}</p>
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Signed / Recorded</p>
              <p className="font-semibold text-slate-700">{record.dateLabel}</p>
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

function VaccinationRecordsPanel({ vaccinations }) {
  return (
    <Card className="overflow-hidden rounded-2xl border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b border-blue-100 bg-blue-50/50 px-4 py-4 sm:px-6">
        <CardTitle className="flex items-center gap-3 text-lg font-black text-slate-800">
          <Syringe className="h-6 w-6 text-[#155dfc]" />
          Vaccination Records
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {vaccinations.length > 0 ? (
          <div>
            <div className="hidden grid-cols-[minmax(0,1.2fr)_0.9fr_0.9fr_1fr_0.8fr] gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-black uppercase tracking-widest text-slate-500 md:grid">
              <span>Vaccine</span>
              <span>Date Given</span>
              <span>Next Due</span>
              <span>Veterinarian</span>
              <span>Status</span>
            </div>
            {vaccinations.map((vax, index) => (
              <VaccinationRow key={vax.id || index} vax={vax} />
            ))}
          </div>
        ) : (
          <div className="px-4 py-12 text-center sm:px-8">
            <Syringe className="mx-auto mb-4 h-10 w-10 text-slate-200" />
            <h4 className="text-lg font-bold text-slate-900">No Vaccination Data</h4>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PrescriptionDocumentsPanel({ documents }) {
  return (
    <Card className="overflow-hidden rounded-2xl border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b border-blue-100 bg-blue-50/50 px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-3 text-lg font-black text-slate-800">
            <FileText className="h-6 w-6 text-[#155dfc]" />
            Prescription Documents
          </CardTitle>
          <Badge className="w-fit border-0 bg-blue-50 text-blue-700">{documents.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-5">
        {documents.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {documents.map((document) => {
              const url = resolveImageUrl(document.url || document.relativeUrl);

              return (
                <a
                  key={document.id || document.url}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 transition hover:border-blue-200 hover:bg-blue-50"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-white text-[#155dfc]">
                    <FileText className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-black text-slate-900">{document.name || 'Prescription document'}</span>
                    <span className="block text-xs font-semibold text-slate-500">
                      {formatDisplayDate(document.createdAt)}
                    </span>
                  </span>
                </a>
              );
            })}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-400">
            No prescription documents saved.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function VaccinationRow({ vax }) {
  return (
    <div className="grid gap-3 border-b border-slate-100 px-4 py-4 text-sm last:border-b-0 md:grid-cols-[minmax(0,1.2fr)_0.9fr_0.9fr_1fr_0.8fr] md:items-center md:px-5">
      <VaccinationCell label="Vaccine" value={vax.name || 'Unnamed vaccine'} strong />
      <VaccinationCell label="Date Given" value={formatDisplayDate(vax.date)} />
      <VaccinationCell label="Next Due" value={formatDisplayDate(vax.nextDue)} highlight />
      <VaccinationCell label="Veterinarian" value={vax.applicator || vax.veterinarianName || vax.veterinarian || 'N/A'} />
      <div className="flex items-center justify-between gap-3 md:block">
        <span className="text-xs font-black uppercase tracking-widest text-slate-400 md:hidden">Status</span>
        <Badge className={`w-fit border-0 ${
          vax.status === 'completed' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
        }`}>
          {vax.status || 'completed'}
        </Badge>
      </div>
    </div>
  );
}

function VaccinationCell({ label, value, strong = false, highlight = false }) {
  return (
    <div className="flex items-start justify-between gap-3 md:block">
      <span className="shrink-0 text-xs font-black uppercase tracking-widest text-slate-400 md:hidden">{label}</span>
      <span className={`min-w-0 break-words text-right md:text-left ${strong ? 'font-black text-slate-900' : 'font-semibold'} ${highlight ? 'text-[#155dfc]' : 'text-slate-700'}`}>
        {value || 'N/A'}
      </span>
    </div>
  );
}

function PetInfoRow({ label, value, highlight = false }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-slate-100 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm font-semibold text-slate-500">{label}</span>
      <span className={`break-words text-sm font-bold sm:text-right ${highlight ? 'text-[#155dfc]' : 'text-slate-900'}`}>
        {value}
      </span>
    </div>
  );
}
